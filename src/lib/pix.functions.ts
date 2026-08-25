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

    // Aguarda a tentativa de envio para evitar que um runtime serverless finalize
    // a execução antes do disparo. Falha no email nunca invalida o Pix.
    await sendPixCreatedEmail(
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
        mailjetApiKey: process.env.MAILJET_API_KEY,
        mailjetSecretKey: process.env.MAILJET_SECRET_KEY,
        fromEmail: process.env.PIX_EMAIL_FROM || "sitegrande@proton.me",
        fromName: process.env.PIX_EMAIL_FROM_NAME || "Pagamentos",
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
