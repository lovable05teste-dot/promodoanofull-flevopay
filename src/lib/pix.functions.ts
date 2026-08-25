import { createServerFn } from "@tanstack/react-start";

// Gateway de pagamento: FortPay.
import {
  createFortpayPixCharge,
  readFortpayPixStatus,
  type PixChargeInput,
  type PixChargeResult,
} from "./pix.server";
import { sendPixCreatedEmail } from "./pix-email.server";

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: PixChargeInput) => data)
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) {
      throw new Error(
        "FortPay não está configurada. Adicione FORTPAY_API_TOKEN nas variáveis de ambiente.",
      );
    }

    const result = await createFortpayPixCharge(data, { apiToken });

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
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) return { status: "PENDING" };

    return readFortpayPixStatus(data.transactionId, apiToken);
  });
