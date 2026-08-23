import QRCode from "qrcode";

type SendPixEmailInput = {
  to: string;
  customerName: string;
  itemTitle: string;
  amountCents: number;
  pixCode: string;
  transactionId: string;
};

type SendPixEmailConfig = {
  brevoApiKey?: string;
  fromEmail?: string;
  fromName?: string;
};

const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

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
                <div style="font-size:14px;color:#666;">Olá, ${safeName}. Use o Pix abaixo para concluir o pagamento.</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px;text-align:center;">
                <div style="font-size:14px;color:#666;margin-bottom:4px;">${safeTitle}</div>
                <div style="font-size:28px;font-weight:700;">${amount}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 24px 28px;">
                <div style="font-size:14px;font-weight:700;margin-bottom:8px;">Pix Copia e Cola</div>
                <div style="font-size:12px;line-height:1.5;background:#f7f7f7;border:1px solid #e5e5e5;border-radius:8px;padding:14px;word-break:break-all;">${safePixCode}</div>
                <div style="font-size:12px;color:#888;margin-top:14px;">O QR Code do Pix está anexado a este e-mail como <strong>pix-qrcode.png</strong>.</div>
                <div style="font-size:12px;color:#888;margin-top:8px;">Transação: ${safeTransactionId}</div>
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

export async function sendPixCreatedEmail(
  input: SendPixEmailInput,
  config: SendPixEmailConfig,
): Promise<boolean> {
  const to = input.to.trim();
  const apiKey = config.brevoApiKey?.trim();
  const fromEmail = (config.fromEmail || "sitegrande@proton.me").trim();
  const fromName = (config.fromName || "Pagamentos").trim();

  if (!apiKey || !validEmail(to) || !validEmail(fromEmail)) return false;

  try {
    const qrDataUrl = await QRCode.toDataURL(input.pixCode, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const qrBase64 = qrDataUrl.split(",", 2)[1];
    if (!qrBase64) return false;

    const response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: fromName,
          email: fromEmail,
        },
        to: [{ email: to, name: input.customerName || "Cliente" }],
        subject: `Seu Pix de ${formatBrl(input.amountCents)} foi gerado`,
        htmlContent: buildEmailHtml(input),
        attachment: [
          {
            content: qrBase64,
            name: "pix-qrcode.png",
          },
        ],
        headers: {
          "X-Pix-Transaction-Id": input.transactionId,
        },
        tags: ["pix-gerado"],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.warn(
        `Brevo recusou o email do Pix (${response.status}) para ${input.transactionId}: ${body.slice(0, 300)}`,
      );
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Falha ao enviar email do Pix ${input.transactionId}.`, error);
    return false;
  }
}
