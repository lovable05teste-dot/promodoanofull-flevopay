export const UTMIFY_PIXEL_ID = "6a8906df65a3354808dbeac2";
export const UTMIFY_PIXEL_SRC = "https://cdn.utmify.com.br/scripts/pixel/pixel.js";

/**
 * Carregador único do Pixel da UTMify.
 *
 * A proteção por flag + busca do src evita que o mesmo Pixel seja inicializado
 * novamente por HTML legado, hidratação ou mudança de rota.
 */
export const UTMIFY_PIXEL_LOADER = `window.pixelId=${JSON.stringify(UTMIFY_PIXEL_ID)};(function(){var src=${JSON.stringify(UTMIFY_PIXEL_SRC)};if(window.__utmifyPixelBootstrap||document.querySelector('script[src="'+src+'"]')){window.__utmifyPixelBootstrap=true;return;}window.__utmifyPixelBootstrap=true;var script=document.createElement("script");script.src=src;script.async=true;script.defer=true;script.setAttribute("data-utmify-pixel","official");script.onerror=function(){window.__utmifyPixelBootstrap=false;};(document.head||document.documentElement).appendChild(script);})();`;
