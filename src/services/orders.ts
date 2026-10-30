import type { Order, OrderStatus, PaymentStatus } from '../types';
import type { OrderInput } from '../lib/orders';
import { cart, ordersStore, productsStore, profileStore } from '../state';
import { api } from './repository';

const LAST_ORDER_KEY = 'salgados-alegre:ultima-encomenda';

/** Cria a encomenda no servidor, que recalcula preços, portes e stock. */
export async function placeOrder(input: OrderInput): Promise<{ ok: true; order: Order } | { ok: false; errors: string[] }> {
  try {
    const order = await api.placeOrder(input);
    try {
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    } catch {
      /* ignorar */
    }
    if (profileStore.get()) ordersStore.set((os) => [order, ...os]);
    cart.clear();
    // O stock pode ter mudado.
    api.loadProducts().then((p) => productsStore.set(p)).catch(() => undefined);
    return { ok: true, order };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : 'Não foi possível registar a encomenda.'] };
  }
}

/** Encomenda acabada de fazer neste separador (também para clientes sem conta). */
export function lastPlacedOrder(): Order | null {
  try {
    const raw = sessionStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as Order) : null;
  } catch {
    return null;
  }
}

async function patch(id: string, f: (o: Order) => Order) {
  const current = ordersStore.get().find((o) => o.id === id);
  if (!current) throw new Error('Encomenda não encontrada.');
  const next = f(current);
  await api.updateOrder(next);
  ordersStore.set((os) => os.map((o) => (o.id === id ? next : o)));
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  const at = new Date().toISOString();
  return patch(id, (o) => ({ ...o, status, statusHistory: [...o.statusHistory, { status, at }] }));
}

export function updatePaymentStatus(id: string, paymentStatus: PaymentStatus) {
  return patch(id, (o) => ({ ...o, paymentStatus }));
}

export function addOrderNote(id: string, text: string) {
  const at = new Date().toISOString();
  return patch(id, (o) => ({ ...o, notes: [...o.notes, { text, at }] }));
}
