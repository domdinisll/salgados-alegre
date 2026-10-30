import type { CartItem, Customer, Order, PrepOptionId, Product, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { createStore, useStore } from '../lib/store';
import { api } from '../services/repository';
import { consumeAuthRedirect, currentSession, fetchUser, onSessionChange } from '../services/supabase';
import { readJSON, writeJSON } from '../services/storage';
import { computeTotals } from '../lib/pricing';

// ---------- Dados vindos do servidor ----------
export const productsStore = createStore<Product[]>([]);
export const settingsStore = createStore<Settings>(DEFAULT_SETTINGS);
export const customersStore = createStore<Customer[]>([]); // apenas para administradores
export const ordersStore = createStore<Order[]>([]);       // as do cliente, ou todas (administrador)
export const profileStore = createStore<Customer | null>(null);

type AppStatus = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string };
export const appStore = createStore<AppStatus>({ state: 'loading' });
/** Tipo de link de email recebido ao abrir o site ('recovery', 'signup', …). */
export const authRedirectStore = createStore<string | null>(null);

export async function loadUserData() {
  if (!currentSession()) {
    profileStore.set(null);
    ordersStore.set([]);
    customersStore.set([]);
    return;
  }
  const user = await fetchUser();
  if (!user) {
    profileStore.set(null);
    ordersStore.set([]);
    return;
  }
  const [profile, orders] = await Promise.all([api.loadProfile(user.id), api.loadOrders()]);
  profileStore.set(profile);
  ordersStore.set(orders);
  customersStore.set(profile?.isAdmin ? await api.loadProfiles() : []);
}

export async function bootstrap() {
  authRedirectStore.set(consumeAuthRedirect());
  appStore.set({ state: 'loading' });
  try {
    const [products, settings] = await Promise.all([api.loadProducts(), api.loadSettings()]);
    productsStore.set(products);
    settingsStore.set(settings);
    await loadUserData().catch(() => undefined);
    appStore.set({ state: 'ready' });
  } catch (e) {
    appStore.set({ state: 'error', message: e instanceof Error ? e.message : 'Erro ao carregar a loja.' });
  }
}

let lastUserId = currentSession()?.user.id ?? null;
onSessionChange((s) => {
  const id = s?.user.id ?? null;
  if (id !== lastUserId) {
    lastUserId = id;
    void loadUserData();
  }
});

// ---------- Carrinho (guardado no navegador) ----------
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
  setTimeout(() => toastStore.set((t) => t.filter((x) => x.id !== id)), 4600);
}

/** Mensagem de erro amigável a partir de qualquer erro. */
export function errorText(e: unknown): string {
  return e instanceof Error && e.message ? e.message : 'Não foi possível concluir a operação. Tente novamente.';
}

// ---------- Hooks ----------
export const useProducts = () => useStore(productsStore);
export const useSettings = () => useStore(settingsStore);
export const useCustomers = () => useStore(customersStore);
export const useOrders = () => useStore(ordersStore);
export const useCart = () => useStore(cartStore);
export const useApp = () => useStore(appStore);
export const useCurrentCustomer = () => useStore(profileStore);

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
