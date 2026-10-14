import { signUpsellContext } from "./upsell-token.server.ts";
import { z } from "zod";

const FORTPAY_BASE_URL = "https://api.fortpayplataforma.com.br/api/public/v1";
const FORTPAY_PRODUCT_HASH = "txi2kwhf0r";
const FORTPAY_OFFER_HASH = "o9ybnwoyun";

export type PixChargeInput = {
  sessionId?: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  utm?: string;
  amountCents?: number;
  itemTitle?: string;
  itemId?: string;
  itemImage?: string;
  contentIds?: string[];
  numItems?: number;
};

export type PixChargeResult = {
  pixCode: string;
  transactionId: string;
  createdAt: string;
  expiresAt: string;
  amountCents: number;
  contentIds: string[];
  itemTitle: string;
  numItems: number;
  upsellToken?: string;
};

type JsonRecord = Record<string, unknown>;

export const onlyDigits = (value: string) => (value || "").replace(/\D+/g, "");

export function normalizePhone(value: string) {
  let phone = onlyDigits(value);
  if (phone.length > 11 && phone.startsWith("55")) phone = phone.slice(2);
  while (phone.length > 11 && phone.startsWith("0")) phone = phone.slice(1);
  if (phone.length === 12 && phone.startsWith("0")) phone = phone.slice(1);
  return phone;
}

const pixInputSchema = z.object({
  sessionId: z.string().max(90).optional(),
  name: z.string().trim().min(1).max(120),
  document: z
    .string()
    .max(32)
    .transform(onlyDigits)
    .refine((value) => value.length === 11 || value.length === 14),
  email: z
    .string()
    .trim()
    .max(254)
    .email()
    .transform((value) => value.toLowerCase()),
  phone: z
    .string()
    .max(32)
    .transform(normalizePhone)
    .refine((value) => value.length === 10 || value.length === 11),
  utm: z.string().max(4096).optional(),
  amountCents: z.number().int().min(1).max(100000000).optional(),
  itemTitle: z.string().trim().max(120).optional(),
  itemId: z.string().trim().min(1).max(80).optional(),
  itemImage: z.string().max(2048).optional(),
  contentIds: z.array(z.string().trim().min(1).max(80)).min(1).max(50).optional(),
  numItems: z.number().int().min(1).max(100).optional(),
});

export function validatePixInput(input: unknown): PixChargeInput {
  const parsed = pixInputSchema.safeParse(input);
  if (!parsed.success)
    throw new Error("Dados de pagamento inválidos. Confira nome, CPF/CNPJ, e-mail e telefone.");
  return parsed.data;
}

function buildTracking(utm?: string): Record<string, string> {
  const params = new URLSearchParams((utm || "").replace(/^\?/, ""));
  const tracking: Record<string, string> = {};
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
    "src",
    "sck",
  ]) {
    const value = params.get(key)?.trim();
    if (value) tracking[key] = value;
  }
  if (!tracking.utm_source && tracking.src) tracking.utm_source = tracking.src;
  if (!tracking.src && tracking.utm_source) tracking.src = tracking.utm_source;
  return tracking;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findStringByKeys(value: unknown, keys: string[]): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKeys(item, keys);
      if (found) return found;
    }
    return undefined;
  }
  if (!isRecord(value)) return undefined;

  for (const key of keys) {
    const direct = value[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    if (typeof direct === "number" && Number.isFinite(direct)) return String(direct);
  }
  for (const nested of Object.values(value)) {
    const found = findStringByKeys(nested, keys);
    if (found) return found;
  }
  return undefined;
}

function findPixCode(value: unknown) {
  return findStringByKeys(value, [
    "qr_code",
    "pix_code",
    "pix_qr_code",
    "copy_paste",
    "copia_cola",
    "payload",
  ]);
}

// IDs/status vêm somente do objeto da transação, nunca de cliente/item.
function transactionRecord(value: unknown): JsonRecord {
  if (!isRecord(value)) return {};
  for (const key of ["transaction", "charge"]) {
    if (isRecord(value[key])) return transactionRecord(value[key]);
  }
  if (isRecord(value.data)) return transactionRecord(value.data);
  return value;
}

function transactionString(value: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const item = value[key];
    if (
      (typeof item === "string" && item.trim()) ||
      (typeof item === "number" && Number.isFinite(item))
    )
      return String(item).trim();
  }
  return undefined;
}

function safeGatewayMessage(raw: string) {
  try {
    const data = JSON.parse(raw) as JsonRecord;
    const message = findStringByKeys(data, ["message", "error"]);
    return message ? `: ${message.slice(0, 160)}` : "";
  } catch {
    return "";
  }
}

async function fortpayFetch(path: string, init: RequestInit & { apiToken: string }) {
  const { apiToken, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const url = new URL(`${FORTPAY_BASE_URL}${path}`);
  // A FortPay exige o token como query parameter em todos os endpoints,
  // inclusive no POST de criação da transação.
  url.searchParams.set("api_token", apiToken);
  try {
    return await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(rest.headers || {}),
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A FortPay demorou para responder. Tente gerar o Pix novamente.");
    }
    throw new Error("Não foi possível conectar à FortPay. Tente novamente.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function createFortpayPixCharge(
  input: PixChargeInput,
  config: { apiToken: string },
): Promise<PixChargeResult> {
  input = validatePixInput(input);
  const name = (input.name || "").trim();
  const document = onlyDigits(input.document);
  const email = (input.email || "").trim();
  const phone = normalizePhone(input.phone);

  if (!name) throw new Error("Nome é obrigatório.");
  if (document.length !== 11 && document.length !== 14) {
    throw new Error("CPF/CNPJ inválido. Informe apenas os números do documento.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email inválido.");
  if (phone.length !== 10 && phone.length !== 11) {
    throw new Error("Telefone inválido. Informe DDD + número.");
  }

  const amount =
    Number.isFinite(input.amountCents) && (input.amountCents ?? 0) > 0
      ? Math.round(input.amountCents as number)
      : 6193;

  const title = (input.itemTitle || "Produto").slice(0, 120);
  const payload: JsonRecord = {
    amount,
    offer_hash: FORTPAY_OFFER_HASH,
    payment_method: "pix",
    expire_in_days: 1,
    transaction_origin: "api",
    customer: {
      name,
      email,
      document,
      phone_number: phone,
    },
    cart: [
      {
        product_hash: FORTPAY_PRODUCT_HASH,
        price: amount,
        quantity: 1,
        operation_type: 1,
        tangible: true,
        title,
        ...(input.itemImage?.startsWith("https://") ? { cover: input.itemImage } : {}),
      },
    ],
  };

  const tracking = buildTracking(input.utm);
  if (Object.keys(tracking).length) payload.tracking = tracking;

  const response = await fortpayFetch("/transactions", {
    apiToken: config.apiToken,
    method: "POST",
    body: JSON.stringify(payload),
  });
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `A FortPay recusou a geração do Pix (${response.status})${safeGatewayMessage(raw)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("A FortPay retornou uma resposta inválida.");
  }

  const transaction = transactionRecord(json);
  const pixCode = findPixCode(transaction.pix || transaction.payment || transaction);
  const transactionId = transactionString(transaction, [
    "transaction_hash",
    "transaction_id",
    "hash",
    "id",
  ]);
  if (!pixCode || !transactionId) {
    throw new Error("A FortPay não retornou o código Pix completo.");
  }

  return {
    pixCode,
    transactionId,
    createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    amountCents: amount,
    contentIds: [
      ...new Set(
        (input.contentIds?.length ? input.contentIds : [input.itemId || "6549324"])
          .map(String)
          .map((id) => id.trim().slice(0, 80))
          .filter(Boolean),
      ),
    ],
    itemTitle: title,
    numItems: Number.isFinite(input.numItems) ? Math.max(1, Math.round(input.numItems!)) : 1,
    upsellToken: signUpsellContext(
      {
        transactionId,
        contentIds: [
          ...new Set(input.contentIds?.length ? input.contentIds : [input.itemId || "6549324"]),
        ],
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      },
      config.apiToken,
    ),
  };
}

export async function readFortpayPixStatus(transactionId: string, apiToken: string) {
  try {
    const path = `/transactions/${encodeURIComponent(transactionId)}`;
    const response = await fortpayFetch(path, {
      apiToken,
      method: "GET",
    });
    if (!response.ok) return { status: "PENDING" };

    const json = transactionRecord(await response.json());
    const rawStatus = String(transactionString(json, ["status"]) || "pending").toLowerCase();
    const status =
      rawStatus === "approved" || rawStatus === "paid" || rawStatus === "completed"
        ? "COMPLETED"
        : rawStatus === "expired" ||
            rawStatus === "refused" ||
            rawStatus === "refunded" ||
            rawStatus === "chargeback" ||
            rawStatus === "failed" ||
            rawStatus === "cancelled" ||
            rawStatus === "canceled"
          ? rawStatus.toUpperCase()
          : "PENDING";

    return {
      status,
      paidAt: transactionString(json, ["paid_at", "paidAt", "approved_at"]),
    };
  } catch {
    return { status: "PENDING" };
  }
}
