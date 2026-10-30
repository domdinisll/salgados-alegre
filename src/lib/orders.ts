import type { CartItem, Customer, CustomerType, Order, OrderLine, PaymentMethodId, Product, Settings } from '../types';
import { checkDeliveryDate, normalizePostalCode } from './delivery';
import { computeTotals } from './pricing';

export interface OrderInput {
  items: CartItem[];
  discountCode: string | null;
  customerId: string | null;
  customer: { name: string; email: string; phone: string; type: CustomerType; businessName?: string; nif?: string };
  address: { street: string; extra: string; postalCode: string; city: string };
  deliveryDate: string;
  timeSlot: string;
  instructions: string;
  paymentMethod: PaymentMethodId;
}

export type BuildResult = { ok: true; order: Order } | { ok: false; errors: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(\+351\s?)?[29]\d{2}\s?\d{3}\s?\d{3}$/;

export function validateCustomerInfo(c: OrderInput['customer']): Record<string, string> {
  const e: Record<string, string> = {};
  if (c.name.trim().length < 3) e.name = 'Indique o seu nome completo.';
  if (!EMAIL_RE.test(c.email.trim())) e.email = 'Indique um endereço de email válido, por exemplo nome@exemplo.pt.';
  if (!PHONE_RE.test(c.phone.trim())) e.phone = 'Indique um número de telefone português válido, com 9 dígitos.';
  return e;
}

export function validateNif(nif: string): boolean {
  if (!/^\d{9}$/.test(nif)) return false;
  const digits = nif.split('').map(Number);
  const sum = digits.slice(0, 8).reduce((s, d, i) => s + d * (9 - i), 0);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === digits[8];
}

export function orderNumber(seq: number, date: Date): string {
  return `SA-${date.getFullYear()}-${String(seq).padStart(5, '0')}`;
}

/**
 * Constrói uma encomenda RECALCULANDO todos os valores a partir do catálogo e das definições.
 * Nunca confia em totais enviados pelo navegador. No servidor, esta mesma função deve correr
 * dentro de uma transação, com o catálogo e o stock lidos da base de dados.
 */
export function buildOrder(
  input: OrderInput,
  products: Product[],
  settings: Settings,
  customers: Customer[],
  seq: number,
  now: Date,
): BuildResult {
  const errors: string[] = [];
  const known = input.customerId ? customers.find((c) => c.id === input.customerId) : undefined;
  const wholesale = !!known && known.type === 'revenda' && known.wholesaleApproved;
  const postalCode = normalizePostalCode(input.address.postalCode);
  const t = computeTotals(input.items, products, settings, { wholesale, discountCode: input.discountCode, postalCode, today: now });

  errors.push(...t.errors);
  if (t.zoneError) errors.push(t.zoneError);
  if (input.discountCode && t.codeError) errors.push(t.codeError);
  errors.push(...Object.values(validateCustomerInfo(input.customer)));
  if (input.address.street.trim().length < 4) errors.push('Indique a morada de entrega.');
  if (input.address.city.trim().length < 2) errors.push('Indique a localidade.');
  const dc = checkDeliveryDate(input.deliveryDate, now, settings.delivery);
  if (!dc.ok) errors.push(dc.message);
  if (settings.delivery.timeSlots.length > 0 && !settings.delivery.timeSlots.includes(input.timeSlot)) {
    errors.push('Escolha um horário de entrega.');
  }
  if (errors.length) return { ok: false, errors };

  const lines: OrderLine[] = t.lines.map((l) => ({
    productId: l.item.productId,
    productName: l.product!.name,
    packSize: l.item.packSize,
    quantity: l.item.quantity,
    units: l.units,
    prep: l.item.prep,
    unitPrice: l.unitPrice,
    gross: l.gross,
    discount: l.discount,
    discountLabel: l.discountLabel,
    total: l.total,
  }));

  const at = now.toISOString();
  return {
    ok: true,
    order: {
      id: `o-${seq}-${now.getTime().toString(36)}`,
      number: orderNumber(seq, now),
      createdAt: at,
      customerId: input.customerId,
      customer: { ...input.customer, name: input.customer.name.trim(), email: input.customer.email.trim() },
      lines,
      address: { ...input.address, postalCode },
      zoneName: t.zone!.name,
      deliveryDate: input.deliveryDate,
      timeSlot: input.timeSlot,
      instructions: input.instructions.trim(),
      merchandiseSubtotal: t.merchandiseSubtotal,
      productDiscounts: t.productDiscounts,
      codeDiscount: t.codeDiscount,
      discountCode: t.code?.code ?? null,
      deliveryFee: t.deliveryFee,
      total: t.total,
      paymentMethod: input.paymentMethod,
      // Uma encomenda só passa a "pago" depois de confirmação verificada do fornecedor de pagamentos
      // (webhook assinado, no servidor). Na demonstração fica sempre "pendente" e marcada como simulada.
      paymentStatus: 'pendente',
      simulated: true,
      status: 'recebida',
      statusHistory: [{ status: 'recebida', at }],
      notes: [],
    },
  };
}
