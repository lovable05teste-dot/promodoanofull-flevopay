import { getUtmQuery } from "./utm";

let memorySession = "";
const SESSION_KEY = "funnel_checkout_session";
const IC_KEY = "funnel_ic_sent";

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `session_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
export function getCheckoutSessionId() {
  if (typeof window === "undefined") return "";
  try {
    const prior = sessionStorage.getItem(SESSION_KEY);
    if (prior) return prior;
    const next = createId();
    sessionStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    if (!memorySession) memorySession = createId();
    return memorySession;
  }
}
function startNewCheckout() {
  const id = createId();
  memorySession = id;
  try {
    sessionStorage.setItem(SESSION_KEY, id);
    sessionStorage.removeItem(IC_KEY);
  } catch {}
  return id;
}
function productInfo() {
  let p: Record<string, unknown> = {};
  try {
    p = JSON.parse(localStorage.getItem("checkout_product") || "{}") as Record<string, unknown>;
  } catch {}
  const amount = String(p.price || "61,93").trim().replace(/\./g, "").replace(",", ".");
  const cents = Math.round(Number(amount) * 100);
  return {
    productId: String(p.id || "6549324").slice(0, 80),
    productName: String(p.title || "Produto").slice(0, 160),
    amountCents: Number.isFinite(cents) ? cents : 0,
  };
}
/** Marca o clique no botão do site; não confirma por si só o envio ao Meta. */
export function trackFirstPartyCheckout() {
  if (typeof window === "undefined") return;
  const sessionId = getCheckoutSessionId();
  try {
    if (sessionStorage.getItem(IC_KEY) === sessionId) return;
    sessionStorage.setItem(IC_KEY, sessionId);
  } catch {}
  const traffic = getUtmQuery();
  // keepalive permite que a navegação continue sem cancelar a requisição.
  void fetch("/api/tracking/ic", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, ...productInfo(), traffic }),
  }).catch(() => {});
}
/** Associa nome/e-mail ao IC quando a pessoa envia o formulário de entrega. */
export function trackCheckoutCustomer(customer: { name: string; email: string }) {
  if (typeof window === "undefined") return;
  const name = (customer.name || "").trim();
  const email = (customer.email || "").trim();
  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  void fetch("/api/tracking/customer", {
    method: "POST",
    credentials: "same-origin",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId: getCheckoutSessionId(), name, email, ...productInfo(),
    }),
  }).catch(() => {});
}
export function installFirstPartyCheckoutListener() {
  if (typeof window === "undefined") return () => {};
  const onClick = (event: MouseEvent) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest("button");
    if (!button) return;
    const label = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
    if (label !== "comprar agora") return;
    startNewCheckout();
    // Script original grava checkout_product no mesmo evento de clique.
    window.setTimeout(trackFirstPartyCheckout, 0);
  };
  document.addEventListener("click", onClick, true);
  return () => document.removeEventListener("click", onClick, true);
}
