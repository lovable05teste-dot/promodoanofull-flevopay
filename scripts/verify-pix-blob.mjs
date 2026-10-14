import assert from "node:assert/strict";
import { MockAgent, getGlobalDispatcher, setGlobalDispatcher } from "undici";
import { blobPixLimitStore } from "../src/lib/pix-limit.server.ts";

const priorDispatcher = getGlobalDispatcher();
const mock = new MockAgent();
mock.disableNetConnect();
setGlobalDispatcher(mock);
const priorToken = process.env.BLOB_READ_WRITE_TOKEN;
process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_teststore_fake";
const key = "ip-test";
const path = `pix-limits-v2/${key}.json`;
const ledger = { version: 2, entries: [] };
try {
  const reads = mock.get("https://teststore.private.blob.vercel-storage.com");
  reads.intercept({ path: `/${path}?cache=0`, method: "GET" }).reply(404, "");
  assert.deepEqual(await blobPixLimitStore.read(key), { ledger, etag: null });
  reads
    .intercept({ path: `/${path}?cache=0`, method: "GET" })
    .reply(200, ledger, { headers: { etag: '"v1"' } });
  assert.deepEqual(await blobPixLimitStore.read(key), { ledger, etag: '"v1"' });
  reads
    .intercept({ path: `/${path}?cache=0`, method: "GET" })
    .reply(200, { version: 2, entries: [{ id: "broken" }] }, { headers: { etag: '"bad"' } });
  await assert.rejects(blobPixLimitStore.read(key));
  const writes = mock.get("https://vercel.com");
  const writePath = `/api/blob/?${new URLSearchParams({ pathname: path })}`;
  writes
    .intercept({
      path: writePath,
      method: "PUT",
      headers: {
        "x-allow-overwrite": "0",
        "x-add-random-suffix": "0",
        "x-content-type": "application/json",
        "x-vercel-blob-access": "private",
      },
    })
    .reply(200, {
      url: `https://teststore.private.blob.vercel-storage.com/${path}`,
      pathname: path,
      etag: '"v1"',
    });
  assert.equal(await blobPixLimitStore.write(key, ledger, null), true);
  writes
    .intercept({
      path: writePath,
      method: "PUT",
      headers: { "x-allow-overwrite": "1", "x-if-match": '"v1"' },
    })
    .reply(200, {
      url: `https://teststore.private.blob.vercel-storage.com/${path}`,
      pathname: path,
      etag: '"v2"',
    });
  assert.equal(await blobPixLimitStore.write(key, ledger, '"v1"'), true);
  writes
    .intercept({ path: writePath, method: "PUT", headers: { "x-if-match": '"v1"' } })
    .reply(412, { error: { code: "precondition_failed" } });
  assert.equal(await blobPixLimitStore.write(key, ledger, '"v1"'), false);
  mock.assertNoPendingInterceptors();
  console.log(
    "Blob SDK: privado, leitura sem cache, criação sem overwrite, ETag e conflito 412 verificados sem acesso real ao store.",
  );
} finally {
  if (priorToken === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = priorToken;
  setGlobalDispatcher(priorDispatcher);
  await mock.close();
}
