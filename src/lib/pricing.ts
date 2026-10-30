import type { CartItem, DeliveryZone, DiscountCode, PrepOptionId, Product, Settings } from '../types';
import { resolveZone } from './delivery';
import { formatEuro, round2 } from './format';

/**
 * Motor de preços. É puro (sem acesso a armazenamento) para poder ser reutilizado
 * tal e qual no servidor, onde os totais têm de ser SEMPRE recalculados.
 */

export interface PricingContext {
  /** Cliente de revenda com preços de grosso aprovados. */
  wholesale: boolean;
  discountCode?: string | null;
  postalCode?: string | null;
  today?: Date;
}

export interface LineResult {
  item: CartItem;
  product: Product | undefined;
  units: number;
  unitPrice: number;
  gross: number;
  discountPct: number;
  discount: number;
  discountLabel: string;
  total: number;
  error: string | null;
}

export interface TotalsResult {
  lines: LineResult[];
  itemCount: number;
  merchandiseSubtotal: number;
  productDiscounts: number;
  subtotalAfterProductDiscounts: number;
  code: DiscountCode | null;
  codeDiscount: number;
  codeError: string | null;
  /** Base para portes grátis: subtotal após descontos e antes dos portes. */
  discountedSubtotal: number;
  zone: DeliveryZone | null;
  zoneError: string | null;
  deliveryFee: number;
  deliveryFeeEstimated: boolean;
  freeDelivery: boolean;
  remainingForFreeDelivery: number;
  total: number;
  errors: string[];
  canCheckout: boolean;
}

export function priceFor(product: Product, prep: PrepOptionId): number | null {
  const cfg = product.prep[prep];
  return cfg && cfg.enabled ? cfg.unitPrice : null;
}

/** Preço mais baixo por unidade (para "desde"). */
export function fromPrice(product: Product): number {
  const prices = (Object.keys(product.prep) as PrepOptionId[])
    .map((k) => priceFor(product, k))
    .filter((x): x is number => x !== null);
  return prices.length ? Math.min(...prices) : 0;
}

export function enabledPreps(product: Product): PrepOptionId[] {
  return (Object.keys(product.prep) as PrepOptionId[]).filter((k) => product.prep[k].enabled);
}

export function lineDiscount(product: Product, units: number, ctx: PricingContext, settings: Settings): { pct: number; label: string } {
  let best = { pct: 0, label: '' };
  for (const t of [...product.tiers].sort((a, b) => a.minUnits - b.minUnits)) {
    if (units >= t.minUnits && t.discountPct > best.pct) best = { pct: t.discountPct, label: `${t.label} (−${t.discountPct}%)` };
  }
  if (ctx.wholesale && product.resale && settings.pricing.wholesaleDiscountPct > best.pct) {
    best = { pct: settings.pricing.wholesaleDiscountPct, label: `Preço revenda (−${settings.pricing.wholesaleDiscountPct}%)` };
  }
  return best;
}

export function validateLine(product: Product | undefined, item: CartItem, ctx: PricingContext): string | null {
  if (!product || !product.active) return 'Este produto já não está disponível.';
  if (product.availability === 'esgotado') return `${product.name} está esgotado.`;
  if (product.availability === 'brevemente') return `${product.name} ainda não está disponível para encomenda.`;
  if (product.wholesaleOnly && !ctx.wholesale) return `${product.name} está disponível apenas para clientes de revenda.`;
  if (!product.prep[item.prep]?.enabled) return `A preparação escolhida não está disponível para ${product.name}.`;
  if (!product.packSizes.includes(item.packSize)) return `O pack escolhido para ${product.name} já não está disponível.`;
  if (!Number.isInteger(item.quantity) || item.quantity < 1) return 'Indique uma quantidade válida (número inteiro, mínimo 1).';
  const units = item.packSize * item.quantity;
  if (units < product.minOrderUnits) return `${product.name}: a encomenda mínima é de ${product.minOrderUnits} unidades.`;
  if (product.stock !== null && units > product.stock) return `${product.name}: só temos ${product.stock} unidades disponíveis.`;
  return null;
}

export function computeLine(item: CartItem, product: Product | undefined, ctx: PricingContext, settings: Settings): LineResult {
  const error = validateLine(product, item, ctx);
  const units = item.packSize * Math.max(0, item.quantity || 0);
  const unitPrice = product ? priceFor(product, item.prep) ?? 0 : 0;
  const gross = round2(unitPrice * units);
  const d = product ? lineDiscount(product, units, ctx, settings) : { pct: 0, label: '' };
  const discount = round2((gross * d.pct) / 100);
  return { item, product, units, unitPrice, gross, discountPct: d.pct, discount, discountLabel: d.label, total: round2(gross - discount), error };
}

export function evaluateCode(code: string | null | undefined, subtotal: number, settings: Settings, today: Date): { code: DiscountCode | null; discount: number; error: string | null } {
  if (!code) return { code: null, discount: 0, error: null };
  const found = settings.pricing.codes.find((c) => c.code.toUpperCase() === code.trim().toUpperCase());
  if (!found || !found.active) return { code: null, discount: 0, error: 'Este código de desconto não é válido.' };
  if (found.validUntil) {
    const [y, m, d] = found.validUntil.split('-').map(Number);
    if (today > new Date(y, m - 1, d, 23, 59, 59)) return { code: null, discount: 0, error: 'Este código de desconto já expirou.' };
  }
  if (subtotal < found.minSubtotal) {
    return { code: null, discount: 0, error: `Este código é válido para encomendas a partir de ${formatEuro(found.minSubtotal)}.` };
  }
  const raw = found.type === 'percent' ? (subtotal * found.value) / 100 : found.value;
  return { code: found, discount: round2(Math.min(raw, subtotal)), error: null };
}

export function computeTotals(items: CartItem[], products: Product[], settings: Settings, ctx: PricingContext): TotalsResult {
  const today = ctx.today ?? new Date();
  const lines = items.map((it) => computeLine(it, products.find((p) => p.id === it.productId), ctx, settings));
  const merchandiseSubtotal = round2(lines.reduce((s, l) => s + l.gross, 0));
  const productDiscounts = round2(lines.reduce((s, l) => s + l.discount, 0));
  const subtotalAfterProductDiscounts = round2(merchandiseSubtotal - productDiscounts);
  const codeEval = evaluateCode(ctx.discountCode, subtotalAfterProductDiscounts, settings, today);
  const discountedSubtotal = round2(subtotalAfterProductDiscounts - codeEval.discount);

  const d = settings.delivery;
  let zone: DeliveryZone | null = null;
  let zoneError: string | null = null;
  if (ctx.postalCode) {
    const z = resolveZone(ctx.postalCode, d.zones);
    if (z.ok) zone = z.zone;
    else zoneError = z.reason === 'formato'
      ? 'Indique um código postal válido (formato 0000-000).'
      : 'Lamentamos, ainda não fazemos entregas neste código postal.';
  }

  const freeDelivery = items.length > 0 && discountedSubtotal >= d.freeThreshold;
  const baseFee = zone ? zone.fee : d.standardFee;
  const deliveryFee = items.length === 0 || freeDelivery ? 0 : round2(baseFee);
  const remainingForFreeDelivery = freeDelivery ? 0 : round2(Math.max(0, d.freeThreshold - discountedSubtotal));

  const errors: string[] = [];
  for (const l of lines) if (l.error) errors.push(l.error);
  if (items.length === 0) errors.push('O carrinho está vazio.');
  if (items.length > 0 && discountedSubtotal < d.minOrderAmount) {
    errors.push(`O valor mínimo de encomenda é ${formatEuro(d.minOrderAmount)}. Faltam ${formatEuro(d.minOrderAmount - discountedSubtotal)}.`);
  }
  if (!settings.business.storeOpen) errors.push(settings.business.closedMessage);

  return {
    lines,
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    merchandiseSubtotal,
    productDiscounts,
    subtotalAfterProductDiscounts,
    code: codeEval.code,
    codeDiscount: codeEval.discount,
    codeError: codeEval.error,
    discountedSubtotal,
    zone,
    zoneError,
    deliveryFee,
    deliveryFeeEstimated: !zone,
    freeDelivery,
    remainingForFreeDelivery,
    total: round2(discountedSubtotal + deliveryFee),
    errors,
    canCheckout: errors.length === 0,
  };
}
