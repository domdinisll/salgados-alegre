import { useState } from 'react';
import { LuShoppingBasket, LuStore } from 'react-icons/lu';
import type { PrepOptionId, Product } from '../types';
import { PREP_OPTIONS } from '../config/defaults';
import { enabledPreps, fromPrice, priceFor } from '../lib/pricing';
import { formatEuro } from '../lib/format';
import { cart, toast } from '../state';
import { Link } from '../router';
import { ProductArt } from './ProductArt';
import { AvailabilityBadge, PrepIcon, QtyStepper, SampleTag, prepLabel } from './ui';

export function canBuy(p: Product) {
  return p.active && (p.availability === 'disponivel' || p.availability === 'stock_limitado');
}

export function PrepSegmented({ product, value, onChange, name }: { product: Product; value: PrepOptionId; onChange: (v: PrepOptionId) => void; name: string }) {
  const preps = enabledPreps(product);
  const options = PREP_OPTIONS.filter((o) => preps.includes(o.id));
  if (options.length <= 1) {
    const o = options[0];
    return (
      <p className="flex items-center justify-center gap-1.5 rounded-full bg-cream-2 p-1 min-h-[38px] text-[0.8rem] font-semibold text-brand-800" title={o?.description}>
        {o && <PrepIcon prep={o.id} />}{o ? o.label : 'Sem preparação disponível'}
      </p>
    );
  }
  return (
    <fieldset>
      <legend className="sr-only">Preparação</legend>
      <div className={`grid gap-1 rounded-full bg-cream-2 p-1 ${options.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {options.map((o) => {
          const id = `${name}-${o.id}`;
          return (
            <div key={o.id} className="relative">
              <input type="radio" id={id} name={name} value={o.id} checked={value === o.id} onChange={() => onChange(o.id)} className="peer sr-only" />
              <label
                htmlFor={id}
                className="flex items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[0.8rem] font-semibold text-center leading-tight cursor-pointer select-none transition-colors text-muted hover:text-ink
                  peer-checked:bg-paper peer-checked:text-brand-800 peer-checked:shadow-sm peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-accent-500"
                title={o.description}
              >
                <PrepIcon prep={o.id} />{o.short}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const preps = enabledPreps(product);
  const [prep, setPrep] = useState<PrepOptionId>(preps[0] ?? 'frito');
  const [pack, setPack] = useState(product.packSizes[Math.min(1, product.packSizes.length - 1)] ?? product.packSizes[0]);
  const [qty, setQty] = useState(1);
  const buyable = canBuy(product) && preps.length > 0;
  const unit = priceFor(product, prep) ?? fromPrice(product);
  const packPrice = unit * pack;
  const bestTier = [...product.tiers].sort((a, b) => b.discountPct - a.discountPct)[0];
  const idBase = `card-${product.id}`;

  return (
    <article className="card overflow-hidden flex flex-col group" aria-labelledby={`${idBase}-name`}>
      <Link to={`produto-${product.slug}`} className="relative block aspect-[4/3] overflow-hidden" tabIndex={-1} aria-hidden>
        <ProductArt product={product} className="transition-transform duration-300 group-hover:scale-[1.03]" />
        <span className="absolute top-3 left-3"><AvailabilityBadge value={product.availability} /></span>
        {product.resale && (
          <span className="absolute top-3 right-3 badge bg-brand-800 text-cream"><LuStore aria-hidden />Ideal para revenda</span>
        )}
      </Link>
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h3 id={`${idBase}-name`} className="text-xl font-bold leading-tight">
            <Link to={`produto-${product.slug}`} className="hover:text-brand-700">{product.name}</Link>
          </h3>
          <p className="mt-1.5 text-[0.92rem] text-muted line-clamp-2">{product.shortDescription}</p>
        </div>
        <div className="flex items-end justify-between gap-2">
          <p className="num">
            <span className="text-2xl font-extrabold text-brand-900">{formatEuro(packPrice)}</span>
            <span className="block text-[0.82rem] text-muted">Pack de {pack} · {formatEuro(unit)}/unidade</span>
          </p>
          {product.sampleData && <SampleTag />}
        </div>
        {bestTier && (
          <p className="text-[0.82rem] text-ok font-semibold">Até −{bestTier.discountPct}% a partir de {bestTier.minUnits} unidades</p>
        )}
        <div className="mt-auto grid gap-2.5 pt-1">
          <PrepSegmented product={product} value={prep} onChange={setPrep} name={`${idBase}-prep`} />
          <div className="flex flex-wrap gap-2">
            <label htmlFor={`${idBase}-pack`} className="sr-only">Tamanho do pack</label>
            <select id={`${idBase}-pack`} className="input !min-h-11 !py-1.5 !rounded-full flex-1 min-w-[8.5rem] text-[0.92rem]" value={pack} onChange={(e) => setPack(Number(e.target.value))}>
              {product.packSizes.map((s) => <option key={s} value={s}>Pack de {s}</option>)}
            </select>
            <QtyStepper value={qty} onChange={setQty} label={`Número de packs de ${product.name}`} />
          </div>
          <button
            type="button"
            className="btn btn-primary w-full"
            disabled={!buyable}
            onClick={() => {
              cart.add(product.id, pack, qty, prep);
              toast(`${qty} × pack de ${pack} ${product.name} (${prepLabel(prep).toLowerCase()}) adicionado ao carrinho.`);
              setQty(1);
            }}
          >
            <LuShoppingBasket aria-hidden />
            {buyable ? 'Adicionar ao carrinho' : product.availability === 'esgotado' ? 'Esgotado' : 'Indisponível'}
            <span className="sr-only"> {product.name}</span>
          </button>
          <Link to={`produto-${product.slug}`} className="text-center text-[0.9rem] font-semibold text-brand-700 hover:underline underline-offset-4 py-1">
            Ver produto<span className="sr-only">: {product.name}</span>
          </Link>
        </div>
      </div>
    </article>
  );
}
