import type { CartItem, Customer, Order, PrepOptionId, Product, Settings } from '../types';
import { createStore, useStore } from '../lib/store';
import { repository } from '../services/repository';
import { readJSON, writeJSON } from '../services/storage';
import { computeTotals } from '../lib/pricing';

// ---------- Dados da loja (catálogo, definições, clientes, encomendas) ----------
export const productsStore = createStore<Product[]>(repository.loadProducts(), (v) => repository.saveProducts(v));
export const settingsStore = createStore<Settings>(repository.loadSettings(), (v) => repository.saveSettings(v));
export const customersStore = createStore<Customer[]>(repository.loadCustomers(), (v) => repository.saveCustomers(v));
export const ordersStore = createStore<Order[]>(repository.loadOrders(), (v) => repository.saveOrders(v));

// ---------- Sessão (demonstração) ----------
interface Session { customerId: string | null; admin: boolean }
export const sessionStore = createStore<Session>(readJSON('session', { customerId: null, admin: false }), (v) => writeJSON('session', v));

// ---------- Carrinho (persistido localmente, mantém-se entre sessões) ----------
interface CartState { items: CartItem[]; code: string | null; postalCode: string | null }
export const cartStore = createStore<CartState>(readJSON('cart', { items: [], code: null, postalCode: null }), (v) => writeJSON('cart', v));

export const cart = {
  add(productId: string, packSize: number, quantity: number, prep: PrepOptionId) {
    const key = `${productId}|${packSize}|${prep}`;
    cartStore.set((s) => {
      const existing = s.items.find((i) => i.key === key);
      const items = existing
        ? s.items.map((i) => (i.key === key ? { ...i, quantity: i.quantity + quantity } : i))
        : [...s.items, { key, productId, packSize, quantity, prep }];
      return { ...s, items };
    });
  },
  setQuantity(key: string, quantity: number) {
    cartStore.set((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? { ...i, quantity } : i)) }));
  },
  /** Altera preparação ou pack de uma linha, fundindo com outra linha igual se existir. */
  change(key: string, patch: Partial<Pick<CartItem, 'prep' | 'packSize'>>) {
    cartStore.set((s) => {
      const item = s.items.find((i) => i.key === key);
      if (!item) return s;
      const next = { ...item, ...patch };
      next.key = `${next.productId}|${next.packSize}|${next.prep}`;
      const others = s.items.filter((i) => i.key !== key);
      const dup = others.find((i) => i.key === next.key);
      const items = dup
        ? others.map((i) => (i.key === next.key ? { ...i, quantity: i.quantity + next.quantity } : i))
        : s.items.map((i) => (i.key === key ? next : i));
      return { ...s, items };
    });
  },
  remove(key: string) {
    cartStore.set((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) }));
  },
  clear() {
    cartStore.set((s) => ({ ...s, items: [], code: null }));
  },
  setCode(code: string | null) {
    cartStore.set((s) => ({ ...s, code }));
  },
  setPostalCode(postalCode: string | null) {
    cartStore.set((s) => ({ ...s, postalCode }));
  },
};

// ---------- UI ----------
export interface Toast { id: number; text: string; tone: 'success' | 'info' | 'error' }
export const toastStore = createStore<Toast[]>([]);
let toastId = 0;
export function toast(text: string, tone: Toast['tone'] = 'success') {
  const id = ++toastId;
  toastStore.set((t) => [...t, { id, text, tone }]);
  setTimeout(() => toastStore.set((t) => t.filter((x) => x.id !== id)), 4200);
}

// ---------- Hooks de conveniência ----------
export const useProducts = () => useStore(productsStore);
export const useSettings = () => useStore(settingsStore);
export const useCustomers = () => useStore(customersStore);
export const useOrders = () => useStore(ordersStore);
export const useSession = () => useStore(sessionStore);
export const useCart = () => useStore(cartStore);

export function useCurrentCustomer(): Customer | null {
  const { customerId } = useSession();
  const customers = useCustomers();
  return customerId ? customers.find((c) => c.id === customerId) ?? null : null;
}

export function isWholesale(c: Customer | null): boolean {
  return !!c && c.type === 'revenda' && c.wholesaleApproved;
}

export function useCartTotals(postalCodeOverride?: string | null) {
  const c = useCart();
  const products = useProducts();
  const settings = useSettings();
  const customer = useCurrentCustomer();
  return computeTotals(c.items, products, settings, {
    wholesale: isWholesale(customer),
    discountCode: c.code,
    postalCode: postalCodeOverride === undefined ? c.postalCode : postalCodeOverride,
  });
}

export function resetDemo() {
  repository.reset();
  window.location.hash = '';
  window.location.reload();
}
