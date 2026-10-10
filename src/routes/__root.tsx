import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { captureUtms } from "../lib/utm";
import { installFirstPartyCheckoutListener } from "../lib/checkout-tracker";
import { UTMIFY_PIXEL_LOADER, UTMIFY_UTMS_LOADER } from "../lib/utmify-pixel";
import { META_PIXEL_ID, META_PIXEL_LOADER } from "../lib/meta-pixel";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Jogo de Panelas Antiaderente 10 Peças" },
      { name: "description", content: "Oferta de jogo de panelas antiaderente com frete grátis, avaliações e produtos relacionados." },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Jogo de Panelas Antiaderente 10 Peças" },
      { property: "og:description", content: "Oferta de jogo de panelas antiaderente com frete grátis, avaliações e produtos relacionados." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Jogo de Panelas Antiaderente 10 Peças" },
      { name: "twitter:description", content: "Oferta de jogo de panelas antiaderente com frete grátis, avaliações e produtos relacionados." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aa1807fb-ea33-4a60-8091-6c5467de5669/id-preview-381c2d80--0989b885-61c7-4789-94e0-5e2e83a22aff.lovable.app-1785216312300.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/aa1807fb-ea33-4a60-8091-6c5467de5669/id-preview-381c2d80--0989b885-61c7-4789-94e0-5e2e83a22aff.lovable.app-1785216312300.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://cdn.utmify.com.br", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://tracking.utmify.com.br", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://i.postimg.cc", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://i.imgur.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://i.ibb.co", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://http2.mlstatic.com", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://connect.facebook.net" },
    ],
    scripts: [
      {
        src: "https://www.googletagmanager.com/gtag/js?id=G-XY2YRZSDSF",
        async: true,
      },
      {
        // Google Analytics 4 (Google tag) - instalado no layout global.
        children: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-XY2YRZSDSF');`,
      },
      {
        // Meta Pixel único, inicializa PageView uma vez em cada carga da página.
        children: META_PIXEL_LOADER,
      },
      {
        // Pixel oficial UTMify (novo ID).
        children: UTMIFY_PIXEL_LOADER,
      },
      {
        // Script oficial UTMify para capturar UTMs sem duplicar carregamento.
        children: UTMIFY_UTMS_LOADER,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <noscript>
          <img
            alt=""
            height={1}
            width={1}
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          />
        </noscript>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    captureUtms();
    return installFirstPartyCheckoutListener();
  }, []);

  // A primeira PageView é enviada no <head>. Em navegação SPA, enviamos
  // somente uma nova PageView por troca real de pathname.
  useEffect(() => {
    if (previousPath.current === null) {
      previousPath.current = pathname;
      return;
    }
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    const fbq = (window as Window & {
      fbq?: (...args: unknown[]) => unknown;
    }).fbq;
    fbq?.("track", "PageView");
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
