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
import { recordPixGenerated } from "./funnel-events.server";
import { assertPixAllowed, registerPendingPix } from "./pix-limit.server";
import { UPSELL_OFFERS } from "./upsell-catalog";

export const createPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: PixChargeInput) => data)
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) {
      throw new Error(
        "FortPay não está configurada. Adicione FORTPAY_API_TOKEN nas variáveis de ambiente.",
      );
    }

    await assertPixAllowed(data.sessionId, apiToken);
    const result = await createFortpayPixCharge(data, { apiToken });
    const amountCents =
      Number.isFinite(data.amountCents) && (data.amountCents ?? 0) > 0
        ? Math.round(data.amountCents as number)
        : 6193;

    // Falhas de notificações ou analytics nunca invalidam o Pix.
    await Promise.allSettled([
      registerPendingPix(data.sessionId, result.transactionId),
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


export const createUpsellPixCharge = createServerFn({ method: "POST" })
  .inputValidator((data: {
    parentToken: string;
    offerId: string;
    sessionId?: string;
    utm?: string;
    customer: {
      name: string;
      document: string;
      email: string;
      phone: string;
    };
  }) => data)
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) {
      throw new Error(
        "FortPay não está configurada. Adicione FORTPAY_API_TOKEN nas variáveis de ambiente.",
      );
    }

    if (!data.parentToken?.trim()) {
      throw new Error("Compra principal não encontrada para gerar o complemento.");
    }

    const offer = UPSELL_OFFERS.find((item) => item.id === data.offerId);
    if (!offer) {
      throw new Error("Complemento não encontrado.");
    }

    return createFortpayPixCharge(
      {
        sessionId: data.sessionId,
        name: data.customer.name,
        document: data.customer.document,
        email: data.customer.email,
        phone: data.customer.phone,
        utm: data.utm,
        amountCents: offer.priceCents,
        itemTitle: offer.title,
        itemId: offer.id,
        itemImage: offer.image,
        contentIds: [offer.id],
        numItems: 1,
      },
      { apiToken },
    );
  });

export const getPixStatus = createServerFn({ method: "GET" })
  .inputValidator((data: { transactionId: string }) => data)
  .handler(async ({ data }): Promise<{ status: string; paidAt?: string }> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) return { status: "PENDING" };

    return readFortpayPixStatus(data.transactionId, apiToken);
  });
