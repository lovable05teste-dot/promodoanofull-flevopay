/**
 * Registro first-party do funil. Não armazena IP completo, CPF, cartão, CVV
 * nem o código copia-e-cola do Pix. Arquivos ficam em Vercel Blob privado.
 * Para alto volume, migre analytics/events para um banco com índices.
 */
export type FunnelEvent = {
  id: string;
  type: "InitiateCheckout" | "CustomerIdentified" | "PixGenerated" | "PixPaid";
  at: string;
  sessionId: string;
  productId: string;
  productName: string;
  amountCents: number;
  transactionId?: string;
  customer?: { name: string; email: string; phone: string };
  traffic?: Record<string, string>;
  location?: { maskedIp: string; city: string; region: string; country: string };
};

const PREFIX = "analytics/events/";
const ALLOWED_UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "src", "sck"] as const;

function token() { return process.env.BLOB_READ_WRITE_TOKEN?.trim() || ""; }
function blobHeaders(value: string, extra: Record<string, string> = {}) {
  const storeId = value.split("_")[3];
  if (!storeId) throw new Error("BLOB_READ_WRITE_TOKEN inválido.");
  return { authorization: `Bearer ${value}`, "x-api-version": "12", "x-vercel-blob-store-id": storeId, ...extra };
}
function text(value: unknown, limit = 160) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}
function safeSession(id: unknown): string {
  const value = text(id, 90);
  return /^[a-zA-Z0-9_-]{16,90}$/.test(value) ? value : "";
}
function trafficParams(input: unknown): Record<string, string> {
  const data = typeof input === "string" ? Object.fromEntries(new URLSearchParams(input)) :
    input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const safe: Record<string, string> = {};
  for (const key of ALLOWED_UTM) {
    const value = text(data[key], 150);
    if (value) safe[key] = value;
  }
  return safe;
}
function decodeGeo(value: string | null) {
  try { return decodeURIComponent(value || "").slice(0, 90); }
  catch { return (value || "").slice(0, 90); }
}
function maskIp(raw: string) {
  const ip = raw.trim().replace(/^\[|\]$/g, "");
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    const octets = ip.split(".").map(Number);
    if (octets.every(n => n >= 0 && n <= 255)) return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
  }
  if (/^[0-9a-f:]+$/i.test(ip) && ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean).slice(0, 3);
    return parts.length === 3 ? `${parts.join(":")}::/48` : "IPv6 mascarado";
  }
  return "";
}
function requestLocation(request: Request) {
  const h = request.headers;
  // Dados de geolocalização fornecidos pela Vercel; aproximados e nem sempre presentes.
  const rawIp = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0] || "";
  return {
    maskedIp: maskIp(rawIp),
    city: decodeGeo(h.get("x-vercel-ip-city")),
    region: decodeGeo(h.get("x-vercel-ip-country-region")),
    country: decodeGeo(h.get("x-vercel-ip-country")),
  };
}
export function storageConfigured() { return Boolean(token()); }

/** Nunca interrompa a cobrança caso o armazenamento de analytics falhe. */
export async function saveFunnelEvent(event: Omit<FunnelEvent, "id" | "at">) {
  const key = token();
  if (!key) return false;
  const record: FunnelEvent = { ...event, id: crypto.randomUUID(), at: new Date().toISOString() };
  const url = new URL("https://vercel.com/api/blob/");
  url.searchParams.set("pathname", `${PREFIX}${Date.now()}-${record.id}.json`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: blobHeaders(key, {
        "x-vercel-blob-access": "private",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "0",
        "x-content-type": "application/json",
      }),
      body: JSON.stringify(record),
      signal: controller.signal,
    });
    if (!response.ok) console.warn("Falha em analytics Blob:", response.status);
    return response.ok;
  } catch { return false; }
  finally { clearTimeout(timeout); }
}
export async function recordPublicIc(request: Request): Promise<"recorded" | "disabled" | "invalid"> {
  let data: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return "invalid";
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "invalid";
    data = raw as Record<string, unknown>;
  } catch { return "invalid"; }
  const sessionId = safeSession(data.sessionId);
  if (!sessionId) return "invalid";
  const price = Number(data.amountCents);
  const ok = await saveFunnelEvent({
    type: "InitiateCheckout", sessionId,
    productId: text(data.productId, 80),
    productName: text(data.productName, 160) || "Produto",
    amountCents: Number.isFinite(price) ? Math.min(Math.max(Math.round(price), 0), 100000000) : 0,
    traffic: trafficParams(data.traffic),
    location: requestLocation(request),
  });
  return ok ? "recorded" : "disabled";
}
/** Registra apenas contato enviado no checkout, sem CPF nem endereço. */
export async function recordPublicCustomer(request: Request): Promise<"recorded" | "disabled" | "invalid"> {
  let data: Record<string, unknown>;
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return "invalid";
    const raw = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "invalid";
    data = raw as Record<string, unknown>;
  } catch { return "invalid"; }
  const sessionId = safeSession(data.sessionId);
  const name = text(data.name, 100);
  const email = text(data.email, 120);
  if (!sessionId || name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "invalid";
  const value = Number(data.amountCents);
  const ok = await saveFunnelEvent({
    type: "CustomerIdentified", sessionId, productId: text(data.productId, 80),
    productName: text(data.productName, 160),
    amountCents: Number.isFinite(value) ? Math.min(Math.max(Math.round(value), 0), 100000000) : 0,
    customer: { name, email, phone: "" },
  });
  return ok ? "recorded" : "disabled";
}
export async function recordPixGenerated(data: {
  sessionId?: string; transactionId: string; itemId?: string; itemTitle?: string;
  amountCents: number; name: string; email?: string; phone?: string; utm?: string;
}) {
  if (!safeSession(data.sessionId)) return false;
  return saveFunnelEvent({
    type: "PixGenerated", sessionId: safeSession(data.sessionId),
    productId: text(data.itemId, 80),
    productName: text(data.itemTitle, 160) || "Produto",
    amountCents: data.amountCents,
    transactionId: text(data.transactionId, 120),
    customer: { name: text(data.name, 100), email: text(data.email, 120), phone: text(data.phone, 30) },
    traffic: trafficParams(data.utm),
  });
}
export async function recordPixPaid(sessionId: string | undefined, transactionId: string) {
  if (!safeSession(sessionId)) return false;
  return saveFunnelEvent({
    type: "PixPaid", sessionId: safeSession(sessionId), transactionId: text(transactionId, 120),
    productId: "", productName: "", amountCents: 0,
  });
}
export async function listFunnelEvents(): Promise<{ events: FunnelEvent[]; limited: boolean }> {
  const key = token();
  if (!key) throw new Error("Conecte o Vercel Blob privado para registrar eventos do painel.");
  let cursor = "";
  const all: Array<{ pathname: string; url: string }> = [];
  let more = false;
  do {
    const url = new URL("https://vercel.com/api/blob");
    url.searchParams.set("prefix", PREFIX);
    url.searchParams.set("limit", "1000");
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: blobHeaders(key) });
    if (!response.ok) throw new Error("Não foi possível consultar eventos armazenados.");
    const obj = await response.json() as { blobs?: Array<{ pathname: string; url: string }>; cursor?: string; hasMore?: boolean };
    all.push(...(obj.blobs || []).filter(b => b.pathname.endsWith(".json")));
    more = Boolean(obj.hasMore);
    cursor = more ? obj.cursor || "" : "";
  } while (more && cursor && all.length < 5000);
  const selected = all.sort((a, b) => b.pathname.localeCompare(a.pathname)).slice(0, 120);
  const results: FunnelEvent[] = [];
  // Limite de concorrência nas leituras privadas.
  for (let i = 0; i < selected.length; i += 8) {
    await Promise.all(selected.slice(i, i + 8).map(async blob => {
      try {
        const response = await fetch(blob.url, { headers: blobHeaders(key) });
        if (!response.ok) return;
        const event = await response.json() as FunnelEvent;
        if (event && ["InitiateCheckout", "CustomerIdentified", "PixGenerated", "PixPaid"].includes(event.type)) results.push(event);
      } catch {}
    }));
  }
  return { events: results.sort((a, b) => b.at.localeCompare(a.at)), limited: more || all.length > selected.length };
}
