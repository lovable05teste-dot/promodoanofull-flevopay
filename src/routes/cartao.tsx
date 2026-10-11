import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type MouseEvent } from "react";

export const Route = createFileRoute("/cartao")({
  head: () => ({
    meta: [
      { title: "Cartão de crédito" },
      { name: "description", content: "Informações sobre a opção de pagamento com cartão." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    const requested = Number(search.etapa ?? 1);
    return {
      etapa: Number.isInteger(requested) && requested >= 1 && requested <= 5 ? requested : 1,
    };
  },
  component: CardPreviewPage,
});

const labels = ["Número do cartão", "Nome do titular", "Vencimento e código de segurança", "Documento do titular"];

function CardMockup() {
  return (
    <div className="relative mx-auto mt-4 mb-9 flex w-full max-w-[420px] flex-col justify-between overflow-hidden rounded-[17px] bg-[#5b788f] px-6 py-6 text-white shadow-[0_18px_36px_rgba(33,54,69,.16)] sm:mt-6" style={{ minHeight: 228 }}>
      <span aria-hidden="true" className="pointer-events-none absolute -left-16 -top-28 h-80 w-80 rounded-full border border-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -right-20 -bottom-24 h-80 w-80 rounded-full border border-white/10" />
      <div className="relative flex items-center justify-between">
        <div className="h-9 w-12 rounded-md border border-white/40 bg-white/20" aria-hidden="true" />
        <span className="text-sm font-semibold tracking-widest">CARTÃO</span>
      </div>
      <div className="relative mt-8 text-[23px] font-medium tracking-[.12em] sm:text-[27px]" aria-hidden="true">
        •••• •••• •••• ••••
      </div>
      <div className="relative mt-7 flex items-end justify-between gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/70">Titular</div>
          <div className="mt-1 font-medium tracking-wide">NOME NO CARTÃO</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-white/70">Validade</div>
          <div className="mt-1 font-medium tracking-wide">MM/AA</div>
        </div>
      </div>
    </div>
  );
}

type CardFields = { number: string; holder: string; expiry: string; cvv: string; document: string };
const emptyFields: CardFields = { number: "", holder: "", expiry: "", cvv: "", document: "" };

function CardField({ label, placeholder, value, onChange, numeric = false, secret = false, maxLength, minLength, narrow = false }: {
  label: string; placeholder: string; value: string; onChange: (value: string) => void;
  numeric?: boolean; secret?: boolean; maxLength?: number; minLength?: number; narrow?: boolean;
}) {
  return (
    <label className={narrow ? "block min-w-0 flex-1" : "block w-full"}>
      <span className="mb-3 block text-[18px] text-[#323232] sm:text-[20px]">{label}</span>
      <input
        type={secret ? "password" : "text"}
        inputMode={numeric ? "numeric" : "text"}
        autoComplete="off"
        required
        minLength={minLength}
        maxLength={maxLength}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-[65px] w-full rounded-[19px] border border-[#bec1ef] bg-white px-5 text-[20px] text-[#323232] outline-none focus:border-[#386fe8] focus:ring-2 focus:ring-[#386fe8]/20 sm:text-[22px]"
      />
    </label>
  );
}

function CardPreviewPage() {
  const { etapa } = Route.useSearch();
  const [step, setStep] = useState(Math.min(etapa - 1, 3));
  const [finished, setFinished] = useState(false);
  const [fields, setFields] = useState<CardFields>({ ...emptyFields });
  const formRef = useRef<HTMLFormElement>(null);
  const update = (key: keyof CardFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const previousHref = step === 0 ? "/pagamento" : "/cartao?etapa=" + step;
  const back = (event: MouseEvent<HTMLAnchorElement>) => {
    if (finished || step > 0) {
      event.preventDefault();
      if (finished) setFinished(false);
      else setStep((current) => current - 1);
    }
  };
  const next = () => {
    if (finished) {
      setFields({ ...emptyFields });
      setFinished(false);
      setStep(0);
      return;
    }
    if (!formRef.current?.reportValidity()) return;
    if (step < 3) setStep((current) => current + 1);
    else {
      setFields({ ...emptyFields });
      setFinished(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f6]" style={{ fontFamily: "'Proxima Nova', -apple-system, Roboto, Arial, sans-serif" }}>
      <header className="flex min-h-[80px] items-center gap-3 bg-[#ffe600] px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,.10)] sm:px-7">
        <a href={previousHref} onClick={back} className="flex h-10 w-10 shrink-0 items-center justify-center text-[#1d1d1d]" aria-label="Voltar">
          <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </a>
        <h1 className="text-[18px] leading-snug font-medium text-[#242424] sm:text-[21px]">Novo cartão de crédito ou pré-pago</h1>
      </header>

      <main className="mx-auto w-full max-w-[580px] flex-1 px-4 pb-32 pt-3 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-[12px] text-[#737373]">
          <span>{finished ? "Concluído" : "Etapa " + (step + 1) + " de 4"}</span>
        </div>
        <CardMockup />

        {finished ? (
          <section className="rounded-[18px] border border-[#dedede] bg-white p-6 text-center">
            <div className="text-xl font-semibold text-[#303030]">Não foi possível concluir pelo cartão</div>
            <p className="mt-3 text-[15px] leading-relaxed text-[#666]">
              O pagamento com cartão ainda não está habilitado. Nenhum dado do cartão foi enviado ou salvo. Você pode concluir o pedido pelo Pix.
            </p>
          </section>
        ) : (
          <form ref={formRef} onSubmit={(event) => { event.preventDefault(); next(); }}>
            <h2 className="mb-4 text-[15px] text-[#686868]">{labels[step]}</h2>
            {step === 0 && <CardField label="Número do cartão" placeholder="0000 0000 0000 0000" value={fields.number} numeric minLength={13} maxLength={23} onChange={(value) => update("number", value.replace(/\D/g, "").slice(0, 19).replace(/(.{4})/g, "$1 ").trim())} />}
            {step === 1 && <CardField label="Nome do titular" placeholder="Ex.: MARIA LOPES" value={fields.holder} minLength={3} maxLength={80} onChange={(value) => update("holder", value)} />}
            {step === 2 && (
              <div className="flex gap-3">
                <CardField label="Vencimento" placeholder="MM/AA" value={fields.expiry} numeric minLength={5} maxLength={5} narrow onChange={(value) => update("expiry", value.replace(/\D/g, "").slice(0, 4).replace(/^(\d{2})(\d)/, "$1/$2"))} />
                <CardField label="Código de segurança" placeholder="•••" value={fields.cvv} numeric secret minLength={3} maxLength={4} narrow onChange={(value) => update("cvv", value.replace(/\D/g, "").slice(0, 4))} />
              </div>
            )}
            {step === 3 && (
              <div>
                <CardField label="Documento do titular" placeholder="CPF   000.000.000-00" value={fields.document} numeric minLength={11} maxLength={11} onChange={(value) => update("document", value.replace(/\D/g, "").slice(0, 11))} />
              </div>
            )}
            <p className="mt-4 text-[13px] leading-relaxed text-[#777]">
              Os dados permanecem apenas nesta página e são apagados ao concluir ou recarregar. Nenhuma cobrança será realizada enquanto o pagamento não estiver integrado.
            </p>
          </form>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-[#e0e0e0] bg-[#f6f6f6] px-6 py-5" aria-label="Etapas do pagamento com cartão">
        <div className="mx-auto flex max-w-[580px] items-center justify-between">
          <a href={previousHref} onClick={back} className="rounded-lg px-3 py-2 text-[18px] font-medium text-[#557cdb]">Anterior</a>
          {finished ? (
            <Link to="/pix" className="rounded-lg bg-[#3483fa] px-5 py-3 text-[16px] font-semibold text-white">
              Ir para o Pix
            </Link>
          ) : (
            <button type="button" onClick={next} className="rounded-lg px-3 py-2 text-[18px] font-medium text-[#386fe8]">
              {step === 3 ? "Concluir etapas" : "Próximo"}
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
