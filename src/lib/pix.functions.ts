import { createServerFn } from "@tanstack/react-start";

// Gateway de pagamento: FortPay.
import {
  createFortpayPixCharge,
  readFortpayPixStatus,
  validatePixInput,
  type PixChargeInput,
  type PixChargeResult,
} from "./pix.server";
import { sendPixCreatedEmail } from "./pix-email.server";
import { sendPixCreatedToN8n } from "./pix-n8n.server";
import { recordPixGenerated } from "./funnel-events.server";
import { generateLimitedPix } from "./pix-limit.server";
import { pixRequestContext } from "./pix-request.server";
import { authorizeUpsell } from "./upsell.server";
import { verifyUpsellContext } from "./upsell-token.server";

export const createPixCharge = createServerFn({ method: "POST" })
  .validator((data: PixChargeInput) => validatePixInput(data))
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) {
      throw new Error(
        "FortPay não está configurada. Adicione FORTPAY_API_TOKEN nas variáveis de ambiente.",
      );
    }

    const context = pixRequestContext(apiToken);
    const { result, reused } = await generateLimitedPix(
      data,
      context.ip,
      context.secret,
      apiToken,
      () => createFortpayPixCharge(data, { apiToken }),
      context.browserId,
    );
    if (reused) return result;
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

export const createUpsellPixCharge = createServerFn({ method: "POST" })
  .validator(
    (data: {
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
    }) => {
      if (
        !data ||
        typeof data.parentToken !== "string" ||
        data.parentToken.length > 8192 ||
        typeof data.offerId !== "string" ||
        data.offerId.length > 80
      )
        throw new Error("Oferta inválida.");
      const customer = validatePixInput({
        ...data.customer,
        sessionId: data.sessionId,
        utm: data.utm,
      });
      return {
        parentToken: data.parentToken,
        offerId: data.offerId,
        sessionId: customer.sessionId,
        utm: customer.utm,
        customer: {
          name: customer.name,
          document: customer.document,
          email: customer.email,
          phone: customer.phone,
        },
      };
    },
  )
  .handler(async ({ data }): Promise<PixChargeResult> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) {
      throw new Error(
        "FortPay não está configurada. Adicione FORTPAY_API_TOKEN nas variáveis de ambiente.",
      );
    }

    const input = validatePixInput(await authorizeUpsell(data, apiToken));
    const parent = verifyUpsellContext(data.parentToken, apiToken);
    const context = pixRequestContext(apiToken);
    const { result } = await generateLimitedPix(
      input,
      context.ip,
      context.secret,
      apiToken,
      () => createFortpayPixCharge(input, { apiToken }),
      context.browserId,
      `upsell:${parent.transactionId}`,
    );
    return result;
  });

export const getPixStatus = createServerFn({ method: "GET" })
  .validator((data: { transactionId: string }) => {
    if (
      !data ||
      typeof data.transactionId !== "string" ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(data.transactionId)
    )
      throw new Error("Transação inválida.");
    return { transactionId: data.transactionId };
  })
  .handler(async ({ data }): Promise<{ status: string; paidAt?: string }> => {
    const apiToken = process.env.FORTPAY_API_TOKEN?.trim();
    if (!apiToken) return { status: "PENDING" };

    return readFortpayPixStatus(data.transactionId, apiToken);
  });
