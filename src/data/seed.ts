import type { CartItem, Customer, Order, OrderStatus, PaymentMethodId, Product, Settings } from '../types';
import { computeTotals } from '../lib/pricing';
import { orderNumber } from '../lib/orders';
import { toISODate } from '../lib/format';

// Clientes e encomendas FICTÍCIOS, apenas para demonstrar o painel de administração.

export const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: 'cu-1', name: 'Marta Ferreira (exemplo)', email: 'marta@exemplo.pt', phone: '912 345 678', type: 'particular',
    wholesaleApproved: false, createdAt: '2026-08-14T10:20:00.000Z', sampleData: true,
    addresses: [{ id: 'a1', label: 'Casa', street: 'Rua das Flores, 12, 2.º Esq.', extra: '', postalCode: '2845-123', city: 'Amora' }],
  },
  {
    id: 'cu-2', name: 'Rui Santos (exemplo)', email: 'cafe@exemplo.pt', phone: '936 222 111', type: 'revenda',
    businessName: 'Café Central (exemplo)', businessContact: 'Rui Santos', nif: '', wholesaleApproved: true,
    createdAt: '2026-06-02T09:00:00.000Z', sampleData: true,
    addresses: [{ id: 'a2', label: 'Café', street: 'Avenida da República, 40', extra: 'Loja A', postalCode: '2800-210', city: 'Almada' }],
  },
  {
    id: 'cu-3', name: 'Ana Costa (exemplo)', email: 'eventos@exemplo.pt', phone: '965 000 444', type: 'revenda',
    businessName: 'Ana Costa Eventos (exemplo)', businessContact: 'Ana Costa', nif: '', wholesaleApproved: false,
    createdAt: '2026-10-21T15:45:00.000Z', sampleData: true,
    addresses: [{ id: 'a3', label: 'Armazém', street: 'Rua do Comércio, 7', extra: '', postalCode: '1100-150', city: 'Lisboa' }],
  },
];

interface SeedSpec {
  customer: string;
  daysAgo: number;
  deliveryInDays: number;
  items: Omit<CartItem, 'key'>[];
  status: OrderStatus;
  method: PaymentMethodId;
  slot: number;
}

const SPECS: SeedSpec[] = [
  { customer: 'cu-2', daysAgo: 0, deliveryInDays: 4, status: 'recebida', method: 'mbway', slot: 0, items: [
    { productId: 'g-coxinha-queijo', packSize: 50, quantity: 2, prep: 'congelado' },
    { productId: 'n-rissol-camarao', packSize: 100, quantity: 2, prep: 'congelado' },
  ] },
  { customer: 'cu-1', daysAgo: 1, deliveryInDays: 3, status: 'em_preparacao', method: 'multibanco', slot: 2, items: [
    { productId: 'n-coxinha-frango', packSize: 100, quantity: 1, prep: 'frito' },
  ] },
  { customer: 'cu-3', daysAgo: 2, deliveryInDays: 5, status: 'recebida', method: 'cartao', slot: 1, items: [
    { productId: 'm-croquete-carne', packSize: 50, quantity: 1, prep: 'frito' },
    { productId: 'a-empada', packSize: 25, quantity: 1, prep: 'pronto' },
    { productId: 'n-salsicha', packSize: 100, quantity: 1, prep: 'frito' },
  ] },
  { customer: 'cu-2', daysAgo: 6, deliveryInDays: 1, status: 'pronta_envio', method: 'multibanco', slot: 0, items: [
    { productId: 'm-coxinha', packSize: 100, quantity: 2, prep: 'congelado' },
  ] },
  { customer: 'cu-1', daysAgo: 9, deliveryInDays: 0, status: 'em_distribuicao', method: 'paypal', slot: 1, items: [
    { productId: 'm-pastel-bacalhau', packSize: 25, quantity: 1, prep: 'frito' },
    { productId: 'a-pao-queijo', packSize: 10, quantity: 1, prep: 'pronto' },
  ] },
  { customer: 'cu-2', daysAgo: 14, deliveryInDays: -10, status: 'entregue', method: 'mbway', slot: 0, items: [
    { productId: 'n-croquete-carne', packSize: 100, quantity: 2, prep: 'congelado' },
    { productId: 'g-rissol-frango-milho-queijo', packSize: 25, quantity: 2, prep: 'congelado' },
  ] },
  { customer: 'cu-1', daysAgo: 21, deliveryInDays: -18, status: 'entregue', method: 'cartao', slot: 2, items: [
    { productId: 'm-camarao', packSize: 25, quantity: 1, prep: 'frito' },
  ] },
  { customer: 'cu-3', daysAgo: 25, deliveryInDays: -22, status: 'cancelada', method: 'multibanco', slot: 1, items: [
    { productId: 'n-bolinha-queijo', packSize: 100, quantity: 1, prep: 'frito' },
  ] },
];

export function buildSampleOrders(products: Product[], settings: Settings, customers: Customer[], now: Date): Order[] {
  return SPECS.map((s, i) => {
    const c = customers.find((x) => x.id === s.customer)!;
    const created = new Date(now.getTime() - s.daysAgo * 864e5 - (i + 1) * 37 * 60e3);
    const delivery = new Date(now.getFullYear(), now.getMonth(), now.getDate() + s.deliveryInDays);
    const items = s.items.map((it, k) => ({ ...it, key: `seed-${i}-${k}` }));
    const addr = c.addresses[0];
    const t = computeTotals(items, products, settings, {
      wholesale: c.type === 'revenda' && c.wholesaleApproved,
      postalCode: addr.postalCode,
      today: created,
    });
    const at = created.toISOString();
    return {
      id: `o-seed-${i + 1}`,
      number: orderNumber(1040 - i * 3, created),
      createdAt: at,
      customerId: c.id,
      customer: { name: c.name, email: c.email, phone: c.phone, type: c.type, businessName: c.businessName, nif: c.nif },
      lines: t.lines.map((l) => ({
        productId: l.item.productId, productName: l.product!.name, packSize: l.item.packSize, quantity: l.item.quantity,
        units: l.units, prep: l.item.prep, unitPrice: l.unitPrice, gross: l.gross, discount: l.discount,
        discountLabel: l.discountLabel, total: l.total,
      })),
      address: { street: addr.street, extra: addr.extra, postalCode: addr.postalCode, city: addr.city },
      zoneName: t.zone?.name ?? '—',
      deliveryDate: toISODate(delivery),
      timeSlot: settings.delivery.timeSlots[s.slot] ?? '',
      instructions: i === 0 ? 'Entregar pela porta lateral do café.' : '',
      merchandiseSubtotal: t.merchandiseSubtotal,
      productDiscounts: t.productDiscounts,
      codeDiscount: 0,
      discountCode: null,
      deliveryFee: t.deliveryFee,
      total: t.total,
      paymentMethod: s.method,
      paymentStatus: 'pendente',
      simulated: true,
      status: s.status,
      statusHistory: [{ status: 'recebida', at }, ...(s.status !== 'recebida' ? [{ status: s.status, at }] : [])],
      notes: i === 0 ? [{ text: 'Cliente habitual. Confirmar se quer também empadas.', at }] : [],
      sampleData: true,
    } satisfies Order;
  });
}
