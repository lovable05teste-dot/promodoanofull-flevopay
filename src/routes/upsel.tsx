import { createFileRoute } from '@tanstack/react-router';
import { UpsellOffers } from '@/components/UpsellOffers';
import { ALL_PRODUCTS, getProduct } from '@/lib/products';
import { SiteFooter } from '@/components/SiteFooter';
import type { PixChargeResult } from '@/lib/pix.server';

export const Route = createFileRoute('/upsel')({
  head: () => ({ meta: [
    { title: 'Prévia das ofertas complementares' },
    { name: 'robots', content: 'noindex,nofollow' },
  ] }),
  validateSearch: (search: Record<string, unknown>) => ({
    produto: getProduct(String(search.produto ?? ''))
      ? String(search.produto) : '9909000023',
  }),
  component: UpsellPreviewPage,
});

function UpsellPreviewPage() {
  const { produto } = Route.useSearch();
  const navigate = Route.useNavigate();
  const product = getProduct(produto)!;
  const preview: PixChargeResult = {
    transactionId: `preview_${product.id}`, pixCode: '', createdAt: '', expiresAt: '',
    amountCents: 0, contentIds: [product.id], itemTitle: product.title, numItems: 1,
  };
  return <div className="min-h-screen bg-[#ededed] py-4 sm:py-6" style={{ fontFamily: "'Proxima Nova', -apple-system, Roboto, Arial, sans-serif" }}>
    <main className="mx-auto w-full max-w-[720px] space-y-3 px-3 sm:space-y-4 sm:px-4">
      <section className="rounded-lg bg-white p-4 sm:p-6">
        <h1 className="text-[20px] font-semibold text-gray-900">Visualizar upsells</h1>
        <p className="mt-2 text-[14px] text-gray-600">Escolha um produto para ver suas três ofertas. Esta prévia não gera cobranças.</p>
        <label className="mt-4 block text-[14px] font-medium text-gray-800" htmlFor="preview-product">Produto principal</label>
        <select id="preview-product" value={produto} onChange={(event) => { void navigate({ search: { produto: event.target.value } }); }} className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-3 text-[14px] text-gray-900">
          {ALL_PRODUCTS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select>
      </section>
      <UpsellOffers key={product.id} parent={preview} preview />
    </main>
    <SiteFooter />
  </div>;
}
