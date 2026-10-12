import { useEffect, useState, useRef } from 'react';
import { useServerFn } from '@tanstack/react-start';
import QRCode from 'qrcode';
import { createUpsellPixCharge, getPixStatus } from '@/lib/pix.functions';
import { getUpsellsForProductIds, type UpsellOffer } from '@/lib/upsell-catalog';
import { trackInitiateCheckout } from '@/lib/tracking';
import { trackConfirmedPixPurchase } from '@/lib/purchase-tracking';
import { getCheckoutSessionId } from '@/lib/checkout-tracker';
import { getUtmQuery } from '@/lib/utm';
import type { PixChargeResult } from '@/lib/pix.server';

const money = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function UpsellCard({ offer, parent, preview = false }: { offer: UpsellOffer; parent: PixChargeResult; preview?: boolean }) {
  const generate = useServerFn(createUpsellPixCharge);
  const fetchStatus = useServerFn(getPixStatus);
  const cacheKey = `upsell_pix_${parent.transactionId}_${offer.id}`;
  const [charge, setCharge] = useState<PixChargeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const creating = useRef(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (preview) return;
    try {
      const saved = JSON.parse(sessionStorage.getItem(cacheKey) || 'null');
      if (saved?.transactionId && saved?.pixCode && saved.amountCents === offer.priceCents &&
          saved.contentIds?.[0] === offer.id && Date.parse(saved.expiresAt) > Date.now()) setCharge(saved);
    } catch {}
  }, [cacheKey, offer.id, offer.priceCents, preview]);

  useEffect(() => {
    if (preview || !charge) return;
    let active = true;
    void QRCode.toDataURL(charge.pixCode, { width: 240, margin: 1 }).then((url) => {
      if (active) setQr(url);
    }).catch(() => {});
    return () => { active = false; };
  }, [charge, preview]);

  useEffect(() => {
    if (preview || !charge) return;
    let stopped = false;
    let checking = false;
    let confirmed = false;
    const check = async () => {
      if (stopped || checking) return;
      checking = true;
      try {
        const status = confirmed ? 'COMPLETED' : (await fetchStatus({ data: { transactionId: charge.transactionId } })).status;
        if (stopped) return;
        if (status === 'COMPLETED') {
          confirmed = true;
          setPaid(true);
          const tracking = await trackConfirmedPixPurchase(status, charge);
          if (tracking.sent) { stopped = true; clearInterval(interval); }
        } else if (['EXPIRED', 'FAILED', 'CANCELLED', 'CANCELED', 'REFUSED', 'REFUNDED', 'CHARGEBACK'].includes(status) || Date.parse(charge.expiresAt) <= Date.now()) {
          stopped = true; clearInterval(interval);
          try { sessionStorage.removeItem(cacheKey); } catch {}
          setCharge(null); setQr('');
          setError('Este Pix não está disponível. Você pode gerar outro para este complemento.');
        }
      } catch {} finally { checking = false; }
    };
    const interval = setInterval(() => { void check(); }, 5000);
    const onReturn = () => { if (document.visibilityState === 'visible') void check(); };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    void check();
    return () => {
      stopped = true; clearInterval(interval);
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, [charge, fetchStatus, cacheKey, preview]);

  const accept = async () => {
    if (preview) {
      setError('Esta é uma prévia. No checkout, este botão gera o Pix do complemento após a aprovação da compra principal.');
      return;
    }
    if (creating.current || loading || charge || paid) return;
    creating.current = true;
    setLoading(true); setError('');
    try {
      // O pixel não deve atrasar a geração do Pix na mesma tela.
      void trackInitiateCheckout({ id: offer.id, name: offer.title, value: offer.priceCents / 100, numItems: 1 }).catch(() => {});
      const customer = JSON.parse(localStorage.getItem('checkout_customer') || '{}');
      const result = await generate({ data: {
        parentToken: parent.upsellToken!, offerId: offer.id,
        sessionId: getCheckoutSessionId(), utm: getUtmQuery(),
        customer: { name: customer.name || '', email: customer.email || '',
          document: customer.cpf || customer.document || '', phone: customer.phone || customer.telefone || '' },
      } });
      try { sessionStorage.setItem(cacheKey, JSON.stringify(result)); } catch {}
      setCharge(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o Pix. Tente novamente.');
    } finally { creating.current = false; setLoading(false); }
  };

  const copy = async () => {
    if (preview || !charge) return;
    try { await navigator.clipboard.writeText(charge.pixCode); setCopied(true); } catch { setError('Selecione o código abaixo e copie para pagar no app do banco.'); }
  };

  return <article className="rounded-lg bg-white p-4 sm:p-6">
    <div className="flex items-start gap-4">
      <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-md border border-gray-100 bg-white sm:h-36 sm:w-36">
        {!imageFailed ? <img src={offer.image} alt={offer.title} loading="lazy" className="h-full w-full rounded-md object-contain p-2" onError={() => setImageFailed(true)} /> : <span className="text-4xl" aria-hidden="true">＋</span>}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-[16px] font-semibold leading-snug text-gray-900">{offer.title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-600">{offer.description}</p>
        <p className="mt-3 text-[23px] font-semibold text-gray-900">{money(offer.priceCents)}</p>
        <p className="text-[12px] text-gray-500">Pagamento via Pix</p>
      </div>
    </div>
    {paid ? <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-[14px] font-semibold text-green-700" role="status">Pagamento confirmado. Complemento adicionado!</div> : !charge ?
      <button type="button" onClick={accept} disabled={loading} className="mt-4 block w-full rounded-md bg-[#3483fa] py-4 text-[16px] font-semibold text-white transition-colors hover:bg-[#2968c8] disabled:opacity-60">{loading ? 'Gerando seu Pix…' : `Adicionar por ${money(offer.priceCents)}`}</button> :
      <div className="mt-5 border-t border-gray-100 pt-4">
        <p className="text-center text-[15px] font-semibold text-gray-900">Pague {money(charge.amountCents)} para adicionar este complemento</p>
        {qr && <img src={qr} alt={`QR Code Pix de ${offer.title}`} className="mx-auto mt-3 h-52 w-52" />}
        <p className="mt-3 select-all break-all rounded-md border border-gray-200 px-3 py-3 text-[12px] text-gray-700">{charge.pixCode}</p>
        <button type="button" onClick={copy} className="mt-3 block w-full rounded-md bg-[#3483fa] py-4 text-[16px] font-semibold text-white hover:bg-[#2968c8]">{copied ? 'Código copiado!' : 'Copiar código Pix'}</button>
        <p className="mt-3 text-center text-[12px] text-gray-500" role="status">Aguardando a confirmação do pagamento deste complemento.</p>
      </div>}
    {error && <p className="mt-3 text-[13px] text-red-600" role="alert">{error}</p>}
  </article>;
}

export function UpsellOffers({ parent, preview = false }: { parent: PixChargeResult; preview?: boolean }) {
  const [dismissed, setDismissed] = useState(false);
  const offers = getUpsellsForProductIds(parent.contentIds);
  if (dismissed || (!preview && !parent.upsellToken) || offers.length !== 3) return null;
  return <section className="space-y-3 sm:space-y-4" aria-label="Ofertas para complementar sua compra">
    <div className="rounded-lg bg-white p-4 text-center sm:p-6">
      <p className="text-[13px] font-semibold text-[#00a650]">{preview ? 'Prévia das ofertas complementares' : 'Sua compra principal está confirmada'}</p>
      <h2 className="mt-2 text-[21px] font-semibold text-gray-900">Complete sua compra</h2>
      <p className="mt-2 text-[14px] leading-relaxed text-gray-600">Selecionamos 3 complementos para você. Escolha os que deseja adicionar.</p>
    </div>
    {offers.map((offer) => <UpsellCard key={`${parent.transactionId}_${offer.id}`} offer={offer} parent={parent} preview={preview} />)}
    <button type="button" onClick={() => setDismissed(true)} className="block w-full rounded-lg bg-white px-4 py-4 text-center text-[14px] font-medium text-[#3483fa]">Não adicionar outros complementos</button>
  </section>;
}
