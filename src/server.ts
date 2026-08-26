import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  adminIsConfigured,
  adminSessionToken,
  listReceipts,
  readReceipt,
  saveReceipt,
  validAdminPassword,
  validAdminSession,
} from "./lib/receipt-storage.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

const ADMIN_COOKIE = "receipt_admin";

function json(data: unknown, status = 200, headers?: HeadersInit) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

async function isAdmin(request: Request) {
  return validAdminSession(cookieValue(request, ADMIN_COOKIE));
}

function adminCookie(request: Request, token: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${ADMIN_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

function safeDownloadName(name: string) {
  return name.replace(/["\\\r\n]/g, "-");
}

async function handleReceiptApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);

  if (url.pathname === "/api/receipts" && request.method === "POST") {
    try {
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > 5 * 1024 * 1024) {
        return json({ ok: false, message: "O comprovante deve ter no máximo 4 MB." }, 413);
      }
      const form = await request.formData();
      const candidate = form.get("file");
      if (!candidate || typeof candidate === "string" || typeof candidate.arrayBuffer !== "function") {
        return json({ ok: false, message: "Selecione uma imagem ou PDF." }, 400);
      }
      const receipt = await saveReceipt(candidate as File);
      return json({ ok: true, receipt }, 201);
    } catch (error) {
      return json(
        { ok: false, message: error instanceof Error ? error.message : "Falha ao enviar comprovante." },
        400,
      );
    }
  }

  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    if (!adminIsConfigured()) {
      return json({ ok: false, message: "ADMIN_PASSWORD não está configurada na Vercel." }, 503);
    }
    let password = "";
    try {
      const body = (await request.json()) as { password?: unknown };
      password = typeof body.password === "string" ? body.password.slice(0, 256) : "";
    } catch {}
    if (!(await validAdminPassword(password))) {
      return json({ ok: false, message: "Senha incorreta." }, 401);
    }
    return json(
      { ok: true },
      200,
      { "set-cookie": adminCookie(request, await adminSessionToken(), 8 * 60 * 60) },
    );
  }

  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "set-cookie": adminCookie(request, "", 0) });
  }

  if (url.pathname === "/api/admin/receipts" && request.method === "GET") {
    if (!(await isAdmin(request))) return json({ ok: false, message: "Não autorizado." }, 401);
    try {
      return json({ ok: true, receipts: await listReceipts() });
    } catch (error) {
      return json(
        { ok: false, message: error instanceof Error ? error.message : "Falha ao listar comprovantes." },
        500,
      );
    }
  }

  if (url.pathname === "/api/admin/receipts/file" && request.method === "GET") {
    if (!(await isAdmin(request))) return json({ ok: false, message: "Não autorizado." }, 401);
    const name = url.searchParams.get("name") || "";
    try {
      const file = await readReceipt(name);
      return new Response(file.bytes, {
        headers: {
          "content-type": file.contentType,
          "content-disposition": `inline; filename="${safeDownloadName(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      return json(
        { ok: false, message: error instanceof Error ? error.message : "Arquivo não encontrado." },
        404,
      );
    }
  }

  return null;
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const apiResponse = await handleReceiptApi(request);
      if (apiResponse) return apiResponse;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
