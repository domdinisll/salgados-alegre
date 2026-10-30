import type { Order, OrderStatus } from '../types';
import { buildOrder, type OrderInput } from '../lib/orders';
import { cart, customersStore, ordersStore, productsStore, settingsStore } from '../state';
import { repository } from './repository';
import { providerFor } from './payments';

/**
 * Processamento de encomendas (demonstração).
 * Em produção, `placeOrder` passa a ser um pedido ao servidor, que recalcula preços,
 * descontos, portes e stock, e grava tudo numa transação.
 */
export async function placeOrder(input: OrderInput): Promise<{ ok: true; order: Order; note: string } | { ok: false; errors: string[] }> {
  const res = buildOrder(input, productsStore.get(), settingsStore.get(), customersStore.get(), repository.nextOrderSeq(), new Date());
  if (!res.ok) return res;
  const payment = await providerFor(input.paymentMethod).start(res.order);

  // Reserva de stock (só para produtos com stock controlado).
  productsStore.set((ps) =>
    ps.map((p) => {
      if (p.stock === null) return p;
      const used = res.order.lines.filter((l) => l.productId === p.id).reduce((s, l) => s + l.units, 0);
      if (!used) return p;
      const stock = Math.max(0, p.stock - used);
      return { ...p, stock, availability: stock === 0 ? 'esgotado' : p.availability };
    }),
  );
  ordersStore.set((os) => [res.order, ...os]);
  cart.clear();
  return { ok: true, order: res.order, note: payment.realWorldNote };
}

export function updateOrderStatus(id: string, status: OrderStatus) {
  const at = new Date().toISOString();
  ordersStore.set((os) => os.map((o) => (o.id === id ? { ...o, status, statusHistory: [...o.statusHistory, { status, at }] } : o)));
}

export function addOrderNote(id: string, text: string) {
  const at = new Date().toISOString();
  ordersStore.set((os) => os.map((o) => (o.id === id ? { ...o, notes: [...o.notes, { text, at }] } : o)));
}
