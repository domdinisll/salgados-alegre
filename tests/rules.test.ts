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

test('taxas por distância e mínimo de 50 € acima de 20 km', () => {
  const m25 = [item('m-coxinha', 25, 1, 'frito')]; // 25 €
  const a = computeTotals(m25, P, S, { wholesale: false, postalCode: '2845-340', today: NOW });
  assert.equal(a.zone?.name, 'Até 20 km');
  assert.equal(a.deliveryFee, 5);
  assert.equal(a.total, 30);
  assert.equal(a.canCheckout, true);
  const b = computeTotals(m25, P, S, { wholesale: false, postalCode: '2750-100', today: NOW }); // Cascais
  assert.equal(b.canCheckout, false);
  assert.ok(b.errors.some((e) => e.includes('50,00')));
  const g = [item('g-coxinha', 50, 1, 'frito')]; // 70 €
  assert.equal(computeTotals(g, P, S, { wholesale: false, postalCode: '2750-100', today: NOW }).deliveryFee, 5);
  assert.equal(computeTotals(g, P, S, { wholesale: false, postalCode: '2710-100', today: NOW }).deliveryFee, 7); // Sintra
  const d = computeTotals(g, P, S, { wholesale: false, postalCode: '2655-100', today: NOW }); // Ericeira
  assert.equal(d.deliveryFee, 9);
  assert.equal(d.total, 79);
  assert.equal(d.freeDelivery, false); // sem entrega grátis
});

test('entrega grátis só quando há limiar configurado, calculado depois dos descontos', () => {
  const s2: Settings = structuredClone(S);
  s2.delivery.freeThreshold = 30;
  s2.pricing.codes = [{ id: 'x', code: 'TESTE10', type: 'percent', value: 10, minSubtotal: 0, active: true, validUntil: '', description: '' }];
  const items = [item('n-salsicha', 100, 1, 'congelado'), item('a-empada', 10, 1, 'pronto')]; // 30 €
  const t = computeTotals(items, P, s2, { wholesale: false, postalCode: '2845-340', today: NOW });
  assert.equal(t.freeDelivery, true);
  assert.equal(t.deliveryFee, 0);
  const t2 = computeTotals(items, P, s2, { wholesale: false, discountCode: 'teste10', postalCode: '2845-340', today: NOW });
  assert.equal(t2.codeDiscount, 3);
  assert.equal(t2.freeDelivery, false);
  assert.equal(t2.deliveryFee, 5);
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
  assert.equal(computeTotals([item('n-salsicha', 10, 1, 'frito')], P, S, { wholesale: false, today: NOW }).canCheckout, false);
  assert.equal(computeTotals([item('g-coxinha', 25, 1, 'frito')], P, S, { wholesale: false, today: NOW }).canCheckout, false); // grandes só em packs de 50
  const small = computeTotals([item('a-pao-queijo', 10, 1, 'pronto')], P, S, { wholesale: false, today: NOW });
  assert.ok(small.errors.some((e) => e.includes('valor mínimo')));
  const ps = structuredClone(P);
  ps.find((p) => p.id === 'm-coxinha')!.availability = 'esgotado';
  assert.equal(computeTotals([item('m-coxinha', 25, 2, 'frito')], ps, S, { wholesale: false, today: NOW }).canCheckout, false);
});

test('pão de queijo e empada: prontos ou congelados para o forno, ao mesmo preço', () => {
  const a = computeTotals([item('a-empada', 25, 1, 'pronto')], P, S, { wholesale: false, today: NOW });
  const b = computeTotals([item('a-empada', 25, 1, 'congelado_forno')], P, S, { wholesale: false, today: NOW });
  assert.equal(a.merchandiseSubtotal, 25);
  assert.equal(b.merchandiseSubtotal, 25);
  assert.equal(b.canCheckout, true);
});

test('zona de 50 km por código postal', () => {
  for (const ok of ['2845-340', '1000-001', '2710-001', '2750-001', '2900-001', '2135-001', '2640-001']) assert.equal(resolveZone(ok, S.delivery.zones).ok, true, ok);
  for (const no of ['4000-001', '7000-001', '2560-001', '3000-001']) assert.equal(resolveZone(no, S.delivery.zones).ok, false, no);
  assert.deepEqual(resolveZone('28451', S.delivery.zones), { ok: false, reason: 'formato' });
});

test('datas de entrega: segunda a sexta, 2 dias de antecedência, hora-limite 15h', () => {
  // sexta 30/10 11:00 + 2 dias = domingo → segunda 02/11
  assert.equal(earliestDeliveryDate(NOW, S.delivery), '2026-11-02');
  assert.equal(checkDeliveryDate('2026-11-01', NOW, S.delivery).ok, false); // domingo
  assert.equal(checkDeliveryDate('2026-11-02', NOW, S.delivery).ok, true);
  assert.equal(checkDeliveryDate('2026-11-07', NOW, S.delivery).ok, false); // sábado
  assert.equal(checkDeliveryDate('2026-12-25', NOW, S.delivery).ok, false); // feriado
  assert.equal(earliestDeliveryDate(new Date(2026, 10, 2, 14, 0), S.delivery), '2026-11-04');
  assert.equal(earliestDeliveryDate(new Date(2026, 10, 2, 15, 30), S.delivery), '2026-11-05');
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
  assert.equal(res.order.total, 50); // 20 € + 25 € + 5 € de entrega (até 20 km)
});
