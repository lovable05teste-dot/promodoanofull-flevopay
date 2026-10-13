type GoogleTagEventParams = Record<string, unknown>;

type GoogleTagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => unknown;
};

export const GOOGLE_TAG_ID = "G-XY2YRZSDSF";

function tagWindow() {
  return window as GoogleTagWindow;
}

export function pushGoogleTagEvent(eventName: string, params: GoogleTagEventParams = {}) {
  if (typeof window === "undefined") return false;

  const target = tagWindow();
  target.dataLayer = target.dataLayer || [];

  target.dataLayer.push({
    event: eventName,
    ...params,
  });

  if (typeof target.gtag === "function") {
    target.gtag("event", eventName, params);
  }

  return true;
}
