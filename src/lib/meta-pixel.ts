export const META_PIXEL_ID = "4686534118338697";

/** Bootstrap único do Pixel Meta, preservando eventID do InitiateCheckout. */
export const META_PIXEL_LOADER = `(function(f,b,e,v,n,t,s){
  if(f.__storeMetaPixelId === "${META_PIXEL_ID}") return;
  f.__storeMetaPixelId = "${META_PIXEL_ID}";
  if(!f.fbq){
    n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];
    t=b.createElement(e);t.async=!0;t.src=v;
    s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s);
  }
  f.fbq('init', '${META_PIXEL_ID}');
  f.fbq('track', 'PageView');
})(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');`;
