import assert from 'node:assert/strict';
import {createFortpayPixCharge,readFortpayPixStatus} from '../src/lib/pix.server.ts';
const input={name:'Teste',document:'52998224725',email:'teste@example.com',phone:'11999999999',amountCents:6990,itemId:'acc-gamer-headset',itemTitle:'Headset'};
const shapes=[
 {transaction_hash:'tx-correct',pix:{qr_code:'000201-test'}},
 {data:{id:'tx-correct',pix:{qr_code:'000201-test'},customer:{id:'customer-wrong'}}},
 {status:'success',data:{customer:{id:'customer-wrong'},transaction:{id:'tx-correct',pix:{qr_code:'000201-test'}}}},
 {data:{charge:{transaction_id:'tx-correct',pix:{qr_code:'000201-test'}}}},
];
for(const body of shapes){
 globalThis.fetch=async()=>Response.json(body);
 assert.equal((await createFortpayPixCharge(input,{apiToken:'test'})).transactionId,'tx-correct');
}
for(const [status,expected] of [['paid','COMPLETED'],['approved','COMPLETED'],['completed','COMPLETED'],['pending','PENDING'],['expired','EXPIRED'],['refunded','REFUNDED'],['failed','FAILED']]){
 for(const body of [{status},{status:'success',data:{status}},{data:{customer:{status:'approved'},transaction:{status}}}]){
  globalThis.fetch=async()=>Response.json(body);
  assert.equal((await readFortpayPixStatus('tx-correct','test')).status,expected);
 }
}
globalThis.fetch=async()=>Response.json({data:{customer:{status:'approved',id:'customer-wrong'},items:[{id:'item-wrong'}],pix:{qr_code:'000201-test'}}});
assert.equal((await readFortpayPixStatus('tx-correct','test')).status,'PENDING');
await assert.rejects(createFortpayPixCharge(input,{apiToken:'test'}),/código Pix completo/);
console.log('FortPay: envelopes de resposta, IDs e status de transações verificados; cliente/item nunca aprovam uma compra.');
