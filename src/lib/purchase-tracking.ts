import { META_PIXEL_ID } from "./meta-pixel.ts";
import { pushGoogleTagEvent } from "./google-tag.ts";
import type { PixChargeResult } from "./pix.server.ts";

const active = new Map<string, Promise<{ sent: boolean; deduplicated: boolean }>>();
const queued = new Set<string>();
const storageKey = (transactionId: string) => `meta_purchase_${META_PIXEL_ID}_${transactionId}`;

/** Somente a confirmação da consulta server-side permite enviar Purchase. */
export function trackConfirmedPixPurchase(status: string, charge: PixChargeResult) {
  if (typeof window === "undefined" || status !== "COMPLETED" ||
      !charge.transactionId || !Number.isSafeInteger(charge.amountCents) || charge.amountCents <= 0 ||
      !charge.contentIds?.length) {
    return Promise.resolve({ sent: false, deduplicated: false });
  }
  const key = storageKey(charge.transactionId);
  if (queued.has(key)) return Promise.resolve({ sent: true, deduplicated: true });
  try {
    if (localStorage.getItem(key)) {
      return Promise.resolve({ sent: true, deduplicated: true });
    }
  } catch { /* Storage bloqueado: mantém deduplicação em memória. */ }
  const inFlight = active.get(key);
  if (inFlight) return inFlight;
  const task = (async () => {
    const target = window as Window & { fbq?: (...args: unknown[]) => unknown };
    const start = Date.now();
    while (typeof target.fbq !== "function" && Date.now() - start < 5500) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    }
    if (typeof target.fbq !== "function") return { sent: false, deduplicated: false };
    try {
      target.fbq("trackSingle", META_PIXEL_ID, "Purchase", {
        value: charge.amountCents / 100,
        currency: "BRL",
        content_ids: charge.contentIds,
        content_type: "product",
        content_name: charge.itemTitle,
        num_items: charge.numItems,
        order_id: charge.transactionId,
      }, { eventID: `purchase_${charge.transactionId}` });
      pushGoogleTagEvent("Purchase", {
        event_id: `purchase_${charge.transactionId}`,
        value: charge.amountCents / 100,
        currency: "BRL",
        content_ids: charge.contentIds,
        content_type: "product",
        content_name: charge.itemTitle,
        num_items: charge.numItems,
        order_id: charge.transactionId,
      });
      queued.add(key);
      try { localStorage.setItem(key, new Date().toISOString()); } catch {}
      // "sent" significa entregue à fila do pixel; não é recibo do Meta.
      return { sent: true, deduplicated: false };
    } catch {
      return { sent: false, deduplicated: false };
    }
  })();
  active.set(key, task);
  void task.finally(() => active.delete(key));
  return task;
}
