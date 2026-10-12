import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createFortpayPixCharge, readFortpayPixStatus } from '../src/lib/pix.server.ts';
import { trackConfirmedPixPurchase } from '../src/lib/purchase-tracking.ts';
import { pixCheckoutKey, readCachedPixCharge, saveCachedPixCharge, clearCachedPixCharge } from '../src/lib/pix-session.ts';
const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key), clear: () => values.clear() };
};
globalThis.localStorage = storage();
globalThis.sessionStorage = storage();
const events = [];
globalThis.window = { setTimeout, fbq: (...args) => events.push(args) };
const disabled = new Set(['1497000015', '5521000018', '8834000019', '2278000022']);
const products = [{id:'6549324',title:'Jogo de Panelas',newPrice:'61,93'}, ...JSON.parse(fs.readFileSync('src/lib/products-data.json','utf8')).filter(p => !disabled.has(p.id))];
for (const p of products) {
  const amountCents = Math.round(Number(p.newPrice.replace(/\./g, '').replace(',', '.')) * 100);
  const transactionId = `tx-${p.id}`;
  globalThis.fetch = async (url, options) => {
    assert.equal(url.hostname, 'api.fortpayplataforma.com.br');
    assert.equal(url.searchParams.get('api_token'), 'test-token');
    if (options.method === 'POST') {
      const body = JSON.parse(options.body);
      assert.equal(body.amount, amountCents);
      return Response.json({transaction_hash:transactionId,pix:{qr_code:'000201-test'}});
    }
    return Response.json({status:'paid'});
  };
  const charge = await createFortpayPixCharge({name:'Teste',email:'teste@example.com',document:'52998224725',phone:'11999999999',amountCents,itemId:p.id,itemTitle:p.title}, {apiToken:'test-token'});
  assert.equal(charge.amountCents, amountCents);
  assert.deepEqual(charge.contentIds,[p.id]);
  // Gerar Pix, enviar comprovante ou um status pendente nunca contam como compra.
  const before = events.length;
  for (const status of ['PENDING','PROCESSING','FAILED','REFUNDED','EXPIRED','']) {
    assert.equal((await trackConfirmedPixPurchase(status,charge)).sent,false);
  }
  assert.equal(events.length,before);
  const status = await readFortpayPixStatus(transactionId,'test-token');
  await Promise.all([trackConfirmedPixPurchase(status.status,charge),trackConfirmedPixPurchase(status.status,charge)]);
  assert.equal(events.length,before+1);
  const event = events.at(-1);
  assert.deepEqual(event.slice(0,3),['trackSingle','4686534118338697','Purchase']);
  assert.equal(event[3].value,amountCents/100);
  assert.equal(event[3].currency,'BRL');
  assert.deepEqual(event[3].content_ids,[p.id]);
  assert.equal(event[4].eventID,`purchase_${transactionId}`);
  await trackConfirmedPixPurchase('COMPLETED',charge);
  assert.equal(events.length,before+1);
}
const charge = {pixCode:'000201-test',transactionId:'cache-test',createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString(),amountCents:6990,contentIds:['product-A'],itemTitle:'A',numItems:1};
const input = {sessionId:'session',contentIds:charge.contentIds,amountCents:6990,document:'52998224725',email:'teste@example.com',numItems:1};
const key = await pixCheckoutKey(input);
assert.equal(key.length,64);
assert.deepEqual(readCachedPixCharge(key),null);
saveCachedPixCharge(key,charge);
assert.deepEqual(readCachedPixCharge(key),charge);
assert.equal(readCachedPixCharge(await pixCheckoutKey({...input,amountCents:7990})),null);
assert.equal(readCachedPixCharge(await pixCheckoutKey({...input,sessionId:'different'})),null);
assert.equal(readCachedPixCharge(await pixCheckoutKey({...input,document:'another-customer'})),null);
clearCachedPixCharge('another-transaction');assert.deepEqual(readCachedPixCharge(key),charge);
clearCachedPixCharge(charge.transactionId);assert.equal(readCachedPixCharge(key),null);
saveCachedPixCharge(key,{...charge,expiresAt:'2020-01-01'});assert.equal(readCachedPixCharge(key),null);
// Simula reload real do módulo: dedup persistente funciona sem a memória anterior.
localStorage.setItem('meta_purchase_4686534118338697_reload-test','queued');
const {trackConfirmedPixPurchase: reloaded} = await import('../src/lib/purchase-tracking.ts?reload');
const count = events.length;
assert.equal((await reloaded('COMPLETED',{...charge,transactionId:'reload-test'})).deduplicated,true);
assert.equal(events.length,count);
// Pixel lento pode tentar novamente, sem descartar a venda definitivamente.
const realNow = Date.now;
let fakeTime = realNow();
Date.now=()=>fakeTime;
window.setTimeout=(fn,ms)=>{fakeTime+=ms;queueMicrotask(fn);};
delete window.fbq;
assert.equal((await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'pixel-late'})).sent,false);
Date.now=realNow;window.setTimeout=setTimeout;window.fbq=(...args)=>events.push(args);
assert.equal((await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'pixel-late'})).sent,true);
// Bloqueio de storage não interrompe o envio e continua deduplicando em memória.
globalThis.localStorage={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
assert.equal((await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'blocked-storage'})).sent,true);
assert.equal((await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'blocked-storage'})).deduplicated,true);
// Falha no fbq não é marcada como envio; pode ser repetida.
window.fbq=()=>{throw Error('pixel error');};
assert.equal((await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'pixel-error'})).sent,false);
window.fbq=(...args)=>events.push(args);
assert.equal((await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'pixel-error'})).sent,true);
// Compra do carrinho preserva todos os SKUs, quantidade e valor total.
await trackConfirmedPixPurchase('COMPLETED',{...charge,transactionId:'cart-sale',contentIds:['A','B'],numItems:3,amountCents:12990});
assert.deepEqual(events.at(-1)[3].content_ids,['A','B']);assert.equal(events.at(-1)[3].num_items,3);assert.equal(events.at(-1)[3].value,129.9);
console.log(`Purchase validado nos ${products.length} produtos: FortPay → confirmação → Meta, valores, SKUs, carrinho, reload, cache e retry. Sem cobrança real.`);
