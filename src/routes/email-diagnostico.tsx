import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { diagnoseMailjet } from "@/lib/mailjet-diagnostic.functions";

export const Route = createFileRoute("/email-diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico de e-mail" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: EmailDiagnosticPage,
});

type Result = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof diagnoseMailjet>>>>;

function EmailDiagnosticPage() {
  const runDiagnostic = useServerFn(diagnoseMailjet);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      setResult(await runDiagnostic());
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Falha ao executar diagnóstico.",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f5f5] px-4 py-8" style={{ fontFamily: "Arial, sans-serif" }}>
      <section className="mx-auto max-w-[620px] rounded-xl bg-white p-6 shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-900">Diagnóstico Mailjet</h1>
        <p className="mt-2 text-sm text-gray-600">
          Este teste não gera Pix, não cria cobrança e não envia e-mail. Ele apenas confirma se a Vercel consegue autenticar na Mailjet e se o remetente configurado existe.
        </p>

        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="mt-5 w-full rounded-lg bg-[#3483fa] px-4 py-3 font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Verificando..." : "Verificar configuração"}
        </button>

        {result && (
          <div className={`mt-5 rounded-lg border p-4 ${result.ok ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
            <div className="font-bold text-gray-900">{result.ok ? "Configuração OK" : "Encontramos um problema"}</div>
            <div className="mt-2 text-sm text-gray-800">{result.message}</div>

            <dl className="mt-4 space-y-2 text-sm">
              <div><dt className="font-semibold inline">API Key carregada: </dt><dd className="inline">{result.apiConfigured ? "Sim" : "Não"}</dd></div>
              <div><dt className="font-semibold inline">Secret Key carregada: </dt><dd className="inline">{result.secretConfigured ? "Sim" : "Não"}</dd></div>
              {result.sender && <div><dt className="font-semibold inline">Remetente: </dt><dd className="inline break-all">{result.sender}</dd></div>}
              {typeof result.httpStatus === "number" && <div><dt className="font-semibold inline">HTTP Mailjet: </dt><dd className="inline">{result.httpStatus}</dd></div>}
              {typeof result.senderFound === "boolean" && <div><dt className="font-semibold inline">Remetente encontrado: </dt><dd className="inline">{result.senderFound ? "Sim" : "Não"}</dd></div>}
              {typeof result.senderActive === "boolean" && <div><dt className="font-semibold inline">Remetente ativo: </dt><dd className="inline">{result.senderActive ? "Sim" : "Não"}</dd></div>}
            </dl>

            {result.details && (
              <pre className="mt-4 overflow-auto rounded bg-white p-3 text-xs text-gray-700 border border-gray-200 whitespace-pre-wrap break-words">{result.details}</pre>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
