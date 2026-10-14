import { readFortpayPixStatus } from "./pix.server";

// Cada Pix gerado fica registrado por sessão até ser pago ou vencer.
// Com MAX_PENDING_PIX pendentes, a sessão não gera outro Pix.
export const MAX_PENDING_PIX = 3;
export const PIX_LIMIT_MESSAGE =
  "Você já tem 3 Pix aguardando pagamento. Pague um deles ou aguarde o vencimento para gerar outro.";

const PREFIX = "pix-pending/";

function token() { return process.env.BLOB_READ_WRITE_TOKEN?.trim() || ""; }

function blobHeaders(value: string, extra: Record<string, string> = {}) {
  const storeId = value.split("_")[3];
  if (!storeId) throw new Error("BLOB_READ_WRITE_TOKEN inválido.");
  return { authorization: `Bearer ${value}`, "x-api-version": "12", "x-vercel-blob-store-id": storeId, ...extra };
}

function safeSession(id: unknown): string {
  const value = typeof id === "string" ? id : "";
  return /^[a-zA-Z0-9_-]{16,90}$/.test(value) ? value : "";
}

function safeTransaction(id: unknown): string {
  const value = typeof id === "string" ? id : "";
  return /^[a-zA-Z0-9_-]{1,120}$/.test(value) ? value : "";
}

/** Lança erro se a sessão já tem MAX_PENDING_PIX Pix pendentes. Sem armazenamento, não bloqueia. */
export async function assertPixAllowed(sessionId: unknown, apiToken: string): Promise<void> {
  const key = token();
  const session = safeSession(sessionId);
  if (!key || !session) return;

  const listUrl = new URL("https://vercel.com/api/blob");
  listUrl.searchParams.set("prefix", `${PREFIX}${session}/`);
  listUrl.searchParams.set("limit", "50");
  const response = await fetch(listUrl, { headers: blobHeaders(key) });
  if (!response.ok) return;
  const { blobs = [] } = await response.json() as { blobs?: Array<{ pathname: string }> };
  if (blobs.length < MAX_PENDING_PIX) return;

  const statuses = await Promise.all(blobs.map(blob => {
    const transactionId = safeTransaction(blob.pathname.split("/").pop()?.replace(/\.json$/, ""));
    return transactionId ? readFortpayPixStatus(transactionId, apiToken) : Promise.resolve({ status: "COMPLETED" });
  }));
  const pending = statuses.filter(item => item.status === "PENDING").length;
  if (pending >= MAX_PENDING_PIX) throw new Error(PIX_LIMIT_MESSAGE);
}

/** Registra um Pix recém-gerado como pendente. Falhas aqui nunca cancelam a cobrança. */
export async function registerPendingPix(sessionId: unknown, transactionId: unknown): Promise<boolean> {
  const key = token();
  const session = safeSession(sessionId);
  const transaction = safeTransaction(transactionId);
  if (!key || !session || !transaction) return false;

  const url = new URL("https://vercel.com/api/blob/");
  url.searchParams.set("pathname", `${PREFIX}${session}/${transaction}.json`);
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: blobHeaders(key, {
        "x-vercel-blob-access": "private",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
        "x-content-type": "application/json",
      }),
      body: JSON.stringify({ transactionId: transaction, at: new Date().toISOString() }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
