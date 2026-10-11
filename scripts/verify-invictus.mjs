import assert from 'node:assert/strict';
import { createInvictusPixCharge, readInvictusPixStatus } from '../src/lib/pix.server.ts';
const input = { name: 'Cliente Teste', document: '52998224725', email: 'teste@example.com', phone: '+55 (11) 99999-9999', amountCents: 6990, itemTitle: 'Produto teste', itemId: 'produto-1' };
let calls = 0;
globalThis.fetch = async (url, init) => {
  calls++;
  assert.equal(String(url), 'https://api.invictuspayv2.com.br/api/v1/transactions');
  assert.equal(init.headers['X-Api-Key'], 'test-key');
  assert.equal(init.method, 'POST');
  const body = JSON.parse(init.body);
  assert.deepEqual(body, { amount: 6990, paymentMethod: 'pix', customer: { name: input.name, document: input.document, email: input.email, phone: '11999999999' }, items: [{ description: input.itemTitle, quantity: 1, amount: 6990, externalRef: 'produto-1' }], pix: { expirationInSeconds: 1800 } });
  return Response.json({ data: { id: '01HZXK3NDEKTSV4RRFFQ69G5FA', pix: { qrCode: '000201-test' }, customer: { id: 'wrong-id' } } });
};
const result = await createInvictusPixCharge(input, { apiKey: 'test-key' });
assert.equal(result.transactionId, '01HZXK3NDEKTSV4RRFFQ69G5FA');
assert.equal(result.pixCode, '000201-test');
for (const amountCents of [0, -1, 10.5, NaN]) await assert.rejects(createInvictusPixCharge({ ...input, amountCents }, { apiKey: 'test-key' }), /Valor/);
await assert.rejects(createInvictusPixCharge(input, { apiKey: 'test-key', postbackUrl: 'http://example.com' }), /HTTPS/);
assert.equal(calls, 1);
for (const [status, expected] of [['paid', 'COMPLETED'], ['pending', 'PENDING'], ['processing', 'PENDING'], ['antifraud', 'PENDING'], ['refused', 'REFUSED'], ['expired', 'EXPIRED'], ['refunded', 'REFUNDED'], ['chargeback', 'CHARGEBACK'], ['failed', 'FAILED']]) {
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), `https://api.invictuspayv2.com.br/api/v1/transactions/${result.transactionId}`);
    assert.equal(init.headers['X-Api-Key'], 'test-key');
    assert.equal(init.method, 'GET');
    return Response.json({ status: 'success', data: { id: result.transactionId, status, paidAt: status === 'paid' ? '2026-10-11' : undefined } });
  };
  assert.equal((await readInvictusPixStatus(result.transactionId, 'test-key')).status, expected);
}
globalThis.fetch = async () => Response.json({ message: 'Dados inválidos' }, { status: 422 });
await assert.rejects(createInvictusPixCharge(input, { apiKey: 'test-key' }), /422.*Dados inválidos/);
assert.equal((await readInvictusPixStatus(result.transactionId, 'test-key')).status, 'PENDING');
globalThis.fetch = async () => Response.json({ data: { id: 'tx' } });
await assert.rejects(createInvictusPixCharge(input, { apiKey: 'test-key' }), /código Pix completo/);
console.log('Invictus: payload, autenticação, Pix, validações, status e erros verificados.');
