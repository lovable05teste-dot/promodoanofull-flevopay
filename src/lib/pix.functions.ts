import { createServerFn } from "@tanstack/react-start";

// Gateway de pagamento: FortPay.
import {
  createFortpayPixCharge,
  readFortpayPixStatus,
  type PixChargeInput,
  type PixChargeResult,
} from "./pix.server";
import { sendPixCreatedEmail } from "./pix-email.server";
import { sendPixCreatedToN8n } from "./pix-n8n.server";
import {
  listFunnelEvents,
  recordPixGenerated,
} from "./funnel-events.server";

const PIX_PENDING_LIMIT = 3;

async function countPendingPixForSession(sessionId?: string) {
  if (!sessionId) return 0;
  try {
    const { events } = await listFunnelEvents();
    const paid = new Set(events.filter(event => event.type === "PixPaid").map(event => event.transactionId).filter(Boolean));
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return events.filter(event =>
      event.type === "PixGenerated" &&
      event.sessionId === sessionId &&
      (!event.transactionId || !paid.has(event.transactionId)) &&
      Date.parse(event.at) >= oneDayAgo
    ).length;
  } catch {
    return 0;
  }
}

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: PixChargeInput) => data)
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) {
      throw new Error(
        "FortPay não está configurada. Adicione FORTPAY_API_TOKEN nas variáveis de ambiente.",
      );
    }

    const pendingPix = await countPendingPixForSession(data.sessionId);
    if (pendingPix >= PIX_PENDING_LIMIT) {
      throw new Error(
        "Você já tem 3 Pix pendentes. Pague um dos Pix gerados ou aguarde antes de gerar outro.",
      );
    }

    const result = await createFortpayPixCharge(data, { apiToken });
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
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) return { status: "PENDING" };

    return readFortpayPixStatus(data.transactionId, apiToken);
  });
