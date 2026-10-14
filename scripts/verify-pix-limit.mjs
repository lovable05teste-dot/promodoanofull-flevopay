import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  createPixLimiter,
  pixIdentityKeys,
  pixFingerprint,
  blobPixLimitStore,
  PIX_LIMIT_MESSAGE,
} from "../src/lib/pix-limit.server.ts";
import { validatePixInput } from "../src/lib/pix.server.ts";
import {
  normalizeClientIp,
  trustedPixIp,
  verifyPixBrowserCookie,
} from "../src/lib/pix-request.server.ts";

// CAS real em memória, com yield entre leitura/gravação para provocar disputa.
class MemoryStore {
  rows = new Map();
  readFailure = false;
  writeFailure = false;
  failFinal = false;
  conflict = false;
  async read(key) {
    if (this.readFailure) throw Error("storage offline");
    const row = this.rows.get(key);
    await Promise.resolve();
    return row ? structuredClone(row) : { ledger: { version: 2, entries: [] }, etag: null };
  }
  async write(key, ledger, etag) {
    if (this.writeFailure || (this.failFinal && ledger.entries.some((e) => e.result)))
      throw Error("storage offline");
    await Promise.resolve();
    if (this.conflict || (this.rows.get(key)?.etag ?? null) !== etag) return false;
    this.rows.set(key, { ledger: structuredClone(ledger), etag: String(Number(etag ?? 0) + 1) });
    return true;
  }
}
const customer = validatePixInput({
  name: "Teste",
  document: "529.982.247-25",
  email: "TESTE@example.com",
  phone: "+55 (11) 99999-9999",
});
const secret = "only-for-tests";
let clock = 1000000;
function fixture() {
  const store = new MemoryStore();
  const statuses = new Map();
  let calls = 0;
  const generate = createPixLimiter({
    store,
    now: () => clock,
    status: async (id) => ({ status: statuses.get(id) ?? "PENDING" }),
  });
  const charge = async () => {
    const id = `tx-${++calls}`;
    return {
      transactionId: id,
      pixCode: "000201-test",
      amountCents: 6193,
      contentIds: ["6549324"],
      numItems: 1,
      itemTitle: "Teste",
      createdAt: new Date(clock).toISOString(),
      expiresAt: new Date(clock + 86400000).toISOString(),
    };
  };
  return {
    store,
    statuses,
    generate,
    charge,
    get calls() {
      return calls;
    },
  };
}
const keys = pixIdentityKeys(customer, "203.0.113.10", secret, "browser-A");
assert.equal(keys.length, 5);
for (const key of keys)
  assert.ok(
    !key.includes(customer.document) &&
      !key.includes(customer.email) &&
      !key.includes("203.0.113.10"),
  );
assert.deepEqual(
  pixIdentityKeys({ ...customer, sessionId: "changed" }, "203.0.113.10", secret, "browser-A"),
  keys,
);
assert.equal(
  pixFingerprint(customer, secret),
  pixFingerprint({ ...customer, sessionId: "different", utm: "?utm_source=other" }, secret),
);
assert.throws(() => validatePixInput({ ...customer, phone: {}, document: 123 }));
assert.throws(() => validatePixInput({ ...customer, email: "", amountCents: -1 }));

// Três cobranças, quarta bloqueada, repetir pedido reutiliza até com quota cheia.
let f = fixture();
const charges = [];
for (let i = 0; i < 3; i++) charges.push(await f.generate(keys, `order-${i}`, f.charge));
await assert.rejects(f.generate(keys, "fourth", f.charge), { message: PIX_LIMIT_MESSAGE });
assert.equal(f.calls, 3);
const reuse = await f.generate(keys, "order-0", f.charge);
assert.equal(reuse.reused, true);
assert.deepEqual(reuse.result, charges[0].result);
assert.equal(f.calls, 3);

// Pagar libera exatamente uma vaga; consulta indisponível não libera.
f.statuses.set(charges[0].result.transactionId, "COMPLETED");
await f.generate(keys, "after-payment", f.charge);
await assert.rejects(f.generate(keys, "another", f.charge), { message: PIX_LIMIT_MESSAGE });
f.statuses.set(charges[1].result.transactionId, "EXPIRED");
await f.generate(keys, "after-expiry", f.charge);
assert.equal(f.calls, 5);
clock += 2 * 86400000;
// Prazo estimado no navegador não libera uma transação ainda pendente no gateway.
await assert.rejects(f.generate(keys, "estimated-expiry", f.charge), {
  message: PIX_LIMIT_MESSAGE,
});

// Trocar cookies/sessão não muda IP; trocar IP não evita documento/email/telefone.
for (const variant of [
  pixIdentityKeys({ ...customer, sessionId: "new" }, "203.0.113.10", secret, "fresh-cookie"),
  pixIdentityKeys(customer, "203.0.113.20", secret, "fresh-cookie"),
  pixIdentityKeys(
    { ...customer, document: "12345678901", email: "new@example.com", phone: "21999999999" },
    "203.0.113.10",
    secret,
  ),
])
  await assert.rejects(f.generate(variant, "new-order", f.charge), { message: PIX_LIMIT_MESSAGE });

// 30 pedidos distintos simultâneos nunca produzem mais de três cobranças.
f = fixture();
const racing = await Promise.allSettled(
  Array.from({ length: 30 }, (_, i) => f.generate(keys, `race-${i}`, f.charge)),
);
assert.equal(racing.filter((r) => r.status === "fulfilled").length, 3);
assert.equal(f.calls, 3);
for (const row of f.store.rows.values()) assert.equal(row.ledger.entries.length, 3);

// Reload simultâneo: somente um POST. Retry depois devolve o mesmo Pix.
f = fixture();
await Promise.allSettled(
  Array.from({ length: 30 }, () => f.generate(keys, "same-order", f.charge)),
);
assert.equal(f.calls, 1);
assert.equal((await f.generate(keys, "same-order", f.charge)).reused, true);
assert.equal(f.calls, 1);

// Limite de outro sinal libera somente a reserva nova; não apaga Pix anteriores.
f = fixture();
const shared = pixIdentityKeys(customer, "203.0.113.50", secret);
for (let i = 0; i < 3; i++) await f.generate(shared, `existing-${i}`, f.charge);
const changedIp = pixIdentityKeys(customer, "203.0.113.51", secret);
await assert.rejects(f.generate(changedIp, "blocked-by-document", f.charge));
assert.equal(f.store.rows.get(changedIp[0]).ledger.entries.length, 0);
assert.equal(f.store.rows.get(shared[1]).ledger.entries.length, 3);

// Armazenamento indisponível ou disputa esgotada: zero POSTs.
for (const mode of ["readFailure", "writeFailure", "conflict"]) {
  f = fixture();
  f.store[mode] = true;
  await assert.rejects(f.generate(keys, "no-store", f.charge));
  assert.equal(f.calls, 0);
}
const tokenBefore = process.env.BLOB_READ_WRITE_TOKEN;
const storeBefore = process.env.BLOB_STORE_ID;
delete process.env.BLOB_READ_WRITE_TOKEN;
delete process.env.BLOB_STORE_ID;
await assert.rejects(blobPixLimitStore.read(keys[0]));
if (tokenBefore !== undefined) process.env.BLOB_READ_WRITE_TOKEN = tokenBefore;
if (storeBefore !== undefined) process.env.BLOB_STORE_ID = storeBefore;

// Timeout/resposta perdida ou falha de persistência após criação retêm quota.
f = fixture();
for (let i = 0; i < 3; i++)
  await assert.rejects(
    f.generate(keys, `timeout-${i}`, async () => {
      throw Error("timeout");
    }),
  );
await assert.rejects(f.generate(keys, "after-timeouts", f.charge));
assert.equal(f.calls, 0);
await assert.rejects(f.generate(keys, "timeout-0", f.charge), /processado/);
clock += 86400000 + 300001;
await f.generate(keys, "after-unknown-expired", f.charge);
assert.equal(f.calls, 1);
f = fixture();
f.store.failFinal = true;
for (let i = 0; i < 3; i++) await assert.rejects(f.generate(keys, `persist-${i}`, f.charge));
f.store.failFinal = false;
await assert.rejects(f.generate(keys, "after-final-failure", f.charge));
assert.equal(f.calls, 3);

// Instâncias separadas compartilham a quota (não há limite só em memória).
f = fixture();
const other = createPixLimiter({
  store: f.store,
  now: () => clock,
  status: async () => ({ status: "PENDING" }),
});
await Promise.allSettled(
  Array.from({ length: 20 }, (_, i) =>
    (i % 2 ? other : f.generate)(keys, `instance-${i}`, f.charge),
  ),
);
assert.equal(f.calls, 3);

// Origem do IP, IPv6 /64, representação equivalente e cookie adulterado.
assert.equal(normalizeClientIp("::ffff:203.0.113.10"), "203.0.113.10");
assert.equal(
  normalizeClientIp("2001:db8:abcd:1::1"),
  normalizeClientIp("2001:0db8:abcd:0001:ffff::2"),
);
assert.notEqual(normalizeClientIp("2001:db8:abcd:1::1"), normalizeClientIp("2001:db8:abcd:2::1"));
assert.throws(() => normalizeClientIp("203.0.113.10, 192.0.2.1"));
assert.equal(
  trustedPixIp(
    new Request("https://site.example", {
      headers: { "x-forwarded-for": "203.0.113.10", "cf-connecting-ip": "192.0.2.99" },
    }),
    true,
  ),
  "203.0.113.10",
);
assert.throws(() =>
  trustedPixIp(
    new Request("https://site.example", { headers: { "cf-connecting-ip": "192.0.2.99" } }),
    true,
  ),
);
assert.throws(() =>
  trustedPixIp(
    new Request("https://site.example", { headers: { "x-forwarded-for": "203.0.113.10" } }),
    false,
  ),
);
const browser = "11111111-1111-4111-8111-111111111111";
const cookie = `${browser}.${createHmac("sha256", secret).update(`pix-browser:${browser}`).digest("hex")}`;
assert.equal(verifyPixBrowserCookie(cookie, secret), browser);
assert.equal(verifyPixBrowserCookie(cookie, "wrong-key"), "");
assert.equal(verifyPixBrowserCookie(cookie + ".extra", secret), "");
assert.equal(verifyPixBrowserCookie("arbitrary-client-value", secret), "");
console.log(
  "Pix limit: quotas, CAS concorrente, instâncias distintas, reload, pagamento, expiração, troca de identidade, falhas, IPv6 e cookie validados. Nenhuma cobrança real.",
);
