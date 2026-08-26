export type InitiateCheckoutProduct = {
  id: string | string[];
  name: string;
  value: number | string;
  numItems?: number;
};

export type InitiateCheckoutResult = {
  eventId: string;
  sent: boolean;
  deduplicated: boolean;
};

type MetaEvent = {
  event_name: "InitiateCheckout";
  event_id: string;
  timestamp: number;
  params: {
    content_ids: string[];
    content_type: "product";
    content_name: string;
    value: number;
    currency: "BRL";
    num_items: number;
  };
  status: "sent" | "pixel_timeout" | "pixel_error" | "deduplicated";
};

type Fbq = (...args: unknown[]) => unknown;
type MetaIcContext = {
  eventId: string;
  params: MetaEvent["params"];
  expiresAt: number;
  forwarded: boolean;
};

type TrackingWindow = Window & {
  fbq?: Fbq;
  __utmify_ic_status?: Record<string, unknown>;
  __trackedEvents?: MetaEvent[];
  __icFbqOriginal?: Fbq;
  __icMetaContext?: MetaIcContext;
};

const CHECKOUT_PRODUCT_KEY = "checkout_product";
const IC_TTL_MS = 30 * 60 * 1000;
const activeEvents = new Map<string, Promise<InitiateCheckoutResult>>();

function trackingWindow() {
  return window as TrackingWindow;
}

export function metaPixelIsReady() {
  return typeof trackingWindow().fbq === "function";
}

async function waitForPixel(timeoutMs = 5500): Promise<boolean> {
  if (metaPixelIsReady()) return true;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    if (metaPixelIsReady()) return true;
  }
  return false;
}

export function checkoutValue(value: number | string): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const normalized = value.trim().replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createEventId(productId: string): string {
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `ic_${productId}_${Date.now()}_${random}`;
}

function readCheckoutProduct(): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_PRODUCT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function storedContentIds(stored: Record<string, unknown>): string[] {
  if (Array.isArray(stored.contentIds)) {
    return stored.contentIds.map(String).filter(Boolean);
  }
  const id = String(stored.id || "").trim();
  return id ? [id] : [];
}

function sameContentIds(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function saveEventOnCheckoutProduct(contentIds: string[], eventId: string, trackedAt?: number) {
  try {
    const stored = readCheckoutProduct();
    if (!stored || !sameContentIds(storedContentIds(stored), contentIds)) return;
    localStorage.setItem(
      CHECKOUT_PRODUCT_KEY,
      JSON.stringify({
        ...stored,
        icEventId: eventId,
        ...(trackedAt ? { icTrackedAt: trackedAt } : {}),
      }),
    );
  } catch {}
}

function recentStoredEvent(contentIds: string[]): { eventId: string; trackedAt: number } | null {
  const stored = readCheckoutProduct();
  if (!stored || !sameContentIds(storedContentIds(stored), contentIds)) return null;
  const eventId = typeof stored.icEventId === "string" ? stored.icEventId : "";
  const trackedAt = Number(stored.icTrackedAt || 0);
  if (!eventId || !trackedAt || Date.now() - trackedAt > IC_TTL_MS) return null;
  return { eventId, trackedAt };
}

function pendingStoredEventId(contentIds: string[]): string | undefined {
  const stored = readCheckoutProduct();
  if (!stored || !sameContentIds(storedContentIds(stored), contentIds)) return undefined;
  return typeof stored.icEventId === "string" && stored.icEventId
    ? stored.icEventId
    : undefined;
}

function recordDebugEvent(event: MetaEvent) {
  const target = trackingWindow();
  target.__utmify_ic_status = {
    event: event.event_name,
    event_id: event.event_id,
    product: event.params.content_ids[0],
    value: event.params.value,
    currency: event.params.currency,
    status: event.status,
    at: event.timestamp,
  };
  target.__trackedEvents = target.__trackedEvents || [];
  target.__trackedEvents.push(event);
  try {
    const raw = sessionStorage.getItem("tracking_ic_debug");
    const stored = raw ? (JSON.parse(raw) as MetaEvent[]) : [];
    stored.push(event);
    sessionStorage.setItem("tracking_ic_debug", JSON.stringify(stored.slice(-20)));
  } catch {}
}

/**
 * A UTMify também chama fbq quando registra o IC no funil dela. Este interceptor
 * completa essa chamada e descarta a segunda chamada Meta do mesmo clique.
 */
function installMetaIcContext(eventId: string, params: MetaEvent["params"]): boolean {
  const target = trackingWindow();
  const currentFbq = target.fbq;
  if (typeof currentFbq !== "function") return false;

  if (!target.__icFbqOriginal) {
    const original = currentFbq;
    const wrapped: Fbq = (...args: unknown[]) => {
      const context = target.__icMetaContext;
      const isInitiateCheckout = args[0] === "track" && args[1] === "InitiateCheckout";
      if (isInitiateCheckout && context && Date.now() <= context.expiresAt) {
        if (context.forwarded) return undefined;
        context.forwarded = true;
        const incomingParams =
          args[2] && typeof args[2] === "object" && !Array.isArray(args[2])
            ? (args[2] as Record<string, unknown>)
            : {};
        const incomingOptions =
          args[3] && typeof args[3] === "object" && !Array.isArray(args[3])
            ? (args[3] as Record<string, unknown>)
            : {};
        return original(
          "track",
          "InitiateCheckout",
          { ...incomingParams, ...context.params },
          { ...incomingOptions, eventID: context.eventId },
        );
      }
      return original(...args);
    };
    try {
      Object.assign(wrapped, original);
    } catch {}
    target.__icFbqOriginal = original;
    target.fbq = wrapped;
  }

  target.__icMetaContext = {
    eventId,
    params,
    expiresAt: Date.now() + 60_000,
    forwarded: false,
  };
  return true;
}

/**
 * Dispara um único InitiateCheckout explícito e completo antes de abrir o checkout.
 * O eventID fica salvo junto do produto para evitar outro IC nas etapas seguintes.
 */
export function trackInitiateCheckout(
  product: InitiateCheckoutProduct,
): Promise<InitiateCheckoutResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ eventId: "", sent: false, deduplicated: false });
  }

  const contentIds = (Array.isArray(product.id) ? product.id : [product.id])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const contentName = String(product.name || "Produto").trim() || "Produto";
  const value = checkoutValue(product.value);
  const numItems = Math.max(1, Math.round(product.numItems || 1));
  const lockKey = contentIds.join("|") || "unknown";

  const existing = recentStoredEvent(contentIds);
  if (existing) {
    const params = {
      content_ids: contentIds,
      content_type: "product" as const,
      content_name: contentName,
      value,
      currency: "BRL" as const,
      num_items: numItems,
    };
    recordDebugEvent({
      event_name: "InitiateCheckout",
      event_id: existing.eventId,
      timestamp: Date.now(),
      params,
      status: "deduplicated",
    });
    return Promise.resolve({ eventId: existing.eventId, sent: true, deduplicated: true });
  }

  const active = activeEvents.get(lockKey);
  if (active) return active;

  const task = (async (): Promise<InitiateCheckoutResult> => {
    const eventId = pendingStoredEventId(contentIds) || createEventId(lockKey);
    const params = {
      content_ids: contentIds,
      content_type: "product" as const,
      content_name: contentName,
      value,
      currency: "BRL" as const,
      num_items: numItems,
    };
    saveEventOnCheckoutProduct(contentIds, eventId);

    const ready = await waitForPixel();
    if (!ready) {
      recordDebugEvent({
        event_name: "InitiateCheckout",
        event_id: eventId,
        timestamp: Date.now(),
        params,
        status: "pixel_timeout",
      });
      return { eventId, sent: false, deduplicated: false };
    }

    try {
      installMetaIcContext(eventId, params);
      trackingWindow().fbq?.(
        "track",
        "InitiateCheckout",
        params,
        { eventID: eventId },
      );
      const trackedAt = Date.now();
      saveEventOnCheckoutProduct(contentIds, eventId, trackedAt);
      recordDebugEvent({
        event_name: "InitiateCheckout",
        event_id: eventId,
        timestamp: trackedAt,
        params,
        status: "sent",
      });
      return { eventId, sent: true, deduplicated: false };
    } catch {
      recordDebugEvent({
        event_name: "InitiateCheckout",
        event_id: eventId,
        timestamp: Date.now(),
        params,
        status: "pixel_error",
      });
      return { eventId, sent: false, deduplicated: false };
    }
  })();

  activeEvents.set(lockKey, task);
  void task.finally(() => {
    window.setTimeout(() => activeEvents.delete(lockKey), 1000);
  });
  return task;
}

/** Última proteção: registra IC em acessos diretos ao checkout/PIX. */
export function trackStoredInitiateCheckout(fallback: InitiateCheckoutProduct) {
  const stored = readCheckoutProduct();
  return trackInitiateCheckout({
    id:
      Array.isArray(stored?.contentIds) && stored.contentIds.length
        ? stored.contentIds.map(String)
        : stored?.id
          ? String(stored.id)
          : fallback.id,
    name: String(stored?.title || fallback.name),
    value:
      typeof stored?.price === "string" || typeof stored?.price === "number"
        ? stored.price
        : fallback.value,
    numItems:
      typeof stored?.quantity === "number"
        ? Math.max(1, Math.round(stored.quantity))
        : fallback.numItems || 1,
  });
}
