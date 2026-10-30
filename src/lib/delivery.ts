import type { DeliveryZone, Settings } from '../types';
import { parseISODate, toISODate } from './format';

export const POSTAL_CODE_RE = /^\d{4}-\d{3}$/;

/** Normaliza "2845123" ou "2845 123" para "2845-123". */
export function normalizePostalCode(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 7) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return raw.trim();
}

function inRanges(prefix: number, ranges: string): boolean {
  return ranges
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean)
    .some((r) => {
      const [a, b] = r.split('-').map((x) => parseInt(x.trim(), 10));
      if (Number.isNaN(a)) return false;
      return b === undefined || Number.isNaN(b) ? prefix === a : prefix >= a && prefix <= b;
    });
}

export type ZoneResult =
  | { ok: true; zone: DeliveryZone }
  | { ok: false; reason: 'formato' | 'fora_zona' };

export function resolveZone(postalCode: string, zones: DeliveryZone[]): ZoneResult {
  const pc = normalizePostalCode(postalCode);
  if (!POSTAL_CODE_RE.test(pc)) return { ok: false, reason: 'formato' };
  const prefix = parseInt(pc.slice(0, 4), 10);
  const zone = zones.find((z) => z.enabled && inRanges(prefix, z.ranges));
  return zone ? { ok: true, zone } : { ok: false, reason: 'fora_zona' };
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  c.setDate(c.getDate() + n);
  return c;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Primeira data em que a entrega pode ser pedida, respeitando antecedência, hora-limite, dias e feriados. */
export function earliestDeliveryDate(now: Date, s: Settings['delivery']): string | null {
  let d = addDays(now, s.leadTimeDays + (now.getHours() >= s.cutoffHour ? 1 : 0));
  const limit = addDays(now, s.maxDaysAhead);
  while (d <= limit) {
    if (isAllowedDay(d, s)) return toISODate(d);
    d = addDays(d, 1);
  }
  return null;
}

function isAllowedDay(d: Date, s: Settings['delivery']): boolean {
  return s.weekdays.includes(d.getDay()) && !s.blackoutDates.includes(toISODate(d));
}

export type DateCheck = { ok: true } | { ok: false; message: string };

export function checkDeliveryDate(iso: string, now: Date, s: Settings['delivery']): DateCheck {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return { ok: false, message: 'Escolha uma data de entrega.' };
  const d = parseISODate(iso);
  const earliest = earliestDeliveryDate(now, s);
  if (!earliest) return { ok: false, message: 'Não existem datas de entrega disponíveis de momento.' };
  if (d < parseISODate(earliest)) return { ok: false, message: 'Esta data é anterior à primeira data de entrega disponível.' };
  if (d > addDays(startOfDay(now), s.maxDaysAhead)) return { ok: false, message: `Só aceitamos pedidos de entrega até ${s.maxDaysAhead} dias de antecedência.` };
  if (!s.weekdays.includes(d.getDay())) return { ok: false, message: 'Não fazemos entregas neste dia da semana.' };
  if (s.blackoutDates.includes(iso)) return { ok: false, message: 'Esta data não está disponível para entregas.' };
  return { ok: true };
}
