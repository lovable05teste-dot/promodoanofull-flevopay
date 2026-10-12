import data from './upsell-catalog.json' with { type: 'json' };

export type UpsellOffer = {
  id: string; title: string; description: string; priceCents: number; image: string;
  sourceUrl?: string;
};
export const UPSELL_OFFERS: UpsellOffer[] = Object.values(data.offers);
const productOffers = data.products as Record<string, string[]>;

export function getUpsellsForProductIds(contentIds: string[]): UpsellOffer[] {
  const productId = contentIds.find((id) => Object.hasOwn(productOffers, id));
  if (!productId) return [];
  return productOffers[productId].map((id) => UPSELL_OFFERS.find((offer) => offer.id === id)!)
    .filter(Boolean).slice(0, 3);
}
