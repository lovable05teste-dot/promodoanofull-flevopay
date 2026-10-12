import assert from 'node:assert/strict';
import fs from 'node:fs';
import { signUpsellContext, verifyUpsellContext } from '../src/lib/upsell-token.server.ts';
import { getUpsellsForProductIds, UPSELL_OFFERS } from '../src/lib/upsell-catalog.ts';
import { authorizeUpsell } from '../src/lib/upsell.server.ts';
const catalog=JSON.parse(fs.readFileSync('src/lib/upsell-catalog.json','utf8'));
assert.equal(Object.keys(catalog.products).length,31);
for(const [id,ids] of Object.entries(catalog.products)){
 const offers=getUpsellsForProductIds([id]);assert.equal(offers.length,3);assert.equal(new Set(ids).size,3);
 for(const offer of offers){assert.ok(offer.priceCents>0);assert.ok(offer.priceCents<=6990||['acc-ps5-controller','acc-xbox-controller'].includes(offer.id));assert.ok(offer.image.startsWith('/img/upsells/'));assert.ok(fs.existsSync(`public${offer.image}`));}
}
assert.deepEqual(getUpsellsForProductIds(['unknown']),[]);
assert.equal(getUpsellsForProductIds(['6549324','9909000023']).length,3);
const secret='server-only-test-key';
const context={transactionId:'parent-paid',contentIds:['9909000023'],expiresAt:Date.now()+3600000};
const token=signUpsellContext(context,secret);assert.deepEqual(verifyUpsellContext(token,secret),context);
assert.throws(()=>verifyUpsellContext(token+'x',secret));
assert.throws(()=>verifyUpsellContext(signUpsellContext({...context,expiresAt:0},secret),secret));
const input={parentToken:token,offerId:getUpsellsForProductIds(context.contentIds)[0].id,customer:{name:'Teste',document:'52998224725',phone:'11999999999',email:'teste@example.com'},amountCents:1};
let calls=0;
globalThis.fetch=async(url)=>{calls++;assert.ok(url.pathname.endsWith('/parent-paid'));return Response.json({status:'pending'});};
await assert.rejects(authorizeUpsell(input,secret),/aprovada/);
assert.equal(calls,1);
globalThis.fetch=async()=>Response.json({status:'paid'});
const accepted=await authorizeUpsell(input,secret);
assert.equal(accepted.amountCents,6990);assert.equal(accepted.itemId,input.offerId);assert.deepEqual(accepted.contentIds,[input.offerId]);
await assert.rejects(authorizeUpsell({...input,offerId:'acc-ps5-controller'},secret),/não faz parte/);
await assert.rejects(authorizeUpsell({...input,parentToken:token+'bad'},secret));
for(const status of ['refunded','chargeback','expired','failed','cancelled']){
 globalThis.fetch=async()=>Response.json({status});await assert.rejects(authorizeUpsell(input,secret),/aprovada/);
}
console.log(`Upsells: 31 produtos, 3 ofertas cada, ${UPSELL_OFFERS.length} imagens locais, autorização por pagamento, preço no servidor e token contra alterações validados.`);
