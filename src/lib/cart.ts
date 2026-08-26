import { checkoutValue } from "./tracking";

export type CartItem = {
  key: string;
  id: string;
  title: string;
  price: string;
  image: string;
  color?: string;
  voltage?: string;
  extra?: string;
  quantity: number;
  addedAt: number;
};

const CART_KEY = "checkout_cart";

function cartKey(item: Pick<CartItem, "id" | "color" | "voltage" | "extra">) {
  return [item.id, item.color || "", item.voltage || "", item.extra || ""].join("::");
}

export function readCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is CartItem => Boolean(item && typeof item === "object"))
      .map((item) => ({
        ...item,
        key: item.key || cartKey(item),
        id: String(item.id || ""),
        title: String(item.title || "Produto"),
        price: String(item.price || "0,00"),
        image: String(item.image || ""),
        quantity: Math.max(1, Math.min(10, Math.round(Number(item.quantity) || 1))),
        addedAt: Number(item.addedAt) || Date.now(),
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

export function writeCart(items: CartItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent("checkout-cart-change", { detail: items }));
  } catch {}
}

export function addCartItem(item: Omit<CartItem, "key" | "quantity" | "addedAt">) {
  const items = readCart();
  const key = cartKey(item);
  const existing = items.find((entry) => entry.key === key);
  if (existing) {
    existing.quantity = Math.min(10, existing.quantity + 1);
  } else {
    items.push({ ...item, key, quantity: 1, addedAt: Date.now() });
  }
  writeCart(items);
  return items;
}

export function removeCartItem(key: string) {
  const items = readCart().filter((item) => item.key !== key);
  writeCart(items);
  return items;
}

export function updateCartQuantity(key: string, quantity: number) {
  const items = readCart().map((item) =>
    item.key === key
      ? { ...item, quantity: Math.max(1, Math.min(10, Math.round(quantity) || 1)) }
      : item,
  );
  writeCart(items);
  return items;
}

export function cartItemCount(items: CartItem[]) {
  return items.reduce((total, item) => total + item.quantity, 0);
}

export function cartTotal(items: CartItem[]) {
  return items.reduce((total, item) => total + checkoutValue(item.price) * item.quantity, 0);
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function saveCartAsCheckout(items: CartItem[]) {
  if (!items.length || typeof window === "undefined") return null;
  const total = cartTotal(items);
  const count = cartItemCount(items);
  const first = items[0];
  const contentIds = [...new Set(items.map((item) => item.id))];
  const summary = {
    id: first.id,
    contentIds,
    title: count === 1 ? first.title : `${count} produtos do carrinho`,
    price: formatBRL(total),
    image: first.image,
    quantity: count,
    cartItems: items,
  };
  try {
    localStorage.setItem("checkout_product", JSON.stringify(summary));
  } catch {}
  return summary;
}
