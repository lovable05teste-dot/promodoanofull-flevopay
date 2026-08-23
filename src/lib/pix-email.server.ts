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
  apiKey?: string;
  from?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function escapeHtml(value: string) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
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

export async function sendPixCreatedEmail(
  input: SendPixEmailInput,
  config: SendPixEmailConfig,
): Promise<boolean> {
  const apiKey = config.apiKey?.trim();
  const from = config.from?.trim();
  const to = input.to.trim();

  // O Pix nunca deve falhar só porque o provedor de email não está configurado.
  if (!apiKey || !from || !validEmail(to)) return false;

  try {
    const qrDataUrl = await QRCode.toDataURL(input.pixCode, {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
    });
    const qrBase64 = qrDataUrl.split(",", 2)[1];
    if (!qrBase64) return false;

    const safeName = escapeHtml(input.customerName || "Cliente");
    const safeTitle = escapeHtml(input.itemTitle || "Produto");
    const safePixCode = escapeHtml(input.pixCode);
    const safeTransactionId = escapeHtml(input.transactionId);
    const amount = formatBrl(input.amountCents);

    const html = `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#222;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f5f5f5;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e7e7;">
            <tr>
              <td style="padding:28px 24px 12px;text-align:center;">
                <div style="font-size:22px;font-weight:700;margin-bottom:8px;">Seu Pix foi gerado</div>
                <div style="font-size:14px;color:#666;">Olá, ${safeName}. Use o QR Code ou o Pix Copia e Cola abaixo.</div>
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

    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `pix-created/${input.transactionId}`,
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Seu Pix de ${amount} foi gerado`,
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

    if (!response.ok) {
      console.warn(`Falha ao enviar email do Pix (${response.status}) para a transação ${input.transactionId}.`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn(`Falha ao preparar/enviar email do Pix da transação ${input.transactionId}.`, error);
    return false;
  }
}
