/**
 * Registro first-party do funil. Não armazena IP completo, CPF, cartão, CVV
 * nem o código copia-e-cola do Pix. Arquivos ficam em Vercel Blob privado.
 * Para alto volume, migre analytics/events para um banco com índices.
 */
export type FunnelEvent = {
  id: string;
  type: "PageView" | "InitiateCheckout" | "CustomerIdentified" | "PixGenerated" | "PixPaid";
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
const PIX_PENDING_LIMIT = 3;
const ALLOWED_UTM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "src",
  "sck",
  "gclid",
  "gbraid",
  "wbraid",
] as const;

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
function requestTraffic(request: Request, input: unknown): Record<string, string> {
  const url = new URL(request.url);
  const traffic = trafficParams(input);
  for (const key of ALLOWED_UTM) {
    const value = text(url.searchParams.get(key), 150);
    if (value && !traffic[key]) traffic[key] = value;
  }
  const referrer = text(request.headers.get("referer"), 300);
  if (referrer) traffic.referrer = referrer;
  let refHost = "";
  try { refHost = referrer ? new URL(referrer).hostname : ""; } catch {}
  const source = (traffic.utm_source || traffic.src || "").toLowerCase();
  if (
    traffic.gclid ||
    traffic.gbraid ||
    traffic.wbraid ||
    /(^|\.)google\./i.test(refHost) ||
    ["google", "google_ads", "adwords"].includes(source)
  ) {
    traffic.source_detected = "google";
  }
  return traffic;
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
  return requestLocationFromHeaders(request.headers);
}
export function requestLocationFromHeaders(h: Headers) {
  // Dados de geolocalização fornecidos pela Vercel; aproximados e nem sempre presentes.
  const rawIp = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0] || "";
  return {
    maskedIp: maskIp(rawIp),
    city: decodeGeo(h.get("x-vercel-ip-city")),
    region: decodeGeo(h.get("x-vercel-ip-country-region")),
    country: decodeGeo(h.get("x-vercel-ip-country")),
  };
}
function requestIp(headers: Headers) {
  return (headers.get("x-forwarded-for") || headers.get("x-real-ip") || "").split(",")[0]?.trim() || "";
}
async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
export async function requestIpHash(headers: Headers) {
  const ip = requestIp(headers);
  if (!ip) return "";
  const salt = process.env.IP_HASH_SALT || token().slice(0, 24) || "flevopay-ip-limit";
  return sha256(`${salt}:${ip}`);
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
export async function recordPublicPageView(request: Request): Promise<"recorded" | "disabled" | "invalid"> {
  let data: Record<string, unknown> = {};
  try {
    if (Number(request.headers.get("content-length") || 0) > 4096) return "invalid";
    if ((request.headers.get("content-length") || "0") !== "0") {
      const raw = await request.json();
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "invalid";
      data = raw as Record<string, unknown>;
    }
  } catch { return "invalid"; }

  const sessionId = safeSession(data.sessionId);
  if (!sessionId) return "invalid";
  const ok = await saveFunnelEvent({
    type: "PageView",
    sessionId,
    productId: text(data.productId, 80),
    productName: text(data.productName, 160) || text(data.path, 160) || "Página",
    amountCents: 0,
    traffic: requestTraffic(request, data.traffic),
    location: requestLocation(request),
  });
  return ok ? "recorded" : "disabled";
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
    traffic: requestTraffic(request, data.traffic),
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
  location?: FunnelEvent["location"]; ipHash?: string;
}) {
  if (!safeSession(data.sessionId)) return false;
  const traffic = trafficParams(data.utm);
  if (data.ipHash) traffic.ip_hash = data.ipHash;
  return saveFunnelEvent({
    type: "PixGenerated", sessionId: safeSession(data.sessionId),
    productId: text(data.itemId, 80),
    productName: text(data.itemTitle, 160) || "Produto",
    amountCents: data.amountCents,
    transactionId: text(data.transactionId, 120),
    customer: { name: text(data.name, 100), email: text(data.email, 120), phone: text(data.phone, 30) },
    traffic,
    location: data.location,
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
        if (event && ["PageView", "InitiateCheckout", "CustomerIdentified", "PixGenerated", "PixPaid"].includes(event.type)) results.push(event);
      } catch {}
    }));
  }
  return { events: results.sort((a, b) => b.at.localeCompare(a.at)), limited: more || all.length > selected.length };
}

export async function enforcePixPendingLimit(headers: Headers, sessionId?: string) {
  const safeId = safeSession(sessionId);
  const ipHash = await requestIpHash(headers);
  if (!token() || (!safeId && !ipHash)) return { allowed: true, pending: 0, ipHash };

  const { events } = await listFunnelEvents();
  const paid = new Set(events.filter(event => event.type === "PixPaid").map(event => event.transactionId).filter(Boolean));
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const pending = events.filter(event => {
    if (event.type !== "PixGenerated") return false;
    if (event.transactionId && paid.has(event.transactionId)) return false;
    if (Date.parse(event.at) < oneDayAgo) return false;
    return Boolean(
      (safeId && event.sessionId === safeId) ||
      (ipHash && event.traffic?.ip_hash === ipHash),
    );
  }).length;

  return { allowed: pending < PIX_PENDING_LIMIT, pending, ipHash };
}
