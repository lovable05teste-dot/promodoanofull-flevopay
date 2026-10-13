import { PROTECTION_IMAGE } from './site-protection-image';

// Deterrence only: public browser assets cannot be made impossible to download.
export function protectionScript(hosts: string[], image: string, development = false) {
  return `(${installProtection.toString()})(${JSON.stringify(hosts)},${JSON.stringify(image)},${development});`;
}

function installProtection(hosts: string[], image: string, development: boolean) {
  const host = location.hostname.toLowerCase();
  const local = development && ['localhost', '127.0.0.1', '[::1]'].includes(host);
  const allowed = ['https:', 'http:'].includes(location.protocol) && (hosts.includes(host) || local);
  const editable = (target: EventTarget | null) => target instanceof Element && Boolean(target.closest('input,textarea,[contenteditable="true"]'));
  document.addEventListener('contextmenu', (event) => {
    if (!editable(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('dragstart', (event) => {
    if (event.target instanceof Element && event.target.closest('img,picture,video')) event.preventDefault();
  }, true);
  document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    const modifier = event.ctrlKey || event.metaKey;
    if (key === 'f12' || (modifier && ['s', 'u'].includes(key)) || (modifier && event.shiftKey && ['i', 'j', 'c'].includes(key))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  const css = document.createElement('style');
  css.textContent = 'img,picture,video{-webkit-user-drag:none;-webkit-touch-callout:none}';
  document.head.appendChild(css);
  if (allowed) return;
  // Inline image and styles survive ordinary HTML/ZIP export with scripts intact.
  css.textContent += 'body>*{display:none!important}body>[data-copy-blocked]{display:flex!important;position:fixed;inset:0;z-index:2147483647;align-items:center;justify-content:center;flex-direction:column;background:#090909;color:white;font:600 20px system-ui;text-align:center;padding:24px;gap:20px}';
  const show = () => {
    const overlay = document.createElement('div');
    overlay.setAttribute('data-copy-blocked', 'true');
    const photo = document.createElement('img');
    photo.src = image;
    photo.alt = 'CLOKER';
    photo.style.cssText = 'width:min(80vw,420px);height:auto';
    const text = document.createElement('p');
    text.textContent = 'Cópia não autorizada. Acesse o site oficial.';
    overlay.append(photo, text);
    document.body.appendChild(overlay);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
}

const hosts = ['quiemadolivrepro.vercel.app', 'promodoanofull-flevopay.vercel.app', 'promo-doano-full.vercel.app'];
// Explicitly register additional domains/previews before publishing to them.
const configured = [import.meta.env.VITE_SITE_ALLOWED_HOSTS, import.meta.env.VITE_SITE_DEPLOYMENT_HOSTS].filter(Boolean).join(',');
hosts.push(...configured.split(',').map((host: string) => host.trim().toLowerCase()).filter(Boolean));
export const SITE_PROTECTION_SCRIPT = protectionScript(hosts, PROTECTION_IMAGE, import.meta.env.DEV);

// Independent checks in the page runtime and purchase handlers survive removal
// of the initial inline script. They are still a deterrent, not DRM.
export function enforceSiteDomain() {
  const local = import.meta.env.DEV && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const allowed = ['https:', 'http:'].includes(location.protocol) && (hosts.includes(location.hostname.toLowerCase()) || local);
  if (!allowed && !document.querySelector('[data-copy-blocked]')) installProtection(hosts, PROTECTION_IMAGE, import.meta.env.DEV);
  return allowed;
}

function installNavigationGuard(hosts: string[], development: boolean) {
  const check = () => {
    const host = location.hostname.toLowerCase();
    const local = development && ['localhost', '127.0.0.1', '[::1]'].includes(host);
    const allowed = ['https:', 'http:'].includes(location.protocol) && (hosts.includes(host) || local);
    if (!allowed) {
      const fallback = document.querySelector<HTMLElement>('[data-copy-fallback]');
      if (fallback) {
        fallback.style.setProperty('display', 'flex', 'important');
        const style = document.createElement('style');
        style.textContent = 'body>*{display:none!important}body>[data-copy-fallback]{display:flex!important}';
        document.head.appendChild(style);
      }
    }
    return allowed;
  };
  document.addEventListener('click', (event) => {
    if (!check()) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener('pageshow', check);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check, { once: true });
  else check();
}

export const DOMAIN_NAVIGATION_SCRIPT = `(${installNavigationGuard.toString()})(${JSON.stringify(hosts)},${import.meta.env.DEV});`;
export const PROTECTION_FALLBACK_HTML = `<style>[data-copy-fallback]{display:none}@media print{body>*{display:none!important}body>[data-copy-fallback]{display:flex!important}}</style><div data-copy-fallback style="position:fixed;inset:0;z-index:2147483647;align-items:center;justify-content:center;flex-direction:column;background:#090909;color:white;gap:20px;padding:24px;text-align:center"><img src="${PROTECTION_IMAGE}" alt="CLOKER" style="width:min(80vw,420px);height:auto"><p>Cópia não autorizada. Acesse o site oficial com JavaScript ativado.</p></div><noscript><style>body>*{display:none!important}body>[data-copy-fallback]{display:flex!important}</style></noscript>`;
