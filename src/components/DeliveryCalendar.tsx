import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import type { Settings } from '../types';
import { checkDeliveryDate, earliestDeliveryDate } from '../lib/delivery';
import { MONTHS, WEEKDAYS_SHORT, formatDateLong, parseISODate, toISODate } from '../lib/format';

/**
 * Seletor de data de entrega. Os dias indisponíveis (antecedência mínima, dias sem entregas,
 * feriados configurados) ficam desativados e não podem ser escolhidos.
 */
export function DeliveryCalendar({ value, onChange, delivery, now = new Date(), labelledBy }: { value: string; onChange: (iso: string) => void; delivery: Settings['delivery']; now?: Date; labelledBy?: string }) {
  const earliest = earliestDeliveryDate(now, delivery);
  const start = value ? parseISODate(value) : earliest ? parseISODate(earliest) : now;
  const [month, setMonth] = useState(new Date(start.getFullYear(), start.getMonth(), 1));
  const gridRef = useRef<HTMLDivElement>(null);
  const firstMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth(), now.getDate() + delivery.maxDaysAhead);
  const lastMonth = new Date(last.getFullYear(), last.getMonth(), 1);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // semana começa à segunda-feira
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const cells: (string | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= count; d++) cells.push(toISODate(new Date(month.getFullYear(), month.getMonth(), d)));
    return cells;
  }, [month]);

  const order = [1, 2, 3, 4, 5, 6, 0];
  const canPrev = month > firstMonth;
  const canNext = month < lastMonth;

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, iso: string) => {
    const delta = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const d = parseISODate(iso);
    d.setDate(d.getDate() + delta);
    const target = toISODate(d);
    if (d.getMonth() !== month.getMonth()) setMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus());
  };

  return (
    <div className="panel p-4 max-w-sm" role="group" aria-labelledby={labelledBy}>
      <div className="flex items-center justify-between mb-3">
        <button type="button" className="icon-btn !w-10 !h-10" disabled={!canPrev} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior">
          <LuChevronLeft aria-hidden />
        </button>
        <p className="font-display font-bold capitalize" aria-live="polite">{MONTHS[month.getMonth()]} {month.getFullYear()}</p>
        <button type="button" className="icon-btn !w-10 !h-10" disabled={!canNext} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Mês seguinte">
          <LuChevronRight aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[0.75rem] font-semibold text-muted mb-1" aria-hidden>
        {order.map((d) => <span key={d}>{WEEKDAYS_SHORT[d]}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1" ref={gridRef}>
        {days.map((iso, i) => {
          if (!iso) return <span key={`e${i}`} />;
          const ok = checkDeliveryDate(iso, now, delivery).ok;
          const selected = iso === value;
          const day = parseISODate(iso).getDate();
          return (
            <button
              key={iso}
              type="button"
              data-date={iso}
              disabled={!ok}
              aria-pressed={selected}
              aria-label={`${formatDateLong(iso)}${ok ? '' : ', indisponível'}`}
              onClick={() => onChange(iso)}
              onKeyDown={(e) => onKey(e, iso)}
              className={`num h-10 rounded-lg text-[0.92rem] font-semibold transition-colors ${
                selected ? 'bg-brand-700 text-white hover:bg-brand-800' : ok ? 'bg-brand-50 text-brand-800 hover:bg-brand-100' : 'text-muted/45 line-through cursor-not-allowed'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[0.78rem] text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-50 border border-brand-200" aria-hidden />Disponível</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-brand-700" aria-hidden />Selecionado</span>
        <span className="inline-flex items-center gap-1.5"><span className="line-through" aria-hidden>12</span>Indisponível</span>
      </div>
    </div>
  );
}
