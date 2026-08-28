import QRCode from "qrcode";
import { normalizePhone } from "./pix.server";

type PixWhatsAppInput = {
  phone: string;
  customerName: string;
  itemTitle: string;
  amountCents: number;
  pixCode: string;
  transactionId: string;
};

type PixWhatsAppConfig = {
  accessToken?: string;
  phoneNumberId?: string;
  templateName?: string;
  languageCode?: string;
  graphVersion?: string;
  includeQrHeader?: boolean;
};

type WhatsAppSendResult = {
  sent: boolean;
  skipped?: boolean;
  messageId?: string;
  error?: string;
};

function formatPhoneForWhatsApp(value: string) {
  const local = normalizePhone(value);
  if (local.length !== 10 && local.length !== 11) return "";
  return `55${local}`;
}

function formatCurrency(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

function safeErrorMessage(value: unknown) {
  if (!value || typeof value !== "object") return "Erro desconhecido ao enviar WhatsApp.";
  const record = value as Record<string, unknown>;
  const error = record.error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message.slice(0, 300);
  }
  return "Erro desconhecido ao enviar WhatsApp.";
}

async function uploadPixQrCode(args: {
  accessToken: string;
  phoneNumberId: string;
  graphVersion: string;
  pixCode: string;
  transactionId: string;
}) {
  const png = await QRCode.toBuffer(args.pixCode, {
    type: "png",
    width: 640,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", "image/png");
  form.set(
    "file",
    new Blob([png], { type: "image/png" }),
    `pix-${args.transactionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "qrcode"}.png`,
  );

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(args.graphVersion)}/${encodeURIComponent(args.phoneNumberId)}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${args.accessToken}` },
      body: form,
    },
  );

  const raw = await response.text();
  let json: unknown = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(json ? safeErrorMessage(json) : `Falha ao enviar QR (${response.status}).`);
  }

  const id =
    json && typeof json === "object" && typeof (json as Record<string, unknown>).id === "string"
      ? String((json as Record<string, unknown>).id)
      : "";
  if (!id) throw new Error("WhatsApp não retornou o ID da mídia do QR Code.");
  return id;
}

/**
 * Envia uma mensagem transacional pelo WhatsApp Cloud API usando template aprovado.
 *
 * Template esperado:
 *  - cabeçalho IMAGE (quando includeQrHeader=true)
 *  - corpo com:
 *    {{1}} nome do cliente
 *    {{2}} nome do produto
 *    {{3}} valor formatado
 *    {{4}} Pix copia e cola
 *    {{5}} id da transação
 *
 * Se as credenciais não estiverem configuradas, a função apenas ignora o envio.
 * Falhas no WhatsApp nunca invalidam a geração do Pix.
 */
export async function sendPixCreatedWhatsApp(
  input: PixWhatsAppInput,
  config: PixWhatsAppConfig,
): Promise<WhatsAppSendResult> {
  const accessToken = config.accessToken?.trim();
  const phoneNumberId = config.phoneNumberId?.trim();
  const templateName = config.templateName?.trim() || "pix_gerado";
  const languageCode = config.languageCode?.trim() || "pt_BR";
  const graphVersion = config.graphVersion?.trim() || "v23.0";
  const includeQrHeader = config.includeQrHeader !== false;

  if (!accessToken || !phoneNumberId) {
    return { sent: false, skipped: true };
  }

  const to = formatPhoneForWhatsApp(input.phone);
  if (!to) {
    return { sent: false, error: "Telefone inválido para WhatsApp." };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const components: Array<Record<string, unknown>> = [];

    if (includeQrHeader) {
      const mediaId = await uploadPixQrCode({
        accessToken,
        phoneNumberId,
        graphVersion,
        pixCode: input.pixCode,
        transactionId: input.transactionId,
      });
      components.push({
        type: "header",
        parameters: [{ type: "image", image: { id: mediaId } }],
      });
    }

    components.push({
      type: "body",
      parameters: [
        { type: "text", text: input.customerName.trim().slice(0, 120) },
        { type: "text", text: input.itemTitle.trim().slice(0, 180) },
        { type: "text", text: formatCurrency(input.amountCents) },
        { type: "text", text: input.pixCode.trim() },
        { type: "text", text: input.transactionId.trim().slice(0, 180) },
      ],
    });

    const response = await fetch(
      `https://graph.facebook.com/${encodeURIComponent(graphVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
        signal: controller.signal,
      },
    );

    const raw = await response.text();
    let json: unknown = null;
    try {
      json = raw ? JSON.parse(raw) : null;
    } catch {
      json = null;
    }

    if (!response.ok) {
      return {
        sent: false,
        error: json ? safeErrorMessage(json) : `WhatsApp API respondeu ${response.status}.`,
      };
    }

    const record = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
    const messages = record?.messages;
    const first = Array.isArray(messages) ? messages[0] : null;
    const messageId =
      first && typeof first === "object" && typeof (first as Record<string, unknown>).id === "string"
        ? String((first as Record<string, unknown>).id)
        : undefined;

    return { sent: true, messageId };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { sent: false, error: "Timeout ao enviar mensagem pelo WhatsApp." };
    }
    return {
      sent: false,
      error: error instanceof Error ? error.message.slice(0, 300) : "Falha ao enviar WhatsApp.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
