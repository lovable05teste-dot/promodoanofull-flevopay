import type { MouseEvent as ReactMouseEvent } from "react";

type TrackingWindow = Window & {
  fbq?: (...args: unknown[]) => unknown;
  __utmify_ic_status?: Record<string, unknown>;
};

function trackingWindow() {
  return window as TrackingWindow;
}

function pixelIsReady() {
  return typeof trackingWindow().fbq === "function";
}

async function waitForPixel(timeoutMs = 5500): Promise<boolean> {
  if (pixelIsReady()) return true;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
    if (pixelIsReady()) return true;
  }
  return false;
}

/**
 * Protege cliques feitos antes de o Pixel oficial terminar de inicializar.
 *
 * O href do CTA contém "checkout", então o próprio Pixel da UTMify reconhece
 * o link como IC, aguarda a confirmação da requisição e só depois navega. Não
 * usamos APIs globais inexistentes nem dataLayer paralelo, evitando duplicação.
 */
export function ensureUtmifyBeforeCheckout(
  event: ReactMouseEvent<HTMLAnchorElement>,
): void {
  if (typeof window === "undefined") return;

  const link = event.currentTarget;
  if (link.dataset.utmifyReplay === "1") return;
  if (pixelIsReady()) return;

  event.preventDefault();
  const href = link.href;
  link.dataset.utmifyReplay = "1";
  trackingWindow().__utmify_ic_status = {
    waiting: true,
    at: Date.now(),
    product: link.dataset.productId,
  };

  void waitForPixel().then((ready) => {
    trackingWindow().__utmify_ic_status = {
      ready,
      replayed: ready,
      at: Date.now(),
      product: link.dataset.productId,
    };

    if (!ready || !link.isConnected) {
      window.location.assign(href);
      return;
    }

    // Fallback de navegação caso uma extensão bloqueie a resposta da UTMify.
    window.setTimeout(() => window.location.assign(href), 3000);
    link.click();
  });
}
