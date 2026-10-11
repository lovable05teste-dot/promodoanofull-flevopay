const INVICTUS_BASE_URL = "https://api.invictuspayv2.com.br/api/v1";

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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transactionRecord(value: unknown): JsonRecord | undefined {
  const envelope = isRecord(value) && isRecord(value.data) ? value.data : value;
  const transaction = isRecord(envelope) && isRecord(envelope.transaction)
    ? envelope.transaction : envelope;
  return isRecord(transaction) ? transaction : undefined;
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
    "qrCode",
    "qrcode",
    "pixCode",
    "copyPaste",
    "brcode",
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

async function invictusFetch(path: string, init: RequestInit & { apiKey: string }) {
  const { apiKey, ...rest } = init;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const url = new URL(`${INVICTUS_BASE_URL}${path}`);
  try {
    return await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(rest.headers || {}),
        "X-Api-Key": apiKey,
      },
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("A Invictus Pay demorou para responder. Tente gerar o Pix novamente.");
    }
    throw new Error("Não foi possível conectar à Invictus Pay. Tente novamente.");
  } finally {
    clearTimeout(timeout);
  }
}

export async function createInvictusPixCharge(
  input: PixChargeInput,
  config: { apiKey: string; postbackUrl?: string },
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

  const amount = input.amountCents ?? 6193;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Valor do pagamento inválido. Informe um valor inteiro em centavos.");
  }

  const title = (input.itemTitle || "Produto").trim().slice(0, 120) || "Produto";
  const payload: JsonRecord = {
    amount,
    paymentMethod: "pix",
    customer: { name, email, document, phone },
    items: [{
      description: title,
      quantity: 1,
      amount,
      ...(input.itemId ? { externalRef: input.itemId } : {}),
    }],
    pix: { expirationInSeconds: 1800 },
  };
  if (config.postbackUrl) {
    const url = new URL(config.postbackUrl);
    if (url.protocol !== "https:") throw new Error("O postback da Invictus Pay deve usar HTTPS.");
    payload.postbackUrl = url.toString();
  }

  const response = await invictusFetch("/transactions", {
    apiKey: config.apiKey,
    method: "POST",
    body: JSON.stringify(payload),
  });
  const raw = await response.text();

  if (!response.ok) {
    throw new Error(
      `A Invictus Pay recusou a geração do Pix (${response.status})${safeGatewayMessage(raw)}`,
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error("A Invictus Pay retornou uma resposta inválida.");
  }

  const pixCode = findPixCode(json);
  // Read the transaction envelope before nested customer/item IDs.
  const transaction = transactionRecord(json);
  const transactionId = isRecord(transaction)
    ? findStringByKeys({ id: transaction.id, transactionId: transaction.transactionId,
        transaction_id: transaction.transaction_id }, ["id", "transactionId", "transaction_id"])
    : undefined;
  if (!pixCode || !transactionId) {
    throw new Error("A Invictus Pay não retornou o código Pix completo.");
  }

  return {
    pixCode,
    transactionId,
    createdAt: new Date().toISOString().slice(0, 19).replace("T", " "),
  };
}

export async function readInvictusPixStatus(transactionId: string, apiKey: string) {
  try {
    const path = `/transactions/${encodeURIComponent(transactionId)}`;
    const response = await invictusFetch(path, {
      apiKey,
      method: "GET",
    });
    if (!response.ok) return { status: "PENDING" };

    const json = (await response.json()) as JsonRecord;
    const rawStatus = String(transactionRecord(json)?.status || "pending").toLowerCase();
    const status =
      rawStatus === "paid"
        ? "COMPLETED"
        : rawStatus === "refused" ||
            rawStatus === "expired" ||
            rawStatus === "in_dispute" ||
            rawStatus === "pre_chargeback" ||
            rawStatus === "refunded" ||
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
