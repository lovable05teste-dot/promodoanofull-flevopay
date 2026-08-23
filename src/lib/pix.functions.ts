import { createServerFn } from "@tanstack/react-start";

// Gateway da cópia isolada: FlevoPay.
import {
  createFlevopayPixCharge,
  readFlevopayPixStatus,
  type PixChargeInput,
  type PixChargeResult,
} from "./pix.server";
import { sendPixCreatedEmail } from "./pix-email.server";

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: PixChargeInput) => data)
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiKey = process.env.FLEVOPAY_API_KEY;
    if (!apiKey) {
      throw new Error(
        "FlevoPay V2 não está configurada. Adicione FLEVOPAY_API_KEY no ambiente Preview da branch flevopay-v2.",
      );
    }

    const result = await createFlevopayPixCharge(data, {
      apiKey,
      baseUrl: process.env.FLEVOPAY_BASE_URL,
      postbackUrl: process.env.FLEVOPAY_POSTBACK_URL,
    });

    // O envio é best-effort: se o email falhar, o Pix continua válido
    // e segue aparecendo normalmente na página para o comprador.
    void sendPixCreatedEmail(
      {
        to: data.email,
        customerName: data.name,
        itemTitle: data.itemTitle || "Produto",
        amountCents:
          Number.isFinite(data.amountCents) && (data.amountCents ?? 0) > 0
            ? Math.round(data.amountCents as number)
            : 6193,
        pixCode: result.pixCode,
        transactionId: result.transactionId,
      },
      {
        // Funciona sem domínio próprio: Gmail + Senha de app.
        gmailUser: process.env.GMAIL_USER,
        gmailAppPassword: process.env.GMAIL_APP_PASSWORD,

        // Fallback opcional, caso Resend seja configurado no futuro.
        resendApiKey: process.env.RESEND_API_KEY,
        resendFrom: process.env.PIX_EMAIL_FROM,
      },
    );

    return result;
  });

export const getPixStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data }): Promise<{ status: string; paidAt?: string }> => {
    const apiKey = process.env.FLEVOPAY_API_KEY;
    if (!apiKey) return { status: "PENDING" };

    return readFlevopayPixStatus(
      data.transactionId,
      apiKey,
      process.env.FLEVOPAY_BASE_URL,
    );
  });
