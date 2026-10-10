export const UTMIFY_PIXEL_ID = "6ac9eaf9704861725fcddc19";
export const UTMIFY_PIXEL_SRC = "https://cdn.utmify.com.br/scripts/pixel/pixel.js";
export const UTMIFY_UTMS_SRC = "https://cdn.utmify.com.br/scripts/utms/latest.js";

/**
 * Carrega o Pixel oficial da UTMify uma única vez, usando o novo ID.
 * O snippet enviado usa base64/XOR para carregar exatamente este mesmo URL e ID.
 */
export const UTMIFY_PIXEL_LOADER = `(function(){
  window.pixelId=${JSON.stringify(UTMIFY_PIXEL_ID)};
  var src=${JSON.stringify(UTMIFY_PIXEL_SRC)};
  if(document.querySelector('script[src="'+src+'"]')||window.__utmifyPixelBootstrap)return;
  window.__utmifyPixelBootstrap=true;
  var script=document.createElement('script');
  script.src=src;script.async=true;script.defer=true;
  script.setAttribute('data-utmify-pixel','official');
  script.onerror=function(){window.__utmifyPixelBootstrap=false;};
  (document.head||document.documentElement).appendChild(script);
})();`;

/** Script oficial de UTMs com as duas proteções de parâmetros fornecidas. */
export const UTMIFY_UTMS_LOADER = `(function(){
  var src=${JSON.stringify(UTMIFY_UTMS_SRC)};
  if(document.querySelector('script[src="'+src+'"]')||window.__utmifyUtmsBootstrap)return;
  window.__utmifyUtmsBootstrap=true;
  var script=document.createElement('script');
  script.src=src;script.async=true;script.defer=true;
  script.setAttribute('data-utmify-prevent-xcod-sck','');
  script.setAttribute('data-utmify-prevent-subids','');
  script.onerror=function(){window.__utmifyUtmsBootstrap=false;};
  (document.head||document.documentElement).appendChild(script);
})();`;
