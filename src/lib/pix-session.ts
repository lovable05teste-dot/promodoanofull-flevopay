import type { PixChargeResult } from "./pix.server.ts";

const KEY = "checkout_pix_charge_v1";

/** Identifica o checkout sem persistir CPF/e-mail no cache do Pix. */
export async function pixCheckoutKey(input: {
  sessionId: string; contentIds: string[]; amountCents: number;
  document: string; email: string; numItems: number;
}) {
  try {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(input)));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch { return ""; }
}

export function readCachedPixCharge(checkoutKey: string): PixChargeResult | null {
  if (!checkoutKey) return null;
  try {
    const cached = JSON.parse(sessionStorage.getItem(KEY) || "null");
    const charge = cached?.charge;
    if (cached?.checkoutKey !== checkoutKey || !charge ||
        typeof charge.transactionId !== "string" || !charge.transactionId ||
        typeof charge.pixCode !== "string" || !charge.pixCode ||
        !Number.isSafeInteger(charge.amountCents) || charge.amountCents <= 0 ||
        !Array.isArray(charge.contentIds) || !charge.contentIds.length ||
        !charge.contentIds.every((id: unknown) => typeof id === "string" && id) ||
        typeof charge.itemTitle !== "string" || !Number.isSafeInteger(charge.numItems) || charge.numItems < 1 ||
        !Number.isFinite(Date.parse(charge.expiresAt)) || Date.parse(charge.expiresAt) <= Date.now()) return null;
    return charge;
  } catch { return null; }
}

export function saveCachedPixCharge(checkoutKey: string, charge: PixChargeResult) {
  if (!checkoutKey) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ checkoutKey, charge })); } catch {}
}

export function clearCachedPixCharge(transactionId: string) {
  try {
    const cached = JSON.parse(sessionStorage.getItem(KEY) || "null");
    if (cached?.charge?.transactionId === transactionId) sessionStorage.removeItem(KEY);
  } catch {}
}
