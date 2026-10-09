import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { PixLoadingScreen } from "@/components/PixLoadingScreen";

export const Route = createFileRoute("/pagamento")({
  head: () => ({
    meta: [
      { title: "Escolha como pagar" },
      { name: "description", content: "Selecione o método de pagamento." },
      { property: "og:title", content: "Escolha como pagar" },
      { property: "og:description", content: "Selecione o método de pagamento." },
    ],
  }),
  component: PagamentoPage,
});

function useCheckoutPrice(): string {
  const [price, setPrice] = useState("61,93");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("checkout_product");
      if (raw) {
        const p = JSON.parse(raw);
        if (p?.price) setPrice(String(p.price));
      }
    } catch {}
  }, []);
  return price;
}


function PixIcon() {
  return (
    <div
      className="shrink-0"
      style={{
        marginRight: 20,
        minWidth: 48,
        maxWidth: 48,
        minHeight: 48,
        maxHeight: 48,
        borderRadius: "50%",
        border: "solid 1px #eeeeee",
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
      }}
    >
      <img
        src="https://i.imgur.com/nNfU78q.png"
        alt="Pix"
        style={{ margin: "0 auto", maxWidth: 24, maxHeight: 24 }}
      />
    </div>
  );
}

function CreditCardIcon() {
  return (
    <div
      className="shrink-0"
      style={{
        marginRight: 20,
        minWidth: 48,
        maxWidth: 48,
        minHeight: 48,
        maxHeight: 48,
        borderRadius: "50%",
        border: "solid 1px #eeeeee",
        backgroundColor: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        aria-hidden="true"
        alt=""
        src="https://http2.mlstatic.com/frontend-assets/buyingflow-sonic-frontend/svg/bf_v6_credito_noborde.svg"
        data-testid="new_credit_card"
        style={{ maxWidth: 26, maxHeight: 26 }}
      />
    </div>
  );
}

function PagamentoPage() {
  const price = useCheckoutPrice();
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showCardOptions, setShowCardOptions] = useState(false);

  // Cartão é processado exclusivamente pelo checkout hospedado do provedor.
  // Não coletar nem armazenar número, validade ou CVV neste site.
  const cardCheckoutUrl = import.meta.env.VITE_CARD_CHECKOUT_URL?.trim() || "";
  const cardCheckoutAvailable = (() => {
    try {
      return new URL(cardCheckoutUrl).protocol === "https:";
    } catch {
      return false;
    }
  })();

  const selectPix = async () => {
    if (isNavigating) return;
    setIsNavigating(true);
    try {
      await navigate({ to: "/revisao" });
    } catch {
      setIsNavigating(false);
    }
  };

  if (isNavigating) return <PixLoadingScreen />;

  return (
    <div className="min-h-screen bg-[#ededed] flex flex-col" style={{ fontFamily: "'Proxima Nova', -apple-system, Roboto, Arial, sans-serif" }}>
      <div className="flex-1 py-4 sm:py-6 pb-24">
        <div className="mx-auto w-full max-w-[720px] px-3 sm:px-4">
          <section className="bg-white rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-6">
              <Link to="/entrega" className="text-gray-800" aria-label="Voltar">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              </Link>
              <h1 className="text-[18px] sm:text-[20px] font-semibold text-gray-900">Escolha como pagar</h1>
            </div>

            <h2 className="text-[14px] font-semibold text-gray-800 mb-3">Recomendados</h2>

            <button type="button" onClick={selectPix} disabled={isNavigating} className="flex w-full items-center rounded-md border border-gray-200 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 text-left">
              <PixIcon />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-gray-900">Pix</div>
                <div className="text-[13px] text-gray-600">Aprovação imediata</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button
              type="button"
              onClick={() => setShowCardOptions((current) => !current)}
              aria-expanded={showCardOptions}
              aria-controls="card-payment-options"
              className="mt-2 flex w-full items-center rounded-md border border-gray-200 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 text-left"
            >
              <CreditCardIcon />
              <div className="flex-1 min-w-0">
                <div className="text-[15px] font-semibold text-gray-900">Cartão de crédito</div>
                <div className="text-[13px] text-gray-600">Ver opções de pagamento seguro</div>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="shrink-0"><polyline points={showCardOptions ? "6 9 12 15 18 9" : "9 18 15 12 9 6"}/></svg>
            </button>

            {showCardOptions && (
              <div id="card-payment-options" className="mt-3 rounded-md border border-gray-200 bg-[#fafafa] p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-[#5f7b93] text-white">
                    <svg width="28" height="22" viewBox="0 0 28 22" fill="none" aria-hidden="true">
                      <rect x="1" y="2" width="26" height="18" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M1 7.5h26" stroke="currentColor" strokeWidth="2"/>
                      <path d="M5 15h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold text-gray-900">Pagar com cartão</div>
                    <p className="text-[13px] text-gray-600">Os dados do cartão são informados diretamente ao provedor de pagamentos.</p>
                  </div>
                </div>
                {cardCheckoutAvailable ? (
                  <a
                    href={cardCheckoutUrl}
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center rounded-md bg-[#3483fa] px-4 py-3 text-[15px] font-semibold text-white hover:bg-[#2968c8]"
                  >
                    Continuar para pagamento seguro
                  </a>
                ) : (
                  <div className="mt-4 rounded-md border border-gray-200 bg-white px-4 py-3 text-[13px] text-gray-700" role="status">
                    Pagamento com cartão temporariamente indisponível. Se preferir, utilize Pix.
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <footer className="bg-white border-t border-gray-200 fixed bottom-0 left-0 right-0 sm:static">
        <div className="mx-auto w-full max-w-[720px] px-4 py-4 sm:py-5 flex items-center justify-between">
          <span className="text-[15px] sm:text-[16px] font-semibold text-gray-900">Você pagará</span>
          <span className="text-[17px] sm:text-[18px] font-bold text-gray-900">R$ {price}</span>
        </div>
      </footer>
      <SiteFooter />
    </div>
  );
}
