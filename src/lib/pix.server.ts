const FORTPAY_BASE_URL = "https://api.plataformafortpay.com.br/api/public/v1";
const FORTPAY_PRODUCT_HASH = "txi2kwhf0r";
const FORTPAY_OFFER_HASH = "o9ybnwoyun";

export type PixChargeInput = {
  name: string;
  document: string;
  email: string;
  phone: string;
  utm?: string;
  amountCents?: number;
  itemTitle?: string;
  itemId?: string;
  itemImage?: string;
};

export type PixChargeResult = {
  pixCode: string;
  transactionId: string;
  createdAt: string;
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

  const pixCode = findPixCode(json);
  const transactionId = findStringByKeys(json, [
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

    const json = (await response.json()) as JsonRecord;
    const rawStatus = String(findStringByKeys(json, ["status"]) || "pending").toLowerCase();
    const status =
      rawStatus === "approved" || rawStatus === "paid" || rawStatus === "completed"
        ? "COMPLETED"
        : rawStatus === "refunded" ||
            rawStatus === "chargeback" ||
            rawStatus === "failed" ||
            rawStatus === "cancelled" ||
            rawStatus === "canceled"
          ? rawStatus.toUpperCase()
          : "PENDING";

    return {
      status,
      paidAt: findStringByKeys(json, ["paid_at", "paidAt", "approved_at"]),
    };
  } catch {
    return { status: "PENDING" };
  }
}
