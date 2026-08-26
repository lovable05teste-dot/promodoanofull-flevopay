import { createFileRoute } from "@tanstack/react-router";
import html from "../clone-site.html?raw";
import { ALL_PRODUCTS } from "../lib/products";
import { SELLER_MODAL_HTML, SELLER_MODAL_SCRIPT } from "../lib/seller-modal";
import { UTMIFY_PIXEL_LOADER } from "../lib/utmify-pixel";

const PLACEHOLDER = "/clone-assets/images/placeholder.svg";
const MAIN_PRODUCT_ID = "6549324";
const PRODUCT_LOADING_SCRIPT = `<script>(function(){function removeLoader(){var old=document.getElementById('product-navigation-loader');if(old)old.remove()}window.__showProductLoader=function(){if(document.getElementById('product-navigation-loader'))return;var style=document.getElementById('product-navigation-loader-style');if(!style){style=document.createElement('style');style.id='product-navigation-loader-style';style.textContent='@keyframes product-loader-spin{to{transform:rotate(360deg)}}';document.head.appendChild(style)}var overlay=document.createElement('div');overlay.id='product-navigation-loader';overlay.setAttribute('role','status');overlay.setAttribute('aria-label','Carregando produto');overlay.style.cssText='position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#fff;';var spinner=document.createElement('span');spinner.style.cssText='display:block;width:56px;height:56px;border:4px solid #3483fa;border-right-color:transparent;border-radius:50%;animation:product-loader-spin .75s linear infinite;';overlay.appendChild(spinner);document.body.appendChild(overlay)};window.addEventListener('pageshow',removeLoader)})();</script>`;
function buildHomepageTrackingScript() {
  const item = {
    id: "6549324",
    title: "Jogo De Panelas Indução Antiaderente Cerâmica 10 Peças PPG PFOA Free Baunilha",
    price: "61,93",
    image: "https://i.postimg.cc/Gtj1SkJR/D-NQ-NP-2X-754218-MLA98733384331-112025-F.webp",
  };
  return `<script>${UTMIFY_PIXEL_LOADER}(function(){
    var checkoutLocked=false;
    var item=${JSON.stringify(item)};
    var trackingKeys=/^(utm_|fbclid$|gclid$|gbraid$|wbraid$|ttclid$|tbclid$|xcod$|sck$|src$)/i;
    function persistTracking(){try{var stored=new URLSearchParams(localStorage.getItem("tracking_utm")||"");var current=new URLSearchParams(window.location.search);current.forEach(function(value,key){if(value&&trackingKeys.test(key))stored.set(key,value)});var qs=stored.toString();if(qs)localStorage.setItem("tracking_utm",qs);return qs}catch(err){return window.location.search.replace(/^\\?/,"")}}
    function ready(){return typeof window.fbq==="function"}
    function waitForPixel(done){if(ready()){done(true);return}var started=Date.now();var timer=setInterval(function(){if(ready()){clearInterval(timer);done(true)}else if(Date.now()-started>=5500){clearInterval(timer);done(false)}},50)}
    function createEventId(){var random=(window.crypto&&typeof window.crypto.randomUUID==="function")?window.crypto.randomUUID():Math.random().toString(36).slice(2);return "ic_"+item.id+"_"+Date.now()+"_"+random}
    function saveProduct(extra){try{localStorage.setItem("checkout_product",JSON.stringify(Object.assign({},item,extra||{})))}catch(err){}}
    function saveCart(){try{var raw=localStorage.getItem("checkout_cart");var cart=raw?JSON.parse(raw):[];if(!Array.isArray(cart))cart=[];var key=item.id+"::::::";var current=cart.find(function(entry){return entry&&entry.key===key});if(current){current.quantity=Math.min(10,(Number(current.quantity)||1)+1)}else{cart.push({key:key,id:item.id,title:item.title,price:item.price,image:item.image,quantity:1,addedAt:Date.now()})}localStorage.setItem("checkout_cart",JSON.stringify(cart))}catch(err){}}
    function debug(eventId,params,status){var event={event_name:"InitiateCheckout",event_id:eventId,timestamp:Date.now(),params:params,status:status};window.__utmify_ic_status={event:event.event_name,event_id:eventId,product:item.id,value:params.value,currency:params.currency,status:status,at:event.timestamp};window.__trackedEvents=window.__trackedEvents||[];window.__trackedEvents.push(event);try{var raw=sessionStorage.getItem("tracking_ic_debug");var stored=raw?JSON.parse(raw):[];stored.push(event);sessionStorage.setItem("tracking_ic_debug",JSON.stringify(stored.slice(-20)))}catch(err){}}
    function installContext(eventId,params){var current=window.fbq;if(typeof current!=="function")return false;if(!window.__icFbqOriginal){var original=current;var wrapped=function(){var args=Array.prototype.slice.call(arguments);var context=window.__icMetaContext;if(args[0]==="track"&&args[1]==="InitiateCheckout"&&context&&Date.now()<=context.expiresAt){if(context.forwarded)return;context.forwarded=true;var incoming=args[2]&&typeof args[2]==="object"?args[2]:{};var options=args[3]&&typeof args[3]==="object"?args[3]:{};return original("track","InitiateCheckout",Object.assign({},incoming,context.params),Object.assign({},options,{eventID:context.eventId}))}return original.apply(window,args)};try{Object.assign(wrapped,original)}catch(err){}window.__icFbqOriginal=original;window.fbq=wrapped}window.__icMetaContext={eventId:eventId,params:params,expiresAt:Date.now()+60000,forwarded:false};return true}
    function track(done){var eventId=createEventId();var params={content_ids:[item.id],content_type:"product",content_name:item.title,value:61.93,currency:"BRL",num_items:1};saveProduct({icEventId:eventId});window.__utmify_ic_status={event:"InitiateCheckout",event_id:eventId,product:item.id,status:"waiting",at:Date.now()};waitForPixel(function(ok){if(!ok){debug(eventId,params,"pixel_timeout");done(false);return}try{installContext(eventId,params);window.fbq("track","InitiateCheckout",params,{eventID:eventId});var trackedAt=Date.now();saveProduct({icEventId:eventId,icTrackedAt:trackedAt});debug(eventId,params,"sent");done(true)}catch(err){debug(eventId,params,"pixel_error");done(false)}})}
    persistTracking();
    var cartIcon=document.querySelector("header svg");if(cartIcon){cartIcon.style.cursor="pointer";cartIcon.setAttribute("role","link");cartIcon.setAttribute("tabindex","0");cartIcon.setAttribute("aria-label","Abrir carrinho");var openCart=function(){window.__showProductLoader&&window.__showProductLoader();var qs=persistTracking();setTimeout(function(){window.location.assign("/carrinho"+(qs?"?"+qs:""))},60)};cartIcon.addEventListener("click",openCart);cartIcon.addEventListener("keydown",function(event){if(event.key==="Enter"||event.key===" "){event.preventDefault();openCart()}})}
    document.addEventListener("click",function(e){var target=e.target;var btn=target&&target.closest?target.closest("button"):null;if(!btn)return;var label=(btn.textContent||"").replace(/\\s+/g," ").trim();if(label!=="Comprar agora"&&label!=="Adicionar ao carrinho")return;if(btn.dataset.icReplay==="1"){delete btn.dataset.icReplay;return}e.preventDefault();if(checkoutLocked){e.stopImmediatePropagation();return}checkoutLocked=true;window.__showProductLoader&&window.__showProductLoader();var qs=persistTracking();if(label==="Adicionar ao carrinho"){e.stopImmediatePropagation();saveCart();var cartHref="/carrinho"+(qs?"?"+qs:"");setTimeout(function(){window.location.assign(cartHref)},60);return}saveProduct();var href="/endereco?checkout=1"+(qs?"&"+qs:"");var pixelWasReady=ready();if(!pixelWasReady)e.stopImmediatePropagation();track(function(sent){if(!pixelWasReady){if(sent&&btn.isConnected){btn.dataset.icReplay="1";btn.click();setTimeout(function(){window.location.assign(href)},8000)}else{window.location.assign(href)}}else{setTimeout(function(){window.location.assign(href)},8000)}})},true);
  })();</script>`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function priceNumber(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}

function discountPercent(oldPrice: string, newPrice: string) {
  const oldValue = priceNumber(oldPrice);
  const newValue = priceNumber(newPrice);
  if (!oldValue || !newValue) return 0;
  return Math.round((1 - newValue / oldValue) * 100);
}

function productCard(product: (typeof ALL_PRODUCTS)[number], index = 0) {
  const [reais, centavos = "00"] = product.newPrice.split(",");
  const image = product.carousel[0] || PLACEHOLDER;
  const href = `/produto/${encodeURIComponent(product.id)}`;

  const eager = index < 2;

  return `<a href="${href}" onclick="event.preventDefault();window.__showProductLoader&&window.__showProductLoader();var next='${href}'+(window.location.search||'');setTimeout(function(){window.location.href=next;},60);" data-product-card="${escapeHtml(product.id)}" style="display:block !important;flex:0 0 46% !important;width:46% !important;min-width:46% !important;max-width:46% !important;scroll-snap-align:start;border:1px solid #eeeeee;border-radius:6px;padding:8px;background:#fff;color:#333;text-decoration:none;box-sizing:border-box;position:relative;z-index:999;pointer-events:auto;visibility:visible !important;opacity:1 !important;min-height:340px;">
    <div style="width:100%;aspect-ratio:1/1;min-height:150px;background:#fff;overflow:hidden;border-radius:4px;display:flex;align-items:center;justify-content:center;"><img src="${escapeHtml(image)}" alt="${escapeHtml(product.title)}" width="300" height="300" style="display:block !important;width:100% !important;height:100% !important;aspect-ratio:1/1;object-fit:contain;visibility:visible !important;opacity:1 !important;" loading="${eager ? "eager" : "lazy"}" decoding="async"${eager ? ' fetchpriority="high"' : ""} onerror="this.onerror=null;this.src='${PLACEHOLDER}';" /></div>
    <div style="margin-top:8px;font-size:12px;color:#777;text-decoration:line-through;">R$ ${escapeHtml(product.oldPrice)}</div>
    <div style="font-size:16px;color:#222;line-height:1.15;">R$ ${escapeHtml(reais)}<sup style="font-size:10px;">,${escapeHtml(centavos)}</sup></div>
    <div style="margin-top:4px;font-size:11px;color:#00a650;font-weight:700;">${discountPercent(product.oldPrice, product.newPrice)}% OFF</div>
    <div style="margin-top:4px;font-size:12px;color:#333;line-height:1.25;min-height:45px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">${escapeHtml(product.title)}</div>
    <div style="margin-top:6px;font-size:11px;color:#00a650;font-weight:700;">Frete grátis</div>
    <div style="margin-top:8px;height:32px;border-radius:5px;background:#3483fa;color:#fff;font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center;">Ver produto</div>
  </a>`;
}

function buildRelatedSection() {
  const cards = ALL_PRODUCTS.filter((product) => product.id !== MAIN_PRODUCT_ID)
    .map(productCard)
    .join("");

  return `<section id="related-products-fixed" data-related-products="true" style="display:block !important;padding:24px 16px;border-top:1px solid #e5e7eb;max-width:1200px;margin:0 auto;background:#fff;clear:both;overflow:visible;visibility:visible !important;opacity:1 !important;min-height:390px;"><h2 style="font-size:18px;line-height:1.25;font-weight:600;margin:0 0 16px;color:#333;">Quem viu este produto também comprou</h2><div data-related-scroller="true" style="display:flex !important;gap:12px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding-bottom:14px;-webkit-overflow-scrolling:touch;min-height:350px;visibility:visible !important;opacity:1 !important;">${cards}</div></section>`;
}

function buildRelatedFallbackScript() {
  const cards = ALL_PRODUCTS.filter((product) => product.id !== MAIN_PRODUCT_ID)
    .map(productCard)
    .join("");

  return `<script>(function(){var cards=${JSON.stringify(cards)};function forceStyles(section,scroller){section.id='related-products-fixed';section.setAttribute('data-related-products','true');section.style.cssText='display:block !important;padding:24px 16px;border-top:1px solid #e5e7eb;max-width:1200px;margin:0 auto;background:#fff;clear:both;overflow:visible;visibility:visible !important;opacity:1 !important;min-height:390px;';scroller.setAttribute('data-related-scroller','true');scroller.style.cssText='display:flex !important;gap:12px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;padding-bottom:14px;-webkit-overflow-scrolling:touch;min-height:350px;visibility:visible !important;opacity:1 !important;';}function mount(){var section=document.getElementById('related-products-fixed')||document.querySelector('[data-related-products="true"]');if(!section){section=document.createElement('section');section.innerHTML='<h2 style="font-size:18px;line-height:1.25;font-weight:600;margin:0 0 16px;color:#333;">Quem viu este produto também comprou</h2><div data-related-scroller="true"></div>';var footer=document.querySelector('footer');if(footer&&footer.parentNode){footer.parentNode.insertBefore(section,footer)}else{document.body.appendChild(section)}}var scroller=section.querySelector('[data-related-scroller="true"]');if(!scroller){scroller=document.createElement('div');section.appendChild(scroller)}forceStyles(section,scroller);if(scroller.querySelectorAll('[data-product-card]').length<5){scroller.innerHTML=cards}Array.prototype.forEach.call(scroller.querySelectorAll('[data-product-card]'),function(card){card.style.setProperty('display','block','important');card.style.setProperty('visibility','visible','important');card.style.setProperty('opacity','1','important');card.style.pointerEvents='auto';var img=card.querySelector('img');if(img){img.style.setProperty('display','block','important');img.style.setProperty('visibility','visible','important');img.style.setProperty('opacity','1','important')}card.onclick=function(e){e.preventDefault();var href=card.getAttribute('href');if(!href)return;window.__showProductLoader&&window.__showProductLoader();var next=href.split('?')[0]+(window.location.search||'');setTimeout(function(){window.location.href=next;},60);};});}if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',mount)}else{mount()}setTimeout(mount,100);setTimeout(mount,500);setTimeout(mount,1500);window.addEventListener('pageshow',mount);})();</script>`;
}

const relatedSectionPattern = /<section class="px-4 md:px-8 py-6 border-t border-gray-200 max-w-\[1200px\] mx-auto"><h2 class="text-lg font-semibold mb-4">Quem viu este produto também comprou<\/h2>[\s\S]*?<\/section>/;
const relatedSection = buildRelatedSection();
const optimizedHtml = html
  .replace(/seg\. 24 de agosto/g, "qui. 27 de agosto")
  .replace(/<script[^>]+src="\/clone-assets\/js\/~flock\.js"[^>]*><\/script>/, "")
  .replace(/<script[^>]+src="\/clone-assets\/js\/latest\.js"[^>]*><\/script>/, "")
  .replace(/<script>\s*window\.pixelId\s*=\s*"[^"]+";[\s\S]*?<\/script>/, "")
  .replace(/<script[^>]+src="\/clone-assets\/js\/pixel\.js"[^>]*><\/script>/, "");
const pageHtmlWithoutOldRelated = optimizedHtml.replace(relatedSectionPattern, "");
const footerOpenIndex = pageHtmlWithoutOldRelated.search(/<footer[\s>]/);
const pageHtmlWithRelated =
  footerOpenIndex >= 0
    ? pageHtmlWithoutOldRelated.slice(0, footerOpenIndex) +
      relatedSection +
      pageHtmlWithoutOldRelated.slice(footerOpenIndex)
    : pageHtmlWithoutOldRelated.includes("</body>")
      ? pageHtmlWithoutOldRelated.replace("</body>", `${relatedSection}</body>`)
      : `${pageHtmlWithoutOldRelated}${relatedSection}`;

const homepageTrackingScript = buildHomepageTrackingScript();
const relatedFallbackScript = buildRelatedFallbackScript();
const injectedTail = `${PRODUCT_LOADING_SCRIPT}${homepageTrackingScript}${relatedFallbackScript}${SELLER_MODAL_HTML}${SELLER_MODAL_SCRIPT}`;
const pageHtml = pageHtmlWithRelated.includes("</body>")
  ? pageHtmlWithRelated.replace("</body>", `${injectedTail}</body>`)
  : `${pageHtmlWithRelated}${injectedTail}`;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Jogo de Panelas Antiaderente 10 Peças" },
      {
        name: "description",
        content:
          "Oferta de jogo de panelas antiaderente com frete grátis, avaliações e produtos relacionados.",
      },
      { property: "og:title", content: "Jogo de Panelas Antiaderente 10 Peças" },
      {
        property: "og:description",
        content:
          "Oferta de jogo de panelas antiaderente com frete grátis, avaliações e produtos relacionados.",
      },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  server: {
    handlers: {
      GET: () =>
        new Response(pageHtml, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=86400",
          },
        }),
    },
  },
});
