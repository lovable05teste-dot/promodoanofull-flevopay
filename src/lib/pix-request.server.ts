import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { getCookie, getRequest, setCookie } from "@tanstack/react-start/server";
import { PIX_UNAVAILABLE_MESSAGE } from "./pix-limit.server.ts";

export function normalizeClientIp(value: string) {
  const ip = value.trim();
  if (!isIP(ip)) throw new Error(PIX_UNAVAILABLE_MESSAGE);
  if (isIP(ip) === 4) return ip;
  const canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase();
  if (canonical.startsWith("::ffff:")) {
    const words = canonical.slice(7).split(":");
    if (words.length === 2) {
      const n = parseInt(words[0], 16) * 65536 + parseInt(words[1], 16);
      return `${Math.floor(n / 16777216)}.${Math.floor(n / 65536) % 256}.${Math.floor(n / 256) % 256}.${n % 256}`;
    }
  }
  // /64 evita trocar só o endereço IPv6 de privacidade.
  const halves = canonical.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const words =
    halves.length === 2
      ? [...left, ...Array(8 - left.length - right.length).fill("0"), ...right]
      : left;
  return `${words
    .slice(0, 4)
    .map((word) => word.padStart(4, "0"))
    .join(":")}::/64`;
}
export function trustedPixIp(request: Request, onVercel = process.env.VERCEL === "1") {
  if (!onVercel) {
    const host = new URL(request.url).hostname;
    if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1", "[::1]"].includes(host))
      return "127.0.0.1";
    throw new Error(PIX_UNAVAILABLE_MESSAGE);
  }
  // Vercel sobrescreve x-forwarded-for. Não confiar em IP no JSON ou cf-connecting-ip.
  // Uma lista de proxies não configurados é rejeitada.
  return normalizeClientIp(request.headers.get("x-forwarded-for") || "");
}
const COOKIE = "pix_browser_v2";
function signature(id: string, secret: string) {
  return createHmac("sha256", secret).update(`pix-browser:${id}`).digest("hex");
}
export function verifyPixBrowserCookie(value: string, secret: string) {
  const [id, mac, extra] = value.split(".");
  if (extra !== undefined || !/^[0-9a-f-]{36}$/.test(id || "") || !/^[0-9a-f]{64}$/.test(mac || ""))
    return "";
  return timingSafeEqual(Buffer.from(signature(id, secret), "hex"), Buffer.from(mac, "hex"))
    ? id
    : "";
}
export function pixRequestContext(apiToken: string) {
  const secret = process.env.PIX_LIMIT_SECRET?.trim() || apiToken;
  const request = getRequest();
  const ip = trustedPixIp(request);
  let browserId = verifyPixBrowserCookie(getCookie(COOKIE) || "", secret);
  if (!browserId) {
    browserId = randomUUID();
    setCookie(COOKIE, `${browserId}.${signature(browserId, secret)}`, {
      httpOnly: true,
      sameSite: "strict",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return { ip, secret, browserId };
}
