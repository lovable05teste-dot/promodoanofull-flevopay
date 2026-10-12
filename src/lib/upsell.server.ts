import { verifyUpsellContext } from './upsell-token.server.ts';
import { getUpsellsForProductIds } from './upsell-catalog.ts';
import { readFortpayPixStatus, type PixChargeInput } from './pix.server.ts';

export type UpsellChargeInput = {
  parentToken: string; offerId: string;
  customer: Pick<PixChargeInput, 'name' | 'document' | 'email' | 'phone'>;
  sessionId?: string; utm?: string;
};
/** Preço/itens vêm do catálogo; o navegador não pode liberar uma compra pendente. */
export async function authorizeUpsell(input: UpsellChargeInput, apiToken: string): Promise<PixChargeInput> {
  const context = verifyUpsellContext(input.parentToken, apiToken);
  const offer = getUpsellsForProductIds(context.contentIds).find((item) => item.id === input.offerId);
  if (!offer) throw new Error('Este complemento não faz parte da sua oferta.');
  const parent = await readFortpayPixStatus(context.transactionId, apiToken);
  if (parent.status !== 'COMPLETED') throw new Error('A compra principal precisa estar aprovada para adicionar complementos.');
  return {
    name: input.customer?.name, document: input.customer?.document,
    email: input.customer?.email, phone: input.customer?.phone,
    sessionId: input.sessionId, utm: input.utm,
    itemId: offer.id, contentIds: [offer.id], itemTitle: offer.title,
    itemImage: offer.image, amountCents: offer.priceCents, numItems: 1,
  };
}
