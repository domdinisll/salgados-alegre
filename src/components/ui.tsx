import { useEffect, useId, useRef, type ReactNode } from 'react';
import { LuCircleAlert, LuCircleCheck, LuInfo, LuMinus, LuPlus, LuTriangleAlert, LuX, LuClock, LuSnowflake, LuFlame } from 'react-icons/lu';
import type { Availability, OrderStatus, PaymentStatus, PrepOptionId } from '../types';
import { ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, PREP_OPTIONS } from '../config/defaults';

export function Logo({ light = false, className = '' }: { light?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg viewBox="0 0 40 40" className="w-9 h-9 shrink-0" aria-hidden="true">
        <circle cx="20" cy="20" r="20" fill={light ? '#fbf7ef' : '#1d5034'} />
        <path d="M20 7 C23 11 30 17 30 24 C30 30 25.5 33 20 33 C14.5 33 10 30 10 24 C10 17 17 11 20 7 Z" fill="#e99a2c" />
        <path d="M15.5 25.5 Q20 29.5 24.5 25.5" stroke={light ? '#1d5034' : '#102e1e'} strokeWidth="2.2" fill="none" strokeLinecap="round" />
        <circle cx="16.5" cy="20.5" r="1.4" fill={light ? '#1d5034' : '#102e1e'} />
        <circle cx="23.5" cy="20.5" r="1.4" fill={light ? '#1d5034' : '#102e1e'} />
      </svg>
      <span className={`font-display leading-none ${light ? 'text-cream' : 'text-brand-800'}`}>
        <span className="block text-[1.32rem] font-extrabold tracking-tight">Salgados</span>
        <span className={`block text-[0.8rem] font-semibold tracking-[0.22em] uppercase ${light ? 'text-accent-400' : 'text-accent-600'}`}>Alegre</span>
      </span>
    </span>
  );
}

const AVAIL: Record<Availability, { label: string; cls: string; icon: ReactNode }> = {
  disponivel: { label: 'Disponível', cls: 'bg-ok-bg text-ok', icon: <LuCircleCheck aria-hidden /> },
  stock_limitado: { label: 'Stock limitado', cls: 'bg-warn-bg text-warn', icon: <LuTriangleAlert aria-hidden /> },
  esgotado: { label: 'Esgotado', cls: 'bg-danger-bg text-danger', icon: <LuX aria-hidden /> },
  brevemente: { label: 'Brevemente', cls: 'bg-info-bg text-info', icon: <LuClock aria-hidden /> },
};

export function AvailabilityBadge({ value }: { value: Availability }) {
  const a = AVAIL[value];
  return <span className={`badge ${a.cls}`}>{a.icon}{a.label}</span>;
}

export function availabilityLabel(v: Availability) {
  return AVAIL[v].label;
}

const STATUS_CLS: Record<OrderStatus, string> = {
  recebida: 'bg-info-bg text-info',
  em_preparacao: 'bg-warn-bg text-warn',
  pronta_envio: 'bg-accent-50 text-accent-800 ring-1 ring-accent-100',
  em_distribuicao: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
  entregue: 'bg-ok-bg text-ok',
  cancelada: 'bg-danger-bg text-danger',
};
const STATUS_DOT: Record<OrderStatus, string> = {
  recebida: '○', em_preparacao: '◔', pronta_envio: '◑', em_distribuicao: '◕', entregue: '●', cancelada: '✕',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`badge ${STATUS_CLS[status]}`}>
      <span aria-hidden>{STATUS_DOT[status]}</span>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function PaymentBadge({ status, simulated }: { status: PaymentStatus; simulated: boolean }) {
  const cls = status === 'pago' ? 'bg-ok-bg text-ok' : status === 'falhado' ? 'bg-danger-bg text-danger' : status === 'reembolsado' ? 'bg-info-bg text-info' : 'bg-cream-2 text-ink';
  return (
    <span className="inline-flex flex-wrap gap-1">
      <span className={`badge ${cls}`}>{PAYMENT_STATUS_LABELS[status]}</span>
      {simulated && <span className="badge bg-accent-50 text-accent-800 ring-1 ring-accent-100">Simulação</span>}
    </span>
  );
}

export function prepLabel(prep: PrepOptionId, short = false): string {
  const def = PREP_OPTIONS.find((p) => p.id === prep);
  return def ? (short ? def.short : def.label) : prep;
}

export function PrepIcon({ prep, className = '' }: { prep: PrepOptionId; className?: string }) {
  if (prep === 'frito') return <LuFlame aria-hidden className={className} />;
  if (prep === 'congelado') return <LuSnowflake aria-hidden className={className} />;
  return <LuCircleCheck aria-hidden className={className} />;
}

const PREP_BADGE: Record<PrepOptionId, string> = {
  frito: 'bg-accent-50 text-accent-800 ring-1 ring-accent-100',
  congelado: 'bg-info-bg text-info',
  pronto: 'bg-brand-50 text-brand-700 ring-1 ring-brand-100',
};

export function PrepBadge({ prep }: { prep: PrepOptionId }) {
  return <span className={`badge ${PREP_BADGE[prep] ?? 'bg-cream-2 text-ink'}`}><PrepIcon prep={prep} />{prepLabel(prep)}</span>;
}

export function QtyStepper({ value, onChange, min = 1, max = 999, label, size = 'md' }: { value: number; onChange: (n: number) => void; min?: number; max?: number; label: string; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-9' : 'h-11';
  const w = size === 'sm' ? 'w-9' : 'w-11';
  return (
    <div className={`inline-flex items-center rounded-full border-[1.5px] border-[#d6cdbb] bg-paper ${h}`} role="group" aria-label={label}>
      <button type="button" className={`${w} ${h} inline-flex items-center justify-center rounded-full text-brand-800 hover:bg-brand-50 disabled:opacity-40`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Diminuir ${label.toLowerCase()}`}>
        <LuMinus aria-hidden />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="num w-12 text-center bg-transparent font-semibold focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        value={value}
        min={min}
        max={max}
        aria-label={label}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      <button type="button" className={`${w} ${h} inline-flex items-center justify-center rounded-full text-brand-800 hover:bg-brand-50 disabled:opacity-40`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`Aumentar ${label.toLowerCase()}`}>
        <LuPlus aria-hidden />
      </button>
    </div>
  );
}

export function Field({ label, error, hint, children, id, required, className = '' }: { label: string; error?: string; hint?: string; children: (props: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string; required?: boolean }) => ReactNode; id?: string; required?: boolean; className?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const describedBy = [error ? `${fid}-err` : '', hint ? `${fid}-hint` : ''].filter(Boolean).join(' ') || undefined;
  return (
    <div className={className}>
      <label htmlFor={fid} className="field-label">
        {label}
        {required && <span className="text-danger" aria-hidden> *</span>}
        {!required && <span className="font-normal text-muted"> (opcional)</span>}
      </label>
      {children({ id: fid, 'aria-invalid': !!error, 'aria-describedby': describedBy, required })}
      {hint && !error && <p id={`${fid}-hint`} className="field-hint">{hint}</p>}
      {error && (
        <p id={`${fid}-err`} className="field-error">
          <LuCircleAlert className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', title, children, className = '' }: { tone?: 'info' | 'warn' | 'error' | 'success'; title?: string; children?: ReactNode; className?: string }) {
  const map = {
    info: { cls: 'bg-info-bg text-info border-info/20', icon: <LuInfo aria-hidden /> },
    warn: { cls: 'bg-warn-bg text-warn border-warn/20', icon: <LuTriangleAlert aria-hidden /> },
    error: { cls: 'bg-danger-bg text-danger border-danger/20', icon: <LuCircleAlert aria-hidden /> },
    success: { cls: 'bg-ok-bg text-ok border-ok/20', icon: <LuCircleCheck aria-hidden /> },
  }[tone];
  return (
    <div className={`flex gap-3 rounded-xl border px-4 py-3 text-[0.92rem] ${map.cls} ${className}`} role={tone === 'error' ? 'alert' : undefined}>
      <span className="mt-0.5 text-lg shrink-0">{map.icon}</span>
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-ink/80' : 'text-ink/85'}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-center py-14 px-6 panel">
      <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center text-3xl" aria-hidden>{icon}</div>
      <h2 className="text-xl font-bold">{title}</h2>
      {children && <div className="mt-2 text-muted max-w-md mx-auto">{children}</div>}
      {action && <div className="mt-6 flex justify-center gap-3 flex-wrap">{action}</div>}
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Diálogo acessível: foco preso, Escape fecha, foco devolvido ao elemento de origem. */
export function Modal({ open, onClose, title, children, footer, side = false, labelId }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; side?: boolean; labelId?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const titleId = labelId ?? `${autoId}-t`;
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const el = ref.current;
    const first = el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (!items.length) return;
        const a = items[0], b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-brand-900/45 anim-fade" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={side
          ? 'absolute right-0 top-0 bottom-0 w-full max-w-[440px] bg-cream shadow-2xl flex flex-col anim-drawer pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]'
          : 'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-32px)] max-w-lg max-h-[calc(100%-32px)] overflow-auto bg-paper rounded-2xl shadow-2xl anim-fade'}
      >
        <div className={`flex items-center justify-between gap-4 px-5 py-4 ${side ? 'border-b border-line bg-paper' : ''}`}>
          <h2 id={titleId} className="text-lg font-bold">{title}</h2>
          <button type="button" className="icon-btn -mr-2" onClick={onClose} aria-label="Fechar">
            <LuX className="text-xl" aria-hidden />
          </button>
        </div>
        <div className={side ? 'flex-1 overflow-y-auto px-5 py-4' : 'px-5 pb-5'}>{children}</div>
        {footer && <div className={`px-5 py-4 ${side ? 'border-t border-line bg-paper' : 'pt-0'}`}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel, onConfirm, onClose, danger = true }: { open: boolean; title: string; message: ReactNode; confirmLabel: string; onConfirm: () => void; onClose: () => void; danger?: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex justify-end gap-3 flex-wrap">
          <button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button>
          <button type="button" className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</button>
        </div>
      }
    >
      <div className="text-muted">{message}</div>
    </Modal>
  );
}

export function SampleTag({ children = 'Preço de exemplo' }: { children?: ReactNode }) {
  return <span className="inline-flex items-center rounded-md border border-dashed border-accent-600/60 bg-accent-50 px-1.5 py-0.5 text-[0.7rem] font-semibold text-accent-800">{children}</span>;
}

export function PageHeader({ eyebrow, title, children, actions }: { eyebrow?: string; title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-3xl md:text-[2.6rem] font-extrabold leading-[1.08] text-brand-900" tabIndex={-1} data-page-title>{title}</h1>
        {children && <div className="mt-3 text-muted text-[1.05rem]">{children}</div>}
      </div>
      {actions && <div className="flex gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}
