import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { PixLoadingScreen } from "@/components/PixLoadingScreen";

export const Route = createFileRoute("/revisao")({
  head: () => ({
    meta: [
      { title: "Revise e confirme" },
      { name: "description", content: "Confirme os detalhes da sua compra." },
      { property: "og:title", content: "Revise e confirme" },
      { property: "og:description", content: "Confirme os detalhes da sua compra." },
    ],
  }),
  component: RevisaoPage,
});

type CheckoutProduct = {
  title: string;
  price: string;
  image: string;
  quantity?: number;
  cartItems?: Array<{
    key: string;
    title: string;
    image: string;
    color?: string;
    voltage?: string;
    extra?: string;
    quantity: number;
  }>;
};
type CheckoutCustomer = {
  name?: string;
  cpf?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
};

function useCheckoutData() {
  const [product, setProduct] = useState<CheckoutProduct>({
    title: "Jogo De Panelas Indução Antiaderente Cerâmica 10 Peças PPG PFOA Free Baunilha",
    price: "61,93",
    image: "https://i.postimg.cc/Gtj1SkJR/D-NQ-NP-2X-754218-MLA98733384331-112025-F.webp",
  });
  const [customer, setCustomer] = useState<CheckoutCustomer>({});
  useEffect(() => {
    try {
      const p = localStorage.getItem("checkout_product");
      if (p) setProduct((prev) => ({ ...prev, ...JSON.parse(p) }));
      const c = localStorage.getItem("checkout_customer");
      if (c) setCustomer((prev) => ({ ...prev, ...JSON.parse(c) }));
    } catch {}
  }, []);
  return { product, customer };
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

function RevisaoPage() {
  const { product, customer } = useCheckoutData();
  const navigate = useNavigate();
  const [isGeneratingPix, setIsGeneratingPix] = useState(false);

  const confirmPurchase = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent.stopImmediatePropagation();
    if (isGeneratingPix) return;
    setIsGeneratingPix(true);
    try {
      await navigate({ to: "/pix" });
    } catch {
      setIsGeneratingPix(false);
    }
  };

  if (isGeneratingPix) return <PixLoadingScreen />;

  return (
    <div className="min-h-screen bg-[#ededed] py-4 sm:py-6" style={{ fontFamily: "'Proxima Nova', -apple-system, Roboto, Arial, sans-serif" }}>
      <div className="mx-auto w-full max-w-[720px] px-3 sm:px-4 space-y-3 sm:space-y-4">
        <section className="bg-white rounded-lg p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-5">
            <button
              type="button"
              onClick={() => navigate({ to: "/pagamento" })}
              className="text-gray-800"
              aria-label="Voltar para pagamento"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            </button>
            <h1 className="text-[20px] font-semibold text-gray-900">Revise e confirme</h1>
          </div>

          <div className="space-y-2 text-[15px]">
            <div className="flex justify-between"><span className="text-gray-800">Produto(s)</span><span className="text-gray-800">R$ {product.price}</span></div>
            <div className="flex justify-between"><span className="text-gray-800">Frete</span><span className="text-[#00a650]">Grátis</span></div>
            <div className="flex justify-between"><span className="text-gray-800">Subtotal</span><span className="text-gray-800">R$ {product.price}</span></div>
          </div>

          <hr className="my-4 border-gray-200" />

          <div className="flex justify-between items-start mb-6">
            <span className="text-[16px] font-semibold text-gray-900">Você pagará</span>
            <div className="text-right">
              <div className="text-[18px] font-bold text-gray-900">R$ {product.price}</div>
              <div className="text-[12px] text-gray-500">Pix</div>
            </div>
          </div>

          <button
            type="button"
            onClickCapture={confirmPurchase}
            disabled={isGeneratingPix}
            className="block w-full rounded-md bg-[#3483fa] hover:bg-[#2968c8] text-white text-center py-4 text-[16px] font-semibold transition-colors"
          >
            Confirmar a compra
          </button>
        </section>

        <section className="bg-white rounded-lg p-4 sm:p-6">
          <h2 className="text-[16px] font-semibold text-gray-900 mb-4">Carrinho</h2>
          <div className="space-y-4">
            {(product.cartItems?.length
              ? product.cartItems
              : [{
                  key: "checkout-product",
                  title: product.title,
                  image: product.image,
                  quantity: product.quantity || 1,
                  color: undefined,
                  voltage: undefined,
                  extra: undefined,
                }]
            ).map((item) => (
              <div key={item.key} className="flex gap-3">
                <img src={item.image} alt={item.title} className="h-20 w-20 object-contain rounded-md border border-gray-100" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-600 flex items-center gap-1">
                    Envio |
                    <span className="inline-flex items-center gap-1 text-[#00a650] font-bold italic">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                      FULL
                    </span>
                  </div>
                  <div className="text-[13px] text-gray-800 mt-1">Quinta-feira, 27 de agosto</div>
                  <div className="text-[14px] text-gray-900 mt-1 font-medium leading-snug">{item.title}</div>
                  {(item.color || item.voltage || item.extra) && (
                    <div className="text-[12px] text-gray-500 mt-1">
                      {[item.color, item.voltage, item.extra].filter(Boolean).join(" · ")}
                    </div>
                  )}
                  <div className="text-[12px] text-gray-500 mt-1">Quantidade: {item.quantity}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-lg p-4 sm:p-6">
          <h2 className="text-[16px] font-semibold text-gray-900 mb-4">Detalhe da entrega</h2>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </span>
            <div>
              <div className="text-[15px] font-semibold text-gray-900">
                {[customer.rua, customer.numero].filter(Boolean).join(", ") || "Endereço informado"}
              </div>
              <div className="text-[13px] text-gray-500">
                {[customer.complemento, customer.bairro, customer.cidade, customer.estado, customer.cep]
                  .filter(Boolean)
                  .join(" - ") || "Entrega no endereço"}
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg p-4 sm:p-6">
          <h2 className="text-[16px] font-semibold text-gray-900 mb-4">Faturamento</h2>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v18l4-2 4 2 4-2 4 2V8z"/></svg>
            </span>
            <div>
              <div className="text-[15px] font-semibold text-gray-900">{(customer.name || "").toUpperCase()}</div>
              <div className="text-[13px] text-gray-500">CPF {customer.cpf || ""}</div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg p-4 sm:p-6">
          <h2 className="text-[16px] font-semibold text-gray-900 mb-4">Detalhe do pagamento</h2>
          <div className="flex items-start">
            <PixIcon />
            <div>
              <div className="text-[15px] font-semibold text-gray-900">Pix</div>
              <div className="text-[14px] text-gray-800">R$ {product.price}</div>
              <div className="text-[13px] text-gray-500 mt-1">Ao confirmar a compra, você terá as informações para pagar.</div>
            </div>
          </div>
        </section>

        <button
          type="button"
          onClickCapture={confirmPurchase}
          disabled={isGeneratingPix}
          className="block w-full rounded-md bg-[#3483fa] hover:bg-[#2968c8] text-white text-center py-4 text-[16px] font-semibold transition-colors"
        >
          Confirmar a compra
        </button>
      </div>
      <SiteFooter />
    </div>

  );
}
