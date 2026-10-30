// Formatação para Portugal (pt-PT): euros e datas DD/MM/AAAA.

const eur = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });

export function formatEuro(value: number): string {
  // Intl em pt-PT produz "1,50 €". Garantimos espaço inquebrável consistente.
  return eur.format(round2(value)).replace(/\s/g, ' ');
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Converte "AAAA-MM-DD" em Date local (sem desvio de fuso). */
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** DD/MM/AAAA */
export function formatDate(input: string | Date): string {
  const d = typeof input === 'string' ? (input.length === 10 ? parseISODate(input) : new Date(input)) : input;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hh}:${mi}`;
}

const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const WEEKDAYS_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
export const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function formatDateLong(iso: string): string {
  const d = parseISODate(iso);
  return `${WEEKDAYS[d.getDay()]}, ${formatDate(d)}`;
}

export function weekdayName(i: number): string {
  return WEEKDAYS[i];
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('pt-PT')} ${n === 1 ? one : many}`;
}

export function uid(prefix = ''): string {
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${r}`;
}

/** Normaliza texto para pesquisa (sem acentos, minúsculas). */
export function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}
