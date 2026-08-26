export type ReceiptRecord = {
  name: string;
  uploadedAt: string;
  size: number;
  contentType: string;
};

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const RECEIPT_PREFIX = "uploads/";
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type BlobRecord = {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: string;
  contentType?: string;
};

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

function blobStoreId(token: string) {
  return token.split("_")[3] || "";
}

function blobHeaders(token: string, extra?: Record<string, string>) {
  const storeId = blobStoreId(token);
  if (!storeId) throw new Error("BLOB_READ_WRITE_TOKEN inválido.");
  return {
    authorization: `Bearer ${token}`,
    "x-api-version": "12",
    "x-vercel-blob-store-id": storeId,
    ...extra,
  };
}

function safeOriginalName(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(-80);
  return normalized || "comprovante";
}

function extensionForType(contentType: string) {
  return contentType === "application/pdf"
    ? ".pdf"
    : contentType === "image/png"
      ? ".png"
      : contentType === "image/webp"
        ? ".webp"
        : contentType === "image/gif"
          ? ".gif"
          : ".jpg";
}

function uniqueFileName(originalName: string, contentType: string) {
  const safeName = safeOriginalName(originalName);
  const expectedExtension = extensionForType(contentType);
  const name = safeName.toLowerCase().endsWith(expectedExtension)
    ? safeName
    : `${safeName}${expectedExtension}`;
  return `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${name}`;
}

function detectedContentType(bytes: Uint8Array): string | null {
  const text = new TextDecoder("latin1").decode(bytes.slice(0, 12));
  if (text.startsWith("%PDF-")) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) return "image/png";
  if (text.startsWith("GIF87a") || text.startsWith("GIF89a")) return "image/gif";
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return "image/webp";
  return null;
}

function validateFile(file: File, bytes: Uint8Array) {
  if (!file.name || file.name.length > 200) throw new Error("Nome de arquivo inválido.");
  if (!file.size || file.size > MAX_FILE_SIZE) {
    throw new Error("O comprovante deve ter no máximo 4 MB.");
  }
  const detected = detectedContentType(bytes);
  if (!detected || !ALLOWED_TYPES.has(detected)) {
    throw new Error("Envie uma imagem JPG, PNG, WEBP, GIF ou um arquivo PDF.");
  }
  if (file.type && ALLOWED_TYPES.has(file.type) && file.type !== detected) {
    throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
  }
  return detected;
}

async function localUploadDirectory() {
  const path = await import("node:path");
  return path.resolve(process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "uploads"));
}

async function saveLocal(name: string, bytes: Uint8Array) {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const directory = await localUploadDirectory();
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), bytes, { flag: "wx", mode: 0o600 });
}

async function putBlob(name: string, bytes: ArrayBuffer, contentType: string) {
  const token = blobToken();
  const pathname = `${RECEIPT_PREFIX}${name}`;
  const url = new URL("https://vercel.com/api/blob/");
  url.searchParams.set("pathname", pathname);
  const response = await fetch(url, {
    method: "PUT",
    headers: blobHeaders(token, {
      "x-vercel-blob-access": "private",
      "x-add-random-suffix": "0",
      "x-allow-overwrite": "0",
      "x-content-type": contentType,
    }),
    body: bytes,
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`Falha ao salvar no Vercel Blob (${response.status}): ${detail}`);
  }
}

export async function saveReceipt(file: File) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const contentType = validateFile(file, bytes);
  const name = uniqueFileName(file.name, contentType);

  if (blobToken()) await putBlob(name, buffer, contentType);
  else if (process.env.VERCEL) {
    throw new Error(
      "Armazenamento não configurado. Conecte um Vercel Blob para criar BLOB_READ_WRITE_TOKEN.",
    );
  } else await saveLocal(name, bytes);

  return { name, uploadedAt: new Date().toISOString() };
}

async function listBlobReceipts(): Promise<ReceiptRecord[]> {
  const token = blobToken();
  const records: BlobRecord[] = [];
  let cursor = "";
  do {
    const url = new URL("https://vercel.com/api/blob");
    url.searchParams.set("limit", "1000");
    url.searchParams.set("prefix", RECEIPT_PREFIX);
    if (cursor) url.searchParams.set("cursor", cursor);
    const response = await fetch(url, { headers: blobHeaders(token) });
    if (!response.ok) throw new Error(`Falha ao listar comprovantes (${response.status}).`);
    const payload = (await response.json()) as {
      blobs?: BlobRecord[];
      cursor?: string;
      hasMore?: boolean;
    };
    records.push(...(payload.blobs || []));
    cursor = payload.hasMore && payload.cursor ? payload.cursor : "";
  } while (cursor);

  return records
    .map((record) => ({
      name: record.pathname.slice(RECEIPT_PREFIX.length),
      uploadedAt: record.uploadedAt,
      size: record.size,
      contentType: record.contentType || "application/octet-stream",
    }))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
}

async function listLocalReceipts(): Promise<ReceiptRecord[]> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const directory = await localUploadDirectory();
  await fs.mkdir(directory, { recursive: true });
  const names = await fs.readdir(directory);
  const records = await Promise.all(
    names.map(async (name) => {
      const stat = await fs.stat(path.join(directory, name));
      if (!stat.isFile()) return null;
      return {
        name,
        uploadedAt: stat.birthtime.toISOString(),
        size: stat.size,
        contentType: contentTypeFromName(name),
      } satisfies ReceiptRecord;
    }),
  );
  return records
    .filter((record): record is ReceiptRecord => Boolean(record))
    .sort((a, b) => Date.parse(b.uploadedAt) - Date.parse(a.uploadedAt));
}

export async function listReceipts() {
  if (blobToken()) return listBlobReceipts();
  if (process.env.VERCEL) {
    throw new Error("Conecte um Vercel Blob para listar os comprovantes.");
  }
  return listLocalReceipts();
}

function contentTypeFromName(name: string) {
  const extension = name.toLowerCase().split(".").pop();
  return extension === "pdf"
    ? "application/pdf"
    : extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : extension === "gif"
          ? "image/gif"
          : "image/jpeg";
}

export async function readReceipt(name: string) {
  const safeName = safeOriginalName(name);
  if (safeName !== name || name.includes("..")) throw new Error("Arquivo inválido.");

  if (blobToken()) {
    const token = blobToken();
    const records = await listBlobReceiptsRaw();
    const record = records.find((item) => item.pathname === `${RECEIPT_PREFIX}${name}`);
    if (!record) throw new Error("Comprovante não encontrado.");
    const response = await fetch(record.url, { headers: blobHeaders(token) });
    if (!response.ok) throw new Error("Não foi possível abrir o comprovante.");
    return {
      bytes: await response.arrayBuffer(),
      contentType: response.headers.get("content-type") || contentTypeFromName(name),
    };
  }

  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const directory = await localUploadDirectory();
  const bytes = await fs.readFile(path.join(directory, name));
  return { bytes: Uint8Array.from(bytes).buffer, contentType: contentTypeFromName(name) };
}

async function listBlobReceiptsRaw(): Promise<BlobRecord[]> {
  const token = blobToken();
  const url = new URL("https://vercel.com/api/blob");
  url.searchParams.set("limit", "1000");
  url.searchParams.set("prefix", RECEIPT_PREFIX);
  const response = await fetch(url, { headers: blobHeaders(token) });
  if (!response.ok) throw new Error("Não foi possível localizar o comprovante.");
  const payload = (await response.json()) as { blobs?: BlobRecord[] };
  return payload.blobs || [];
}

async function secretDigest(value: string) {
  const input = new TextEncoder().encode(`receipt-admin-v1:${value}`);
  return new Uint8Array(await crypto.subtle.digest("SHA-256", input));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function adminIsConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export async function validAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD?.trim() || "";
  if (!expected || !password) return false;
  return constantTimeEqual(await secretDigest(password), await secretDigest(expected));
}

export async function adminSessionToken() {
  const password = process.env.ADMIN_PASSWORD?.trim() || "";
  return password ? hex(await secretDigest(`receipt-admin-session-v1:${password}`)) : "";
}

export async function validAdminSession(token: string) {
  const expected = await adminSessionToken();
  if (!expected || !token || token.length !== expected.length) return false;
  return constantTimeEqual(new TextEncoder().encode(token), new TextEncoder().encode(expected));
}
