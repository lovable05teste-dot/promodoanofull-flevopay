import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Comprovantes de pagamento" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AdminReceiptsPage,
});

type Receipt = {
  name: string;
  uploadedAt: string;
  size: number;
  contentType: string;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function AdminReceiptsPage() {
  const [password, setPassword] = useState("");
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadReceipts() {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/receipts", {
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        message?: string;
        receipts?: Receipt[];
      };
      if (response.status === 401) {
        setAuthenticated(false);
        setReceipts([]);
      } else if (!response.ok) {
        setMessage(payload.message || "Não foi possível carregar os comprovantes.");
      } else {
        setAuthenticated(true);
        setReceipts(payload.receipts || []);
      }
    } catch {
      setMessage("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReceipts();
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const payload = (await response.json()) as { ok?: boolean; message?: string };
      if (!response.ok) {
        setMessage(payload.message || "Senha incorreta.");
        return;
      }
      setPassword("");
      setAuthenticated(true);
      await loadReceipts();
    } catch {
      setMessage("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" });
    setAuthenticated(false);
    setReceipts([]);
  }

  return (
    <main className="min-h-screen bg-[#ededed] px-4 py-8" style={{ fontFamily: "Arial, sans-serif" }}>
      <section className="mx-auto max-w-[820px] rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Comprovantes de pagamento</h1>
            <p className="mt-1 text-sm text-gray-500">Arquivos enviados pelos clientes.</p>
          </div>
          {authenticated && (
            <div className="flex gap-2">
              <button type="button" onClick={() => void loadReceipts()} className="rounded-md border border-[#3483fa] px-4 py-2 text-sm font-semibold text-[#3483fa]">
                Atualizar
              </button>
              <button type="button" onClick={() => void logout()} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
                Sair
              </button>
            </div>
          )}
        </div>

        {!authenticated && !loading && (
          <form onSubmit={login} className="mt-7 max-w-sm">
            <label htmlFor="admin-password" className="block text-sm font-semibold text-gray-800">Senha do administrador</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-3 outline-none focus:border-[#3483fa]"
              required
            />
            <button type="submit" className="mt-3 w-full rounded-md bg-[#3483fa] px-4 py-3 font-semibold text-white">
              Entrar
            </button>
          </form>
        )}

        {message && <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</div>}

        {loading && <div className="mt-8 text-sm text-gray-500">Carregando…</div>}

        {authenticated && !loading && (
          <div className="mt-7">
            {receipts.length === 0 ? (
              <div className="rounded-lg bg-gray-50 p-8 text-center text-sm text-gray-500">Nenhum comprovante enviado.</div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {receipts.map((receipt) => (
                  <div key={receipt.name} className="flex flex-col gap-3 border-b border-gray-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{receipt.name.replace(/^\d+-[a-f0-9]+-/, "")}</div>
                      <div className="mt-1 text-xs text-gray-500">
                        {new Date(receipt.uploadedAt).toLocaleString("pt-BR", { timeZone: "America/Cuiaba" })} · {formatSize(receipt.size)}
                      </div>
                    </div>
                    <a
                      href={`/api/admin/receipts/file?name=${encodeURIComponent(receipt.name)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 rounded-md bg-[#3483fa] px-4 py-2 text-center text-sm font-semibold text-white"
                    >
                      Abrir / baixar
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
