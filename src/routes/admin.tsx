import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Painel da loja · Funil e pagamentos" },
      { name: "robots", content: "noindex,nofollow,noarchive" },
    ],
  }),
  component: AdminPage,
});

type Receipt = { name: string; uploadedAt: string; size: number; contentType: string };
type FunnelEvent = {
  id: string;
  type: "InitiateCheckout" | "PixGenerated" | "PixPaid";
  at: string;
  sessionId: string;
  productId: string;
  productName: string;
  amountCents: number;
  transactionId?: string;
  customer?: { name: string; email: string; phone: string };
  traffic?: Record<string, string>;
  location?: { maskedIp: string; city: string; region: string; country: string };
};
type Tab = "resumo" | "ic" | "pix" | "comprovantes" | "integracoes";
function brl(cents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((cents || 0) / 100);
}
function date(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("pt-BR", { timeZone: "America/Campo_Grande" });
}
function location(event?: FunnelEvent) {
  if (!event?.location) return "Não informada";
  const { city, region, country } = event.location;
  return [city, region, country].filter(Boolean).join(" · ") || "Não informada";
}
function source(event?: FunnelEvent) {
  const t = event?.traffic || {};
  return [t.utm_source || t.src, t.utm_campaign].filter(Boolean).join(" / ") || "Direto / não identificado";
}
function maskPhone(value?: string) {
  const d = (value || "").replace(/\D/g, "");
  return d.length >= 4 ? "•••• " + d.slice(-4) : "—";
}
function size(bytes: number) {
  return bytes < 1024 * 1024 ? Math.round(bytes / 1024) + " KB" : (bytes / 1024 / 1024).toFixed(1) + " MB";
}
function Stat({ title, value, caption }: { title: string; value: string; caption: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="text-sm text-slate-500">{title}</div>
    <div className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{value}</div>
    <div className="mt-2 text-xs text-slate-500">{caption}</div>
  </div>;
}
function SectionTitle({ title, desc }: { title: string; desc: string }) {
  return <div className="mb-4"><h2 className="text-xl font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{desc}</p></div>;
}
function Empty({ message }: { message: string }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{message}</div>;
}

function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [funnelMessage, setFunnelMessage] = useState("");
  const [receiptMessage, setReceiptMessage] = useState("");
  const [limited, setLimited] = useState(false);
  const [events, setEvents] = useState<FunnelEvent[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [tab, setTab] = useState<Tab>("resumo");
  const [search, setSearch] = useState("");

  async function load() {
    setBusy(true);
    setMessage("");
    try {
      const [funnelResponse, receiptResponse] = await Promise.all([
        fetch("/api/admin/funnel", { credentials: "same-origin", cache: "no-store" }),
        fetch("/api/admin/receipts", { credentials: "same-origin", cache: "no-store" }),
      ]);
      if (funnelResponse.status === 401 || receiptResponse.status === 401) {
        setAuthenticated(false); setEvents([]); setReceipts([]); return;
      }
      setAuthenticated(true);
      const funnel = await funnelResponse.json() as { ok?: boolean; message?: string; events?: FunnelEvent[]; limited?: boolean };
      const stored = await receiptResponse.json() as { ok?: boolean; message?: string; receipts?: Receipt[] };
      setFunnelMessage(funnelResponse.ok ? "" : funnel.message || "Eventos indisponíveis.");
      setReceiptMessage(receiptResponse.ok ? "" : stored.message || "Comprovantes indisponíveis.");
      setEvents(funnelResponse.ok && Array.isArray(funnel.events) ? funnel.events : []);
      setReceipts(receiptResponse.ok && Array.isArray(stored.receipts) ? stored.receipts : []);
      setLimited(Boolean(funnel.limited));
    } catch {
      setMessage("Não foi possível consultar o servidor. Tente novamente.");
    } finally {
      setBusy(false); setLoading(false);
    }
  }
  useEffect(() => { void load(); }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    if (!password || busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST", credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) { setMessage(data.message || "Não foi possível entrar."); return; }
      setPassword(""); setAuthenticated(true);
      await load();
    } catch {
      setMessage("Erro de conexão.");
    } finally { setBusy(false); }
  }
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    setAuthenticated(false); setEvents([]); setReceipts([]); setTab("resumo");
  }
  const report = useMemo(() => {
    const ic = events.filter(e => e.type === "InitiateCheckout");
    const pix = events.filter(e => e.type === "PixGenerated");
    const paidIds = new Set(events.filter(e => e.type === "PixPaid").map(e => e.transactionId));
    const latestPix = new Map<string, FunnelEvent>();
    const seenTransactions = new Set<string>();
    for (const event of pix) {
      if (!event.transactionId || seenTransactions.has(event.transactionId)) continue;
      seenTransactions.add(event.transactionId);
      latestPix.set(event.sessionId, latestPix.get(event.sessionId) || event);
    }
    const uniquePix = pix.filter(e => !e.transactionId || latestPix.get(e.sessionId)?.id === e.id);
    const icUnique = ic.filter((e, index, all) => all.findIndex(x => x.sessionId === e.sessionId) === index);
    const rows = icUnique.map(event => ({ event, buyer: latestPix.get(event.sessionId) }));
    return { ic: icUnique, pix: uniquePix, paidIds, rows, latestPix };
  }, [events]);
  const searchValue = search.trim().toLowerCase();
  const filteredIc = report.rows.filter(({ event, buyer }) => !searchValue || [
    buyer?.customer?.name, buyer?.customer?.email, event.productName, event.sessionId, source(event),
  ].join(" ").toLowerCase().includes(searchValue));
  const filteredPix = report.pix.filter(event => !searchValue || [
    event.customer?.name, event.customer?.email, event.productName, event.transactionId,
  ].join(" ").toLowerCase().includes(searchValue));
  const approved = report.pix.filter(e => report.paidIds.has(e.transactionId));
  const tabs: Array<{ id: Tab; title: string }> = [
    { id: "resumo", title: "Visão geral" }, { id: "ic", title: "Inícios de checkout" },
    { id: "pix", title: "Pix e clientes" }, { id: "comprovantes", title: "Comprovantes" },
    { id: "integracoes", title: "Integrações" },
  ];

  return <main className="min-h-screen bg-[#f2f5f9] px-4 pb-14 pt-8 text-slate-900" style={{ fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Arial, sans-serif" }}>
    <div className="mx-auto max-w-[1180px]">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div><div className="text-sm font-bold uppercase tracking-[.18em] text-[#2563eb]">Central da loja</div>
          <h1 className="mt-1 text-3xl font-bold">Painel administrativo</h1>
          <p className="mt-1 text-sm text-slate-500">Funil próprio, clientes e pagamentos · Horário de Campo Grande</p></div>
        {authenticated && <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={busy} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">{busy ? "Atualizando..." : "Atualizar"}</button>
          <button type="button" onClick={() => void logout()} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold">Sair</button>
        </div>}
      </header>
      {!authenticated ? (
        <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-lg font-bold">Acesso restrito</h2>
          <p className="mt-1 text-sm text-slate-500">Entre com a senha de administrador configurada no servidor.</p>
          {loading ? <p className="mt-6 text-sm text-slate-500">Validando sessão...</p> : <form className="mt-6" onSubmit={login}>
            <label htmlFor="admin-password" className="text-sm font-semibold">Senha</label>
            <input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-2 block w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500" />
            <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-[#2563eb] px-4 py-3 font-bold text-white disabled:opacity-50">Entrar</button>
          </form>}
          {message && <p role="alert" className="mt-4 text-sm text-red-700">{message}</p>}
        </section>
      ) : (
        <>
          <nav className="mb-6 flex gap-2 overflow-x-auto pb-2" aria-label="Navegação do painel">
            {tabs.map(item => <button type="button" key={item.id} onClick={() => setTab(item.id)} className={"shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold " + (tab === item.id ? "bg-[#2563eb] text-white" : "border border-slate-200 bg-white text-slate-600")}>{item.title}</button>)}
          </nav>
          {message && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{message}</p>}
          {funnelMessage && <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Eventos: {funnelMessage}</p>}
          {limited && <p className="mb-5 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600">Exibindo somente os 120 eventos mais recentes. Para relatórios completos, conecte um banco de dados.</p>}
          {tab === "resumo" && <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat title="Inícios de checkout" value={funnelMessage ? "—" : String(report.ic.length)} caption="Cliques registrados pelo próprio site" />
              <Stat title="Pix gerados" value={funnelMessage ? "—" : String(report.pix.length)} caption="Cobranças criadas na FortPay" />
              <Stat title="Pix confirmados" value={funnelMessage ? "—" : String(approved.length)} caption="Confirmações observadas na consulta de status" />
              <Stat title="Valor de Pix gerados" value={funnelMessage ? "—" : brl(report.pix.reduce((s, e) => s + e.amountCents, 0))} caption="Não é faturamento recebido" />
            </div>
            <div className="mt-7 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionTitle title="Últimos checkouts" desc="O nome fica visível se o visitante gerar um Pix na mesma sessão." />
                {report.rows.length === 0 ? <Empty message="Nenhum início de checkout registrado ainda." /> : report.rows.slice(0, 6).map(({ event, buyer }) => <div key={event.id} className="flex items-center justify-between gap-4 border-t border-slate-100 py-3 text-sm">
                  <div className="min-w-0"><div className="truncate font-semibold">{buyer?.customer?.name || "Visitante ainda não identificado"}</div><div className="truncate text-slate-500">{event.productName} · {location(event)}</div></div><span className="shrink-0 text-xs text-slate-500">{date(event.at)}</span>
                </div>)}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <SectionTitle title="Últimos Pix" desc="Cada Pix é associado ao produto e à sessão que iniciou o checkout." />
                {report.pix.length === 0 ? <Empty message="Nenhum Pix registrado ainda." /> : report.pix.slice(0, 6).map(event => <div key={event.id} className="flex items-center justify-between gap-4 border-t border-slate-100 py-3 text-sm">
                  <div className="min-w-0"><div className="truncate font-semibold">{event.customer?.name || "Cliente"}</div><div className="truncate text-slate-500">{event.productName}</div></div><strong className="shrink-0">{brl(event.amountCents)}</strong>
                </div>)}
              </section>
            </div>
          </>}
          {(tab === "ic" || tab === "pix") && <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <SectionTitle title={tab === "ic" ? "Quem iniciou o checkout" : "Pix e clientes"} desc={tab === "ic" ? "IP mascarado e localização aproximada. Quem não gerou Pix pode permanecer anônimo." : "Dados registrados após a criação real de uma cobrança."} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente, produto ou campanha" aria-label="Pesquisar eventos" className="w-full max-w-sm rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500" />
            </div>
            {tab === "ic" ? <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {filteredIc.length === 0 ? <Empty message="Nenhum checkout encontrado." /> : <table className="w-full min-w-[940px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Quando</th><th className="p-4">Pessoa</th><th className="p-4">Produto</th><th className="p-4">Origem</th><th className="p-4">IP parcial</th><th className="p-4">Localização</th><th className="p-4">Situação</th></tr></thead>
                <tbody>{filteredIc.map(({ event, buyer }) => <tr key={event.id} className="border-t border-slate-100 align-top">
                  <td className="p-4 whitespace-nowrap">{date(event.at)}</td>
                  <td className="p-4"><strong>{buyer?.customer?.name || "Não identificado"}</strong>{buyer?.customer?.email && <div className="text-xs text-slate-500">{buyer.customer.email}</div>}</td>
                  <td className="p-4">{event.productName}<div className="text-xs text-slate-500">{brl(event.amountCents)}</div></td>
                  <td className="p-4">{source(event)}</td><td className="p-4">{event.location?.maskedIp || "Não disponível"}</td><td className="p-4">{location(event)}</td>
                  <td className="p-4 font-medium">{buyer ? "Pix gerado" : "IC iniciado"}</td>
                </tr>)}</tbody>
              </table>}
            </div> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              {filteredPix.length === 0 ? <Empty message="Nenhum Pix encontrado." /> : <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-4">Quando</th><th className="p-4">Cliente</th><th className="p-4">Produto</th><th className="p-4">Valor</th><th className="p-4">Transação</th><th className="p-4">Status</th></tr></thead>
                <tbody>{filteredPix.map(event => <tr key={event.id} className="border-t border-slate-100 align-top"><td className="p-4 whitespace-nowrap">{date(event.at)}</td>
                  <td className="p-4"><strong>{event.customer?.name || "—"}</strong><div className="text-xs text-slate-500">{event.customer?.email || ""}<br />{maskPhone(event.customer?.phone)}</div></td>
                  <td className="p-4">{event.productName}</td><td className="p-4 font-semibold">{brl(event.amountCents)}</td>
                  <td className="p-4 text-xs break-all">{event.transactionId || "—"}</td>
                  <td className="p-4 font-medium">{report.paidIds.has(event.transactionId) ? "Confirmado" : "Pix gerado · sem confirmação"}</td></tr>)}</tbody>
              </table>}
            </div>}
          </>}
          {tab === "comprovantes" && <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <SectionTitle title="Comprovantes enviados" desc="Arquivos privados acessíveis somente após login." />
            {receiptMessage && <p className="mb-4 text-sm text-amber-700">{receiptMessage}</p>}
            {receipts.length === 0 ? <Empty message="Nenhum comprovante disponível." /> : receipts.map(receipt =>
              <div key={receipt.name} className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 py-4 text-sm">
                <div className="min-w-0"><strong className="break-all">{receipt.name.replace(/^\d+-[a-f0-9]+-/, "")}</strong><p className="text-xs text-slate-500">{date(receipt.uploadedAt)} · {size(receipt.size)}</p></div>
                <a className="rounded-lg bg-[#2563eb] px-4 py-2 font-semibold text-white" href={"/api/admin/receipts/file?name=" + encodeURIComponent(receipt.name)} target="_blank" rel="noreferrer">Abrir comprovante</a>
              </div>)}
          </section>}
          {tab === "integracoes" && <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold">Google Tag / Meta Pixel</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Este painel conta inícios de checkout registrados diretamente no site. Isso não comprova que o evento foi recebido pelo Meta ou pelo Google. Quando o Google Tag estiver configurado, use o mesmo ID de evento para conciliar os relatórios sem duplicar conversões.</p>
              <p className="mt-3 text-xs text-slate-500">Google Analytics 4 não revela a identidade nem o IP completo de cada visitante.</p>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="text-lg font-bold">Cartão · futura API</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Assim que a API de cartão estiver integrada, os webhooks autenticados poderão alimentar os pedidos com bandeira (Visa/Mastercard), quatro últimos dígitos e status. Nenhum número completo, validade ou CVV deve ser recebido ou armazenado aqui.</p>
              <p className="mt-3 text-xs text-slate-500">A opção de cartão do checkout ainda não processa cobranças.</p>
            </section>
          </div>}
          <p className="mt-6 text-xs leading-relaxed text-slate-500">IP exibido apenas de forma mascarada; cidade/região são estimativas de rede, não GPS. Eventos anteriores à instalação deste rastreamento não aparecem retroativamente. Use uma política de privacidade adequada à LGPD para informar a coleta.</p>
        </>
      )}
    </div>
  </main>;
}
