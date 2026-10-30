import type { ReactNode } from 'react';
import { LuTrash2, LuTruck, LuCircleAlert } from 'react-icons/lu';
import type { PrepOptionId } from '../types';
import { PREP_OPTIONS } from '../config/defaults';
import { cart, useSettings } from '../state';
import { enabledPreps, type LineResult, type TotalsResult } from '../lib/pricing';
import { formatEuro } from '../lib/format';
import { Link } from '../router';
import { ProductArt } from './ProductArt';
import { QtyStepper } from './ui';

export function CartLine({ line, compact = false, onNavigate }: { line: LineResult; compact?: boolean; onNavigate?: () => void }) {
  const { item, product } = line;
  const id = item.key.replace(/[^a-z0-9]/gi, '');
  if (!product) {
    return (
      <div className="panel p-4 flex justify-between gap-3">
        <p className="text-danger">Produto indisponível.</p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => cart.remove(item.key)}>Remover</button>
      </div>
    );
  }
  const preps = enabledPreps(product);
  return (
    <article className={`panel p-3 sm:p-4 ${line.error ? 'border-danger/50' : ''}`} aria-label={product.name}>
      <div className="flex gap-3 sm:gap-4">
        <Link to={`produto-${product.slug}`} onClick={onNavigate} className={`shrink-0 overflow-hidden rounded-xl ${compact ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28'}`} tabIndex={-1} aria-hidden>
          <ProductArt product={product} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-bold leading-tight text-[1.05rem]">
              <Link to={`produto-${product.slug}`} onClick={onNavigate} className="hover:text-brand-700">{product.name}</Link>
            </h3>
            <button type="button" className="icon-btn !w-9 !h-9 -mt-1 -mr-1 text-muted hover:text-danger" onClick={() => cart.remove(item.key)} aria-label={`Remover ${product.name} do carrinho`}>
              <LuTrash2 aria-hidden />
            </button>
          </div>
          <p className="num text-[0.85rem] text-muted mt-0.5">
            {formatEuro(line.unitPrice)} / unidade · {line.units} unidades
          </p>
          <div className={`mt-3 grid gap-2 ${compact ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>
            <div>
              <label htmlFor={`prep-${id}`} className="sr-only">Preparação de {product.name}</label>
              <select id={`prep-${id}`} className="input !min-h-10 !py-1.5 text-[0.92rem]" value={item.prep} onChange={(e) => cart.change(item.key, { prep: e.target.value as PrepOptionId })}>
                {PREP_OPTIONS.filter((p) => preps.includes(p.id) || p.id === item.prep).map((p) => (
                  <option key={p.id} value={p.id} disabled={!preps.includes(p.id)}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`pack-${id}`} className="sr-only">Tamanho do pack de {product.name}</label>
              <select id={`pack-${id}`} className="input !min-h-10 !py-1.5 text-[0.92rem]" value={item.packSize} onChange={(e) => cart.change(item.key, { packSize: Number(e.target.value) })}>
                {product.packSizes.map((s) => <option key={s} value={s}>Pack de {s} unidades</option>)}
              </select>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
            <QtyStepper size="sm" value={item.quantity} onChange={(n) => cart.setQuantity(item.key, n)} label={`Número de packs de ${product.name}`} />
            <div className="text-right num">
              {line.discount > 0 && <p className="text-[0.8rem] text-muted line-through">{formatEuro(line.gross)}</p>}
              <p className="font-bold text-[1.05rem]">{formatEuro(line.total)}</p>
              {line.discount > 0 && <p className="text-[0.78rem] font-semibold text-ok">{line.discountLabel}</p>}
            </div>
          </div>
          {line.error && (
            <p className="field-error" role="alert"><LuCircleAlert className="mt-0.5 shrink-0" aria-hidden />{line.error}</p>
          )}
        </div>
      </div>
    </article>
  );
}

export function FreeDeliveryProgress({ t }: { t: TotalsResult }) {
  const threshold = useSettings().delivery.freeThreshold;
  if (t.lines.length === 0 || threshold <= 0) return null;
  const pct = Math.min(100, (t.discountedSubtotal / threshold) * 100);
  return (
    <div className="rounded-xl bg-brand-50 border border-brand-100 px-4 py-3">
      <p className="flex items-start gap-2 text-[0.92rem] text-brand-800 font-medium">
        <LuTruck className="mt-0.5 shrink-0 text-lg" aria-hidden />
        {t.freeDelivery ? (
          <span>A sua encomenda tem <strong>entrega gratuita</strong>.</span>
        ) : (
          <span>Adicione mais <strong className="num">{formatEuro(t.remainingForFreeDelivery)}</strong> à sua encomenda para beneficiar de entrega gratuita.</span>
        )}
      </p>
      <div className="mt-2 h-2 rounded-full bg-paper overflow-hidden" role="progressbar" aria-label="Progresso para entrega gratuita" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className="h-full rounded-full bg-brand-600 transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function TotalsTable({ t, showDeliveryNote = true }: { t: TotalsResult; showDeliveryNote?: boolean }) {
  const row = (label: ReactNode, value: ReactNode, cls = '') => (
    <div className={`flex justify-between gap-4 py-1.5 ${cls}`}>
      <dt>{label}</dt>
      <dd className="num text-right">{value}</dd>
    </div>
  );
  return (
    <dl className="text-[0.95rem]">
      {row('Subtotal dos produtos', formatEuro(t.merchandiseSubtotal))}
      {t.productDiscounts > 0 && row('Descontos de quantidade', `−${formatEuro(t.productDiscounts)}`, 'text-ok font-medium')}
      {t.codeDiscount > 0 && row(<>Código <span className="font-semibold">{t.code?.code}</span></>, `−${formatEuro(t.codeDiscount)}`, 'text-ok font-medium')}
      {row(
        <span>
          Taxa de entrega
          {t.zone && <span className="block text-[0.8rem] text-muted">{t.zone.name}</span>}
          {!t.zone && !t.freeDelivery && showDeliveryNote && <span className="block text-[0.8rem] text-muted">Estimativa. O valor final depende do código postal.</span>}
        </span>,
        t.freeDelivery ? <span className="font-semibold text-ok">Grátis</span> : formatEuro(t.deliveryFee),
      )}
      <div className="flex justify-between gap-4 pt-3 mt-2 border-t border-line">
        <dt className="font-bold text-lg">Total a pagar</dt>
        <dd className="num font-extrabold text-xl text-brand-900">{formatEuro(t.total)}</dd>
      </div>
      <p className="text-[0.78rem] text-muted mt-1">Preços com IVA incluído, à taxa em vigor (a confirmar pelo negócio).</p>
    </dl>
  );
}
