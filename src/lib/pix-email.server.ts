import QRCode from "qrcode";
import tls from "node:tls";

type SendPixEmailInput = {
  to: string;
  customerName: string;
  itemTitle: string;
  amountCents: number;
  pixCode: string;
  transactionId: string;
};

type SendPixEmailConfig = {
  gmailUser?: string;
  gmailAppPassword?: string;
  resendApiKey?: string;
  resendFrom?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatBrl(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function sanitizeHeader(value: string) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function buildEmailHtml(input: SendPixEmailInput) {
  const safeName = escapeHtml(input.customerName || "Cliente");
  const safeTitle = escapeHtml(input.itemTitle || "Produto");
  const safePixCode = escapeHtml(input.pixCode);
  const safeTransactionId = escapeHtml(input.transactionId);
  const amount = formatBrl(input.amountCents);

  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e7e7;">
            <tr>
              <td style="padding:28px 24px 12px;text-align:center;">
                <div style="font-size:22px;font-weight:700;margin-bottom:8px;">Seu Pix foi gerado</div>
                <div style="font-size:14px;color:#666;">Olá, ${safeName}. Use o QR Code ou o Pix Copia e Cola abaixo para concluir o pagamento.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px;text-align:center;">
                <div style="font-size:14px;color:#666;margin-bottom:4px;">${safeTitle}</div>
                <div style="font-size:28px;font-weight:700;">${amount}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px;text-align:center;">
                <img src="cid:pix-qrcode" width="260" height="260" alt="QR Code Pix" style="display:block;margin:0 auto;max-width:260px;width:100%;height:auto;border:1px solid #ececec;border-radius:8px;padding:8px;box-sizing:border-box;" />
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 28px;">
                <div style="font-size:14px;font-weight:700;margin-bottom:8px;">Pix Copia e Cola</div>
                <div style="font-size:12px;line-height:1.5;background:#f7f7f7;border:1px solid #e5e5e5;border-radius:8px;padding:14px;word-break:break-all;">${safePixCode}</div>
                <div style="font-size:12px;color:#888;margin-top:14px;">Transação: ${safeTransactionId}</div>
                <div style="font-size:12px;color:#888;margin-top:6px;">Se você já realizou o pagamento, ignore esta mensagem.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function waitForSmtpCode(
  socket: tls.TLSSocket,
  expected: number | number[],
  timeoutMs = 15000,
): Promise<string> {
  const expectedCodes = Array.isArray(expected) ? expected : [expected];

  return new Promise((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(() => cleanup(new Error("Timeout no servidor SMTP.")), timeoutMs);

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split(/\r?\n/).filter(Boolean);
      const last = lines[lines.length - 1] || "";
      const match = last.match(/^(\d{3})([ -])/);
      if (!match || match[2] === "-") return;
      const code = Number(match[1]);
      if (!expectedCodes.includes(code)) {
        cleanup(new Error(`SMTP respondeu ${code}: ${last.slice(0, 180)}`));
        return;
      }
      cleanup(undefined, buffer);
    };

    const onError = (error: Error) => cleanup(error);
    const onClose = () => cleanup(new Error("Conexão SMTP encerrada inesperadamente."));

    function cleanup(error?: Error, result?: string) {
      clearTimeout(timer);
      socket.off("data", onData);
      socket.off("error", onError);
      socket.off("close", onClose);
      if (error) reject(error);
      else resolve(result || buffer);
    }

    socket.on("data", onData);
    socket.on("error", onError);
    socket.on("close", onClose);
  });
}

async function smtpCommand(
  socket: tls.TLSSocket,
  command: string,
  expected: number | number[],
) {
  socket.write(`${command}\r\n`);
  return waitForSmtpCode(socket, expected);
}

async function sendViaGmailSmtp(
  input: SendPixEmailInput,
  gmailUser: string,
  gmailAppPassword: string,
  qrBase64: string,
  html: string,
) {
  const user = gmailUser.trim();
  const password = gmailAppPassword.replace(/\s+/g, "");
  if (!validEmail(user) || !password) return false;

  const socket = tls.connect({
    host: "smtp.gmail.com",
    port: 465,
    servername: "smtp.gmail.com",
    rejectUnauthorized: true,
  });

  try {
    await waitForSmtpCode(socket, 220);
    await smtpCommand(socket, "EHLO promo-doano-full.vercel.app", 250);
    await smtpCommand(socket, "AUTH LOGIN", 334);
    await smtpCommand(socket, Buffer.from(user).toString("base64"), 334);
    await smtpCommand(socket, Buffer.from(password).toString("base64"), 235);
    await smtpCommand(socket, `MAIL FROM:<${user}>`, 250);
    await smtpCommand(socket, `RCPT TO:<${input.to}>`, [250, 251]);
    await smtpCommand(socket, "DATA", 354);

    const boundary = `pix-${input.transactionId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40)}-${Date.now()}`;
    const amount = formatBrl(input.amountCents);
    const subject = `Seu Pix de ${amount} foi gerado`;
    const messageId = `<pix-${Date.now()}-${Math.random().toString(36).slice(2)}@gmail.com>`;

    const mime = [
      `From: Pagamentos <${user}>`,
      `To: <${sanitizeHeader(input.to)}>`,
      `Subject: ${sanitizeHeader(subject)}`,
      `Message-ID: ${messageId}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/related; boundary=\"${boundary}\"`,
      "",
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      html,
      "",
      `--${boundary}`,
      "Content-Type: image/png; name=\"pix-qrcode.png\"",
      "Content-Transfer-Encoding: base64",
      "Content-ID: <pix-qrcode>",
      "Content-Disposition: inline; filename=\"pix-qrcode.png\"",
      "",
      qrBase64.replace(/(.{76})/g, "$1\r\n"),
      "",
      `--${boundary}--`,
      "",
      ".",
    ].join("\r\n");

    socket.write(mime + "\r\n");
    await waitForSmtpCode(socket, 250);
    try {
      await smtpCommand(socket, "QUIT", 221);
    } catch {}
    return true;
  } catch (error) {
    console.warn(`Falha no Gmail SMTP da transação ${input.transactionId}.`, error);
    return false;
  } finally {
    socket.destroy();
  }
}

async function sendViaResend(
  input: SendPixEmailInput,
  apiKey: string,
  from: string,
  qrBase64: string,
  html: string,
) {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `pix-created/${input.transactionId}`,
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `Seu Pix de ${formatBrl(input.amountCents)} foi gerado`,
      html,
      attachments: [
        {
          filename: "pix-qrcode.png",
          content: qrBase64,
          content_type: "image/png",
          content_id: "pix-qrcode",
        },
      ],
    }),
  });

  return response.ok;
}

export async function sendPixCreatedEmail(
  input: SendPixEmailInput,
  config: SendPixEmailConfig,
): Promise<boolean> {
  const to = input.to.trim();
  if (!validEmail(to)) return false;

  try {
    const qrDataUrl = await QRCode.toDataURL(input.pixCode, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const qrBase64 = qrDataUrl.split(",", 2)[1];
    if (!qrBase64) return false;

    const html = buildEmailHtml(input);

    // Sem domínio próprio: use uma conta Gmail existente + senha de app.
    if (config.gmailUser && config.gmailAppPassword) {
      return await sendViaGmailSmtp(
        input,
        config.gmailUser,
        config.gmailAppPassword,
        qrBase64,
        html,
      );
    }

    // Fallback opcional para quem configurar Resend depois.
    if (config.resendApiKey && config.resendFrom) {
      return await sendViaResend(
        input,
        config.resendApiKey,
        config.resendFrom,
        qrBase64,
        html,
      );
    }

    return false;
  } catch (error) {
    console.warn(`Falha ao preparar/enviar email do Pix da transação ${input.transactionId}.`, error);
    return false;
  }
}
