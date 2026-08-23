import { createServerFn } from "@tanstack/react-start";

type DiagnosticResult = {
  ok: boolean;
  apiConfigured: boolean;
  secretConfigured: boolean;
  sender: string;
  httpStatus?: number;
  senderFound?: boolean;
  senderActive?: boolean;
  message: string;
  details?: string;
};

function safeText(value: unknown, max = 500) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return String(text || "").replace(/[\r\n]+/g, " ").slice(0, max);
}

export const diagnoseMailjet = createServerFn({ method: "GET" }).handler(
  async (): Promise<DiagnosticResult> => {
    const apiKey = process.env.MAILJET_API_KEY?.trim() || "";
    const secretKey = process.env.MAILJET_SECRET_KEY?.trim() || "";
    const sender = (process.env.PIX_EMAIL_FROM || "sitegrande@proton.me").trim();

    if (!apiKey || !secretKey) {
      return {
        ok: false,
        apiConfigured: Boolean(apiKey),
        secretConfigured: Boolean(secretKey),
        sender,
        message: "As variáveis MAILJET_API_KEY e/ou MAILJET_SECRET_KEY não estão disponíveis neste deployment.",
      };
    }

    const auth = Buffer.from(`${apiKey}:${secretKey}`, "utf8").toString("base64");
    const url = `https://api.mailjet.com/v3/REST/sender?Email=${encodeURIComponent(sender)}&Limit=20`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: `Basic ${auth}`,
        },
      });

      const raw = await response.text();
      let payload: any = null;
      try {
        payload = JSON.parse(raw);
      } catch {}

      if (!response.ok) {
        return {
          ok: false,
          apiConfigured: true,
          secretConfigured: true,
          sender,
          httpStatus: response.status,
          message:
            response.status === 401
              ? "Mailjet recusou a autenticação. Confira API Key e Secret Key na Vercel."
              : `Mailjet respondeu HTTP ${response.status}.`,
          details: safeText(payload || raw),
        };
      }

      const senders = Array.isArray(payload?.Data) ? payload.Data : [];
      const exact = senders.find(
        (item: any) => String(item?.Email || "").toLowerCase() === sender.toLowerCase(),
      );

      if (!exact) {
        return {
          ok: false,
          apiConfigured: true,
          secretConfigured: true,
          sender,
          httpStatus: response.status,
          senderFound: false,
          message: `A autenticação funcionou, mas o remetente ${sender} não foi encontrado na conta Mailjet desta API Key.`,
          details: `Remetentes retornados: ${senders.length}`,
        };
      }

      const status = String(exact?.Status || exact?.status || "").toLowerCase();
      const active =
        exact?.IsActive === true ||
        exact?.Active === true ||
        status === "active" ||
        status === "validated" ||
        status === "verified";

      return {
        ok: active,
        apiConfigured: true,
        secretConfigured: true,
        sender,
        httpStatus: response.status,
        senderFound: true,
        senderActive: active,
        message: active
          ? "Mailjet autenticou corretamente e o remetente foi encontrado como ativo/validado."
          : "Mailjet autenticou corretamente e encontrou o remetente, mas ele não parece ativo/validado.",
        details: safeText({
          ID: exact?.ID,
          Email: exact?.Email,
          Status: exact?.Status,
          IsActive: exact?.IsActive,
          Active: exact?.Active,
        }),
      };
    } catch (error) {
      return {
        ok: false,
        apiConfigured: true,
        secretConfigured: true,
        sender,
        message: "Não foi possível conectar à API da Mailjet a partir da Vercel.",
        details: safeText(error instanceof Error ? error.message : error),
      };
    }
  },
);
