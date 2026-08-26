import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
import { PixLoadingScreen } from "@/components/PixLoadingScreen";
import { SiteFooter } from "@/components/SiteFooter";
import {
  cartItemCount,
  cartTotal,
  formatBRL,
  readCart,
  removeCartItem,
  saveCartAsCheckout,
  updateCartQuantity,
  type CartItem,
} from "@/lib/cart";
import { ALL_PRODUCTS } from "@/lib/products";
import { metaPixelIsReady, trackInitiateCheckout } from "@/lib/tracking";
import { withUtms } from "@/lib/utm";

export const Route = createFileRoute("/carrinho")({
  head: () => ({
    meta: [
      { title: "Carrinho de compras" },
      { name: "description", content: "Revise os produtos antes de continuar a compra." },
      { property: "og:title", content: "Carrinho de compras" },
    ],
  }),
  component: CarrinhoPage,
});

function CarrinhoPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  const [checkoutHref, setCheckoutHref] = useState("/endereco?checkout=1");

  useEffect(() => {
    setItems(readCart());
    setCheckoutHref(withUtms("/endereco?checkout=1"));
  }, []);

  const count = cartItemCount(items);
  const total = cartTotal(items);
  const recommendations = useMemo(
    () => ALL_PRODUCTS.filter((product) => !items.some((item) => item.id === product.id)).slice(0, 8),
    [items],
  );

  function changeQuantity(key: string, quantity: number) {
    setItems(updateCartQuantity(key, quantity));
  }

  function removeItem(key: string) {
    setItems(removeCartItem(key));
  }

  function continuePurchase(event: ReactMouseEvent<HTMLAnchorElement>) {
    const link = event.currentTarget;
    if (link.dataset.icReplay === "1") {
      delete link.dataset.icReplay;
      return;
    }

    event.preventDefault();
    if (isNavigating || !items.length) {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
      return;
    }

    const summary = saveCartAsCheckout(items);
    if (!summary) return;
    const pixelWasReady = metaPixelIsReady();
    if (!pixelWasReady) {
      event.stopPropagation();
      event.nativeEvent.stopImmediatePropagation();
    }

    setIsNavigating(true);
    const href = link.href;
    void trackInitiateCheckout({
      id: summary.contentIds,
      name: summary.title,
      value: summary.price,
      numItems: summary.quantity,
    }).then((result) => {
      if (!pixelWasReady) {
        if (result.sent && link.isConnected) {
          link.dataset.icReplay = "1";
          link.click();
          window.setTimeout(() => window.location.assign(href), 8000);
        } else {
          window.location.assign(href);
        }
      } else {
        window.setTimeout(() => window.location.assign(href), 8000);
      }
    });
  }

  return (
    <div className="min-h-screen bg-[#ededed] text-[#333]" style={{ fontFamily: "'Proxima Nova', -apple-system, Roboto, Arial, sans-serif" }}>
      {isNavigating && <PixLoadingScreen overlay />}

      <header className="bg-[#ffe600]">
        <div className="mx-auto flex max-w-[960px] items-center gap-3 px-3 py-2">
          <Link to="/" aria-label="Página inicial" className="shrink-0">
            <img src="https://i.ibb.co/G3Hqg1y5/ht-M1rqk-1.png" alt="Logo" className="h-11 w-auto" />
          </Link>
          <div className="flex-1 rounded-full bg-white px-5 py-3 text-[15px] text-gray-400 shadow-sm">
            Buscar em todo o site
          </div>
          <div className="relative shrink-0" aria-label={`${count} produtos no carrinho`}>
            <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="#222" strokeWidth="1.8">
              <circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" />
              <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 2-1.6L21 7H6" />
            </svg>
            {count > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3483fa] px-1 text-[11px] font-bold text-white">{count}</span>}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[960px] px-3 py-5 sm:py-7">
        {items.length ? (
          <>
            <section className="space-y-3">
              {items.map((item) => {
                const catalogProduct = ALL_PRODUCTS.find((product) => product.id === item.id);
                return (
                  <article key={item.key} className="rounded-lg bg-white p-4 shadow-sm">
                    <div className="flex gap-3 sm:gap-5">
                      <img src={item.image} alt={item.title} className="h-24 w-24 shrink-0 rounded-md object-contain sm:h-28 sm:w-28" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <h1 className="line-clamp-2 text-[16px] font-medium text-gray-900 sm:text-[18px]">{item.title}</h1>
                            {(item.color || item.voltage || item.extra) && (
                              <p className="mt-1 text-[13px] text-gray-400">
                                {[item.color && `Cor: ${item.color}`, item.voltage && `Voltagem: ${item.voltage}`, item.extra].filter(Boolean).join(" · ")}
                              </p>
                            )}
                          </div>
                          <button type="button" onClick={() => removeItem(item.key)} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label={`Remover ${item.title}`}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 15H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <select value={item.quantity} onChange={(event) => changeQuantity(item.key, Number(event.target.value))} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-[15px] outline-none focus:border-[#3483fa]" aria-label={`Quantidade de ${item.title}`}>
                            {[1,2,3,4,5,6,7,8,9,10].map((quantity) => <option key={quantity} value={quantity}>{quantity} un.</option>)}
                          </select>
                          <div className="text-right">
                            {catalogProduct && <div className="text-[13px] text-gray-400 line-through">R$ {catalogProduct.oldPrice}</div>}
                            <div className="text-[21px] font-medium text-gray-900">R$ {formatBRL(Number(item.price.replace(/\./g, "").replace(",", ".")) * item.quantity)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="mt-4 rounded-lg bg-white p-4 shadow-sm sm:p-5">
              <div className="flex justify-between text-[16px]"><span>Produtos ({count})</span><span>R$ {formatBRL(total)}</span></div>
              <div className="mt-3 flex justify-between text-[16px]"><span>Frete</span><span className="text-[#00a650]">Grátis</span></div>
              <div className="my-4 border-t border-gray-100" />
              <div className="flex justify-between text-[22px] font-semibold text-gray-900"><span>Total</span><span>R$ {formatBRL(total)}</span></div>
              <a href={checkoutHref} onClickCapture={continuePurchase} className="mt-6 flex w-full items-center justify-center rounded-md bg-[#3483fa] py-4 text-[17px] font-semibold text-white transition-colors hover:bg-[#2968c8]">
                Continuar a compra
              </a>
            </section>
          </>
        ) : (
          <section className="rounded-lg bg-white px-5 py-12 text-center shadow-sm">
            <h1 className="text-[22px] font-semibold text-gray-900">Seu carrinho está vazio</h1>
            <p className="mt-2 text-[15px] text-gray-500">Adicione um produto para continuar a compra.</p>
            <Link to="/" className="mt-6 inline-flex rounded-md bg-[#3483fa] px-6 py-3 font-semibold text-white">Ver produtos</Link>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-4 text-[21px] font-medium text-gray-900">Produtos que podem te interessar</h2>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {recommendations.map((product) => (
              <a key={product.id} href={withUtms(`/produto/${product.id}`)} className="w-[170px] shrink-0 rounded-lg bg-white p-3 shadow-sm">
                <img src={product.carousel[0]} alt={product.title} className="aspect-square w-full object-contain" loading="lazy" />
                <div className="mt-2 line-clamp-2 min-h-10 text-[13px] text-gray-700">{product.title}</div>
                <div className="mt-2 text-[18px] text-gray-900">R$ {product.newPrice}</div>
                <div className="text-[12px] font-semibold text-[#00a650]">Frete grátis</div>
              </a>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
