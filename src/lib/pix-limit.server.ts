import { createHmac, randomUUID } from "node:crypto";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { readFortpayPixStatus, type PixChargeInput, type PixChargeResult } from "./pix.server.ts";

export const MAX_PENDING_PIX = 3;
export const PIX_LIMIT_MESSAGE =
  "Você já tem 3 Pix aguardando pagamento. Pague um deles ou aguarde o vencimento para gerar outro.";
export const PIX_UNAVAILABLE_MESSAGE =
  "Não foi possível verificar suas tentativas de pagamento. Aguarde e tente novamente.";
const PROCESSING_MESSAGE = "Seu Pix já está sendo processado. Aguarde e tente novamente.";
// FortPay usa expire_in_days: 1. Uma resposta perdida continua ocupando a vaga.
const UNKNOWN_HOLD_MS = 24 * 60 * 60 * 1000 + 5 * 60 * 1000;
const TERMINAL = new Set([
  "COMPLETED",
  "EXPIRED",
  "REFUSED",
  "REFUNDED",
  "CHARGEBACK",
  "FAILED",
  "CANCELLED",
  "CANCELED",
]);
type Entry = {
  id: string;
  fingerprint: string;
  expiresAt: number;
  transactionId?: string;
  result?: PixChargeResult;
};
export type PixLedger = { version: 2; entries: Entry[] };
export type LedgerSnapshot = { ledger: PixLedger; etag: string | null };
export interface PixLimitStore {
  read(key: string): Promise<LedgerSnapshot>;
  // Compare-and-swap obrigatório, inclusive na primeira criação.
  write(key: string, ledger: PixLedger, etag: string | null): Promise<boolean>;
}
function credentials() {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return { token };
  if (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) return {};
  throw new Error(PIX_UNAVAILABLE_MESSAGE);
}
export const blobPixLimitStore: PixLimitStore = {
  async read(key) {
    const blob = await get(`pix-limits-v2/${key}.json`, {
      ...credentials(),
      access: "private",
      useCache: false,
      abortSignal: AbortSignal.timeout(8000),
    });
    if (!blob) return { ledger: { version: 2, entries: [] }, etag: null };
    if (blob.statusCode !== 200 || !blob.stream || !blob.blob.etag)
      throw new Error(PIX_UNAVAILABLE_MESSAGE);
    const ledger = (await new Response(blob.stream).json()) as PixLedger;
    if (
      ledger.version !== 2 ||
      !Array.isArray(ledger.entries) ||
      ledger.entries.length > MAX_PENDING_PIX ||
      ledger.entries.some(
        (entry) =>
          !entry ||
          typeof entry.id !== "string" ||
          typeof entry.fingerprint !== "string" ||
          !Number.isFinite(entry.expiresAt) ||
          (entry.transactionId !== undefined && typeof entry.transactionId !== "string") ||
          (entry.result !== undefined && entry.result.transactionId !== entry.transactionId),
      )
    )
      throw new Error(PIX_UNAVAILABLE_MESSAGE);
    return { ledger, etag: blob.blob.etag };
  },
  async write(key, ledger, etag) {
    try {
      await put(`pix-limits-v2/${key}.json`, JSON.stringify(ledger), {
        ...credentials(),
        access: "private",
        addRandomSuffix: false,
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: etag !== null,
        ...(etag ? { ifMatch: etag } : {}),
        abortSignal: AbortSignal.timeout(8000),
      });
      return true;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) return false;
      throw new Error(PIX_UNAVAILABLE_MESSAGE);
    }
  },
};
export function pixIdentityKeys(
  input: PixChargeInput,
  ip: string,
  secret: string,
  browserId?: string,
) {
  if (!ip || !secret) throw new Error(PIX_UNAVAILABLE_MESSAGE);
  const digest = (kind: string, value: string) =>
    `${kind}-${createHmac("sha256", secret).update(`${kind}:${value}`).digest("hex")}`;
  // A sessão enviada pelo cliente não autoriza criar novas cobranças.
  return [
    digest("ip", ip),
    digest("document", input.document),
    digest("email", input.email.toLowerCase()),
    digest("phone", input.phone),
    ...(browserId ? [digest("browser", browserId)] : []),
  ];
}
export function pixFingerprint(input: PixChargeInput, secret: string, scope = "checkout") {
  // Reload, UTM, IP e cookie não alteram a identidade do mesmo pedido.
  return createHmac("sha256", secret)
    .update(
      JSON.stringify({
        scope,
        document: input.document,
        email: input.email.toLowerCase(),
        phone: input.phone,
        name: input.name,
        amount: input.amountCents ?? 6193,
        item: input.itemId ?? "6549324",
        contentIds: [...new Set(input.contentIds ?? [input.itemId ?? "6549324"])].sort(),
        numItems: input.numItems ?? 1,
      }),
    )
    .digest("hex");
}
export function createPixLimiter(deps: {
  store: PixLimitStore;
  status: (transactionId: string) => Promise<{ status: string }>;
  now?: () => number;
  id?: () => string;
}) {
  const now = deps.now ?? Date.now;
  const newId = deps.id ?? randomUUID;
  async function mutate<T>(
    key: string,
    transform: (entries: Entry[]) => Promise<{ entries: Entry[]; value: T }>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const snapshot = await deps.store.read(key);
      const next = await transform(snapshot.ledger.entries);
      if (await deps.store.write(key, { version: 2, entries: next.entries }, snapshot.etag))
        return next.value;
    }
    throw new Error(PROCESSING_MESSAGE);
  }
  async function refresh(entries: Entry[], cache: Map<string, Promise<{ status: string }>>) {
    const statuses = await Promise.all(
      entries.map(async (entry) => {
        if (!entry.transactionId) return now() >= entry.expiresAt;
        // Falha/estado desconhecido nunca libera vaga. Expiração confirmada pela FortPay.
        try {
          if (!cache.has(entry.transactionId))
            cache.set(entry.transactionId, deps.status(entry.transactionId));
          return TERMINAL.has((await cache.get(entry.transactionId)!).status);
        } catch {
          return false;
        }
      }),
    );
    return entries.filter((_, index) => !statuses[index]);
  }
  return async function generate(
    keys: string[],
    fingerprint: string,
    charge: () => Promise<PixChargeResult>,
  ): Promise<{ result: PixChargeResult; reused: boolean }> {
    if (!keys.length || new Set(keys).size !== keys.length)
      throw new Error(PIX_UNAVAILABLE_MESSAGE);
    const reservation: Entry = { id: newId(), fingerprint, expiresAt: now() + UNKNOWN_HOLD_MS };
    const reserved: string[] = [];
    const statusCache = new Map<string, Promise<{ status: string }>>();
    let gatewayStarted = false;
    try {
      for (const key of keys) {
        const existing = await mutate<PixChargeResult | undefined>(key, async (prior) => {
          const entries = await refresh(prior, statusCache);
          const duplicate = entries.find((entry) => entry.fingerprint === fingerprint);
          if (duplicate?.result) return { entries, value: duplicate.result };
          if (duplicate) throw new Error(PROCESSING_MESSAGE);
          if (entries.length >= MAX_PENDING_PIX) throw new Error(PIX_LIMIT_MESSAGE);
          return { entries: [...entries, reservation], value: undefined };
        });
        if (existing) {
          await release();
          return { result: existing, reused: true };
        }
        reserved.push(key);
      }
      // Todas as identidades persistidas antes do POST externo.
      gatewayStarted = true;
      const result = await charge();
      if (!result.transactionId || !result.pixCode) throw new Error(PIX_UNAVAILABLE_MESSAGE);
      const saved = await Promise.allSettled(
        reserved.map((key) =>
          mutate(key, async (entries) => {
            if (!entries.some((entry) => entry.id === reservation.id))
              throw new Error(PIX_UNAVAILABLE_MESSAGE);
            return {
              entries: entries.map((entry) =>
                entry.id === reservation.id
                  ? { ...entry, transactionId: result.transactionId, result }
                  : entry,
              ),
              value: true,
            };
          }),
        ),
      );
      // Falha final não apaga reservas nem repete o POST na FortPay.
      if (saved.every((item) => item.status === "rejected"))
        throw new Error(PIX_UNAVAILABLE_MESSAGE);
      if (saved.some((item) => item.status === "rejected"))
        console.error("Pix limit: incomplete final persistence; reservations retained");
      return { result, reused: false };
    } catch (error) {
      if (!gatewayStarted) await release();
      if (
        error instanceof Error &&
        [PIX_LIMIT_MESSAGE, PROCESSING_MESSAGE, PIX_UNAVAILABLE_MESSAGE].includes(error.message)
      )
        throw error;
      throw new Error(PIX_UNAVAILABLE_MESSAGE);
    }
    async function release() {
      // Remove somente a nossa reserva. Falhas permanecem retidas.
      await Promise.allSettled(
        reserved.map((key) =>
          mutate(key, async (entries) => ({
            entries: entries.filter((entry) => entry.id !== reservation.id),
            value: true,
          })),
        ),
      );
    }
  };
}
export async function generateLimitedPix(
  input: PixChargeInput,
  ip: string,
  secret: string,
  apiToken: string,
  charge: () => Promise<PixChargeResult>,
  browserId?: string,
  scope?: string,
) {
  const generate = createPixLimiter({
    store: blobPixLimitStore,
    status: (id) => readFortpayPixStatus(id, apiToken),
  });
  return generate(
    pixIdentityKeys(input, ip, secret, browserId),
    pixFingerprint(input, secret, scope),
    charge,
  );
}
