import { createServerFn } from "@tanstack/react-start";

// Gateway de pagamento: Invictus Pay.
import {
  createInvictusPixCharge,
  readInvictusPixStatus,
  type PixChargeInput,
  type PixChargeResult,
} from "./pix.server";
import { sendPixCreatedEmail } from "./pix-email.server";
import { sendPixCreatedToN8n } from "./pix-n8n.server";
import { recordPixGenerated } from "./funnel-events.server";

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: PixChargeInput) => data)
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiKey = process.env.INVICTUS_API_KEY?.trim();
    if (!apiKey) {
      throw new Error(
        "Invictus Pay não está configurada. Adicione INVICTUS_API_KEY nas variáveis de ambiente.",
      );
    }

    const result = await createInvictusPixCharge(data, {
      apiKey, postbackUrl: process.env.INVICTUS_POSTBACK_URL?.trim(),
    });
    const amountCents =
      Number.isFinite(data.amountCents) && (data.amountCents ?? 0) > 0
        ? Math.round(data.amountCents as number)
        : 6193;

    // Falhas de notificações ou analytics nunca invalidam o Pix.
    await Promise.allSettled([
      recordPixGenerated({
        sessionId: data.sessionId,
        transactionId: result.transactionId,
        itemId: data.itemId,
        itemTitle: data.itemTitle,
        amountCents,
        name: data.name,
        email: data.email,
        phone: data.phone,
        utm: data.utm,
      }),
      sendPixCreatedEmail(
        {
          to: data.email,
          customerName: data.name,
          itemTitle: data.itemTitle || "Produto",
          amountCents,
          pixCode: result.pixCode,
          transactionId: result.transactionId,
        },
        {
          mailjetApiKey: process.env.MAILJET_API_KEY,
          mailjetSecretKey: process.env.MAILJET_SECRET_KEY,
          fromEmail: process.env.PIX_EMAIL_FROM || "sitegrande@proton.me",
          fromName: process.env.PIX_EMAIL_FROM_NAME || "Pagamentos",
        },
      ),
      sendPixCreatedToN8n(
        {
          customerName: data.name,
          email: data.email,
          phone: data.phone,
          itemTitle: data.itemTitle || "Produto",
          itemId: data.itemId,
          itemImage: data.itemImage,
          amountCents,
          pixCode: result.pixCode,
          transactionId: result.transactionId,
        },
        process.env.N8N_PIX_WEBHOOK_URL ||
          "https://systemebr2.app.n8n.cloud/webhook-test/pix-gerado",
      ),
    ]);

    return result;
  });

export const getPixStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data }): Promise<{ status: string; paidAt?: string }> => {
    const apiKey = process.env.INVICTUS_API_KEY?.trim();
    if (!apiKey) return { status: "PENDING" };

    return readInvictusPixStatus(data.transactionId, apiKey);
  });
