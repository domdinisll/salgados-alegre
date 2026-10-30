import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTotals } from '../src/lib/pricing';
import { checkDeliveryDate, earliestDeliveryDate, resolveZone } from '../src/lib/delivery';
import { buildOrder } from '../src/lib/orders';
import { formatEuro, formatDate } from '../src/lib/format';
import { DEFAULT_SETTINGS } from '../src/config/defaults';
import { SAMPLE_PRODUCTS } from '../src/data/products';
import type { CartItem, Settings } from '../src/types';

const S: Settings = structuredClone(DEFAULT_SETTINGS);
const P = SAMPLE_PRODUCTS;
const item = (productId: string, packSize: number, quantity: number, prep: 'frito' | 'congelado' | 'pronto'): CartItem => ({
  key: `${productId}|${packSize}|${prep}`, productId, packSize, quantity, prep,
});
const NOW = new Date(2026, 9, 30, 11, 0); // sexta-feira, 30/10/2026, 11:00

test('formatação pt-PT', () => {
  assert.equal(formatEuro(6.5), '6,50 €');
  assert.equal(formatDate('2026-11-03'), '03/11/2026');
});

test('preços do catálogo real', () => {
  const unit = (id: string, prep: 'frito' | 'congelado' | 'pronto', pack: number) =>
    computeTotals([item(id, pack, 1, prep)], P, S, { wholesale: false, today: NOW }).merchandiseSubtotal;
  assert.equal(unit('g-coxinha-queijo', 'frito', 10), 14);       // 1,40 €
  assert.equal(unit('g-coxinha-queijo', 'congelado', 10), 13);   // 1,30 €
  assert.equal(unit('m-camarao', 'frito', 10), 10);              // 1,00 €
  assert.equal(unit('m-camarao', 'congelado', 10), 9);           // 0,90 €
  assert.equal(unit('a-pao-queijo', 'pronto', 10), 9);           // 0,90 €
  assert.equal(unit('a-empada', 'pronto', 10), 10);              // 1,00 €
  assert.equal(unit('n-coxinha-frango', 'frito', 100), 25);      // 100 un. = 25,00 €
  assert.equal(unit('n-coxinha-frango', 'congelado', 100), 20);  // 100 un. = 20,00 €
  assert.equal(P.length, 22);
});

test('abaixo do limiar: cobra portes da zona e indica quanto falta', () => {
  // 20 coxinhas médias fritas × 1,00 € = 20,00 €
  const t = computeTotals([item('m-coxinha', 10, 2, 'frito')], P, S, { wholesale: false, postalCode: '2845-123', today: NOW });
  assert.equal(t.merchandiseSubtotal, 20);
  assert.equal(t.deliveryFee, 4.5);
  assert.equal(t.remainingForFreeDelivery, 10);
  assert.equal(t.total, 24.5);
  assert.equal(t.canCheckout, true);
});

test('igual ou acima do limiar: entrega gratuita', () => {
  // 100 mini coxinhas fritas (25 €) + 10 coxinhas grandes congeladas (13 €) = 38 €
  const t = computeTotals([item('n-coxinha-frango', 100, 1, 'frito'), item('g-coxinha-queijo', 10, 1, 'congelado')], P, S, { wholesale: false, postalCode: '2845-123', today: NOW });
  assert.equal(t.discountedSubtotal, 38);
  assert.equal(t.deliveryFee, 0);
  assert.equal(t.freeDelivery, true);
  assert.equal(t.total, 38);
});

test('limiar calculado depois dos descontos', () => {
  // 30 coxinhas médias fritas = 30 € → grátis; com código de 10% desce para 27 € e paga portes
  const t = computeTotals([item('m-coxinha', 10, 3, 'frito')], P, S, { wholesale: false, today: NOW });
  assert.equal(t.freeDelivery, true);
  const t2 = computeTotals([item('m-coxinha', 10, 3, 'frito')], P, S, { wholesale: false, discountCode: 'bemvindo10', today: NOW });
  assert.equal(t2.codeDiscount, 3);
  assert.equal(t2.freeDelivery, false);
  assert.equal(t2.deliveryFee, S.delivery.standardFee);
});

test('preço revenda só se aplica quando configurado e a contas aprovadas', () => {
  const none = computeTotals([item('g-coxinha-queijo', 50, 1, 'frito')], P, S, { wholesale: true, today: NOW });
  assert.equal(none.productDiscounts, 0); // sem desconto de revenda definido
  const s2: Settings = structuredClone(S);
  s2.pricing.wholesaleDiscountPct = 8;
  const a = computeTotals([item('g-coxinha-queijo', 50, 1, 'frito')], P, s2, { wholesale: false, today: NOW });
  const b = computeTotals([item('g-coxinha-queijo', 50, 1, 'frito')], P, s2, { wholesale: true, today: NOW });
  assert.equal(a.productDiscounts, 0);
  assert.equal(b.productDiscounts, 5.6); // 70 € × 8%
});

test('validações: preparação indisponível, pack inválido, valor mínimo, esgotado', () => {
  const t = computeTotals([item('a-empada', 50, 1, 'frito')], P, S, { wholesale: false, today: NOW });
  assert.ok(t.errors.some((e) => e.includes('preparação')));
  const mini = computeTotals([item('n-salsicha', 10, 1, 'frito')], P, S, { wholesale: false, today: NOW });
  assert.equal(mini.canCheckout, false);
  const small = computeTotals([item('m-coxinha', 10, 1, 'frito')], P, S, { wholesale: false, today: NOW });
  assert.ok(small.errors.some((e) => e.includes('valor mínimo')));
  const ps = structuredClone(P);
  ps.find((p) => p.id === 'm-coxinha')!.availability = 'esgotado';
  const out = computeTotals([item('m-coxinha', 100, 1, 'frito')], ps, S, { wholesale: false, today: NOW });
  assert.equal(out.canCheckout, false);
});

test('zonas por código postal', () => {
  assert.equal(resolveZone('2845-123', S.delivery.zones).ok, true);
  assert.equal(resolveZone('4000-001', S.delivery.zones).ok, false);
  assert.deepEqual(resolveZone('28451', S.delivery.zones), { ok: false, reason: 'formato' });
});

test('datas de entrega: antecedência, dias permitidos e feriados', () => {
  assert.equal(earliestDeliveryDate(NOW, S.delivery), '2026-11-03');
  assert.equal(checkDeliveryDate('2026-11-02', NOW, S.delivery).ok, false);
  assert.equal(checkDeliveryDate('2026-11-03', NOW, S.delivery).ok, true);
  assert.equal(checkDeliveryDate('2026-12-25', NOW, S.delivery).ok, false);
  assert.equal(earliestDeliveryDate(new Date(2026, 10, 2, 17, 0), S.delivery), '2026-11-05');
});

test('a encomenda é sempre recalculada e nunca marcada como paga', () => {
  const res = buildOrder({
    items: [item('n-rissol-camarao', 100, 1, 'congelado'), item('a-empada', 25, 1, 'pronto')],
    discountCode: null, customerId: null,
    customer: { name: 'Teste Cliente', email: 'teste@exemplo.pt', phone: '912345678', type: 'particular' },
    address: { street: 'Rua de Teste, 1', extra: '', postalCode: '2845123', city: 'Amora' },
    deliveryDate: '2026-11-03', timeSlot: S.delivery.timeSlots[0], instructions: '', paymentMethod: 'mbway',
  }, P, S, [], 7, NOW);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.order.lines[0].prep, 'congelado');
  assert.equal(res.order.lines[1].prep, 'pronto');
  assert.equal(res.order.paymentStatus, 'pendente');
  assert.equal(res.order.simulated, true);
  assert.equal(res.order.total, 45); // 20 € + 25 €, portes grátis
});
