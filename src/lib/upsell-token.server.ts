import { createHmac, timingSafeEqual } from 'node:crypto';

export type UpsellContext = { transactionId: string; contentIds: string[]; expiresAt: number };
export function signUpsellContext(context: UpsellContext, secret: string) {
  const body = Buffer.from(JSON.stringify(context)).toString('base64url');
  const signature = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}
export function verifyUpsellContext(token: string, secret: string): UpsellContext {
  if (typeof token !== 'string' || token.length > 8192) throw new Error('Oferta inválida.');
  const parts = token.split('.');
  if (parts.length !== 2) throw new Error('Oferta inválida.');
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  const actual = Buffer.from(parts[1], 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new Error('Oferta inválida.');
  const context = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
  if (!context || typeof context.transactionId !== 'string' || !context.transactionId ||
      !Array.isArray(context.contentIds) || !context.contentIds.length ||
      !context.contentIds.every((id: unknown) => typeof id === 'string') ||
      !Number.isFinite(context.expiresAt) || context.expiresAt <= Date.now()) {
    throw new Error('Esta oferta expirou.');
  }
  return context;
}
