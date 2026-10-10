import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/cartao")({
  head: () => ({
    meta: [
      { title: "Cartão de crédito" },
      { name: "description", content: "Informações sobre a opção de pagamento com cartão." },
    ],
  }),
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

function ExampleField({ label, placeholder, narrow = false }: { label: string; placeholder: string; narrow?: boolean }) {
  return (
    <div className={narrow ? "min-w-0 flex-1" : "w-full"}>
      <div className="mb-3 text-[18px] text-[#323232] sm:text-[20px]">{label}</div>
      <div className="flex min-h-[65px] w-full items-center rounded-[19px] border border-[#bec1ef] bg-white px-5 text-[20px] text-[#777a85] sm:text-[22px]" aria-label={label + ": campo indisponível até ativação do pagamento"}>
        {placeholder}
      </div>
    </div>
  );
}

function CardPreviewPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [finished, setFinished] = useState(false);

  const back = () => {
    if (finished) {
      setFinished(false);
      setStep(3);
    } else if (step > 0) {
      setStep((value) => value - 1);
    } else {
      void navigate({ to: "/pagamento" });
    }
  };
  const next = () => {
    if (finished) {
      setFinished(false);
      setStep(0);
    } else if (step < labels.length - 1) {
      setStep((value) => value + 1);
    } else {
      setFinished(true);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f6f6f6]" style={{ fontFamily: "'Proxima Nova', -apple-system, Roboto, Arial, sans-serif" }}>
      <header className="flex min-h-[80px] items-center gap-3 bg-[#ffe600] px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,.10)] sm:px-7">
        <button type="button" onClick={back} className="flex h-10 w-10 shrink-0 items-center justify-center text-[#1d1d1d]" aria-label="Voltar">
          <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <h1 className="text-[18px] leading-snug font-medium text-[#242424] sm:text-[21px]">Novo cartão de crédito ou pré-pago</h1>
      </header>

      <main className="mx-auto w-full max-w-[580px] flex-1 px-4 pb-32 pt-3 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3 text-[12px] text-[#737373]">
          <span className="rounded-full border border-[#dadada] px-3 py-1 font-medium">CARTÃO EM CONFIGURAÇÃO</span>
          <span>{finished ? "Concluído" : "Etapa " + (step + 1) + " de 4"}</span>
        </div>
        <CardMockup />

        {finished ? (
          <section className="rounded-[18px] border border-[#dedede] bg-white p-6 text-center">
            <div className="text-xl font-semibold text-[#303030]">Pagamento com cartão ainda indisponível</div>
            <p className="mt-3 text-[15px] leading-relaxed text-[#666]">
              Estamos preparando esta opção. Para pagar com cartão, os dados deverão ser inseridos diretamente no checkout seguro da Cakto após a integração.
            </p>
          </section>
        ) : (
          <section>
            <h2 className="mb-4 text-[15px] text-[#686868]">{labels[step]}</h2>
            {step === 0 && <ExampleField label="Número do cartão" placeholder="0000 0000 0000 0000" />}
            {step === 1 && <ExampleField label="Nome do titular" placeholder="Ex.: MARIA LOPES" />}
            {step === 2 && (
              <div className="flex gap-3">
                <ExampleField label="Vencimento" placeholder="MM/AA" narrow />
                <ExampleField label="Código de segurança" placeholder="•••" narrow />
              </div>
            )}
            {step === 3 && (
              <div>
                <ExampleField label="Documento do titular" placeholder="CPF   000.000.000-00" />
              </div>
            )}
            <p className="mt-4 text-[13px] leading-relaxed text-[#777]">
              O pagamento com cartão ainda não está ativo. Os campos acima não recebem dados. A integração será feita com o checkout seguro da Cakto.
            </p>
          </section>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-10 border-t border-[#e0e0e0] bg-[#f6f6f6] px-6 py-5" aria-label="Etapas do pagamento com cartão">
        <div className="mx-auto flex max-w-[580px] items-center justify-between">
          <button type="button" onClick={back} className="rounded-lg px-3 py-2 text-[18px] font-medium text-[#557cdb]">Anterior</button>
          <button type="button" onClick={next} className="rounded-lg px-3 py-2 text-[18px] font-medium text-[#386fe8]">
            {finished ? "Recomeçar" : step === 3 ? "Concluir etapas" : "Próximo"}
          </button>
        </div>
      </nav>
    </div>
  );
}
