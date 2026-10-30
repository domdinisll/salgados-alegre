import { useEffect, useState } from 'react';
import { LuShoppingBasket, LuChevronRight, LuPackage, LuSearchX, LuStore } from 'react-icons/lu';
import type { PrepOptionId } from '../types';
import { PREP_OPTIONS } from '../config/defaults';
import { cart, isWholesale, toast, useCurrentCustomer, useProducts, useSettings } from '../state';
import { enabledPreps, lineDiscount, priceFor } from '../lib/pricing';
import { formatEuro, round2 } from '../lib/format';
import { Link } from '../router';
import { ProductArt } from '../components/ProductArt';
import { ProductCard, canBuy } from '../components/ProductCard';
import { AllergenSummary } from './NutritionPage';
import { AvailabilityBadge, EmptyState, Notice, PrepIcon, QtyStepper, SampleTag, prepLabel } from '../components/ui';

export function ProductPage({ slug }: { slug: string }) {
  const products = useProducts();
  const settings = useSettings();
  const customer = useCurrentCustomer();
  const wholesale = isWholesale(customer);
  const product = products.find((p) => p.slug === slug && p.active);
  const preps = product ? enabledPreps(product) : [];
  const [prep, setPrep] = useState<PrepOptionId>(preps[0] ?? 'frito');
  const [pack, setPack] = useState(product?.packSizes[0] ?? 10);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    if (product) {
      setPrep(enabledPreps(product)[0] ?? 'frito');
      setPack(product.packSizes[Math.min(1, product.packSizes.length - 1)]);
      setQty(1);
    }
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product || (product.wholesaleOnly && !wholesale)) {
    return (
      <div className="wrap py-16">
        <EmptyState icon={<LuSearchX />} title="Produto não encontrado" action={<Link to="produtos" className="btn btn-primary">Ver todos os produtos</Link>}>
          Este produto não existe ou já não está disponível.
        </EmptyState>
      </div>
    );
  }

  const unit = priceFor(product, prep) ?? 0;
  const units = pack * qty;
  const gross = round2(unit * units);
  const disc = lineDiscount(product, units, { wholesale }, settings);
  const total = round2(gross - (gross * disc.pct) / 100);
  const buyable = canBuy(product) && preps.length > 0;
  const belowMin = units < product.minOrderUnits;
  const overStock = product.stock !== null && units > product.stock;
  const related = products.filter((p) => p.active && p.id !== product.id && !p.wholesaleOnly).slice(0, 3);
  const tiers = [{ minUnits: product.minOrderUnits, discountPct: 0, label: 'Preço padrão' }, ...[...product.tiers].sort((a, b) => a.minUnits - b.minUnits)];

  return (
    <div className="wrap py-8 md:py-12">
      <nav aria-label="Caminho" className="mb-6 text-[0.9rem] text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="" className="hover:text-brand-700">Início</Link></li>
          <li aria-hidden><LuChevronRight /></li>
          <li><Link to="produtos" className="hover:text-brand-700">Produtos</Link></li>
          <li aria-hidden><LuChevronRight /></li>
          <li aria-current="page" className="text-ink font-medium">{product.name}</li>
        </ol>
      </nav>

      <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        <div className="lg:sticky lg:top-28 min-w-0">
          <div className="card overflow-hidden aspect-[4/3]">
            <ProductArt product={product} />
          </div>
          {!product.imageUrl && <p className="mt-2 text-[0.8rem] text-muted">Imagem ilustrativa. Fotografia do produto a disponibilizar pelo negócio.</p>}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <AvailabilityBadge value={product.availability} />
            <span className="badge bg-cream-2 text-ink">{product.category}</span>
            {product.resale && <span className="badge bg-brand-800 text-cream"><LuStore aria-hidden />Ideal para revenda</span>}
          </div>
          <h1 className="mt-3 text-4xl md:text-5xl font-extrabold text-brand-900 leading-[1.05]" data-page-title tabIndex={-1}>{product.name}</h1>
          <p className="mt-4 text-lg text-muted max-w-[60ch]">{product.description}</p>

          <form className="mt-8 grid gap-6" onSubmit={(e) => {
            e.preventDefault();
            if (!buyable || belowMin || overStock) return;
            cart.add(product.id, pack, qty, prep);
            toast(`${qty} × pack de ${pack} ${product.name} (${prepLabel(prep).toLowerCase()}) adicionado ao carrinho.`);
          }}>
            <fieldset>
              <legend className="field-label !text-base mb-2">1. Como quer receber?</legend>
              <div className={`grid gap-3 ${preps.length > 1 ? 'sm:grid-cols-2' : ''}`}>
                {PREP_OPTIONS.filter((o) => preps.includes(o.id)).map((o) => {
                  const enabled = preps.includes(o.id);
                  const price = priceFor(product, o.id);
                  return (
                    <label key={o.id} className={`relative flex gap-3 rounded-2xl border-2 p-4 transition-colors ${!enabled ? 'opacity-55 cursor-not-allowed border-line bg-cream' : prep === o.id ? 'border-brand-600 bg-brand-50 cursor-pointer' : 'border-line bg-paper hover:border-brand-200 cursor-pointer'}`}>
                      <input type="radio" name="prep" value={o.id} checked={prep === o.id} disabled={!enabled} onChange={() => setPrep(o.id)} className="mt-1 w-5 h-5 accent-brand-700 shrink-0" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-bold">
                          <PrepIcon prep={o.id} className={o.id === 'frito' ? 'text-accent-600' : o.id.startsWith('congelado') ? 'text-info' : 'text-brand-600'} />
                          {o.label}
                        </span>
                        <span className="block text-[0.88rem] text-muted mt-0.5">{o.description}</span>
                        <span className="block num text-[0.9rem] font-semibold mt-1.5">
                          {enabled && price !== null ? `${formatEuro(price)} / unidade` : 'Não disponível para este produto'}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="field-label !text-base mb-2">2. Tamanho do pack</legend>
              <div className="flex flex-wrap gap-2">
                {product.packSizes.map((s) => (
                  <label key={s} className={`cursor-pointer rounded-xl border-2 px-4 py-2.5 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${pack === s ? 'border-brand-600 bg-brand-50' : 'border-line bg-paper hover:border-brand-200'}`}>
                    <input type="radio" name="pack" value={s} checked={pack === s} onChange={() => setPack(s)} className="sr-only" />
                    <span className="block font-bold num">{s} un.</span>
                    <span className="block text-[0.8rem] text-muted num">{formatEuro(unit * s)}</span>
                  </label>
                ))}
              </div>
              <p className="field-hint">Encomenda mínima: {product.minOrderUnits} unidades por produto.</p>
            </fieldset>

            <div>
              <p className="field-label !text-base mb-2" id="qty-label">3. Quantos packs?</p>
              <div className="flex flex-wrap items-center gap-4">
                <QtyStepper value={qty} onChange={setQty} label="Número de packs" />
                <span className="text-muted num">= {units.toLocaleString('pt-PT')} unidades</span>
              </div>
            </div>

            <div className="card p-5">
              <dl className="grid gap-1.5 num text-[0.95rem]">
                <div className="flex justify-between"><dt className="text-muted">{units} × {formatEuro(unit)}</dt><dd>{formatEuro(gross)}</dd></div>
                {disc.pct > 0 && <div className="flex justify-between text-ok font-semibold"><dt>{disc.label}</dt><dd>−{formatEuro(gross - total)}</dd></div>}
                <div className="flex justify-between items-end pt-2 mt-1 border-t border-line">
                  <dt className="font-bold">Total desta linha</dt>
                  <dd className="text-2xl font-extrabold text-brand-900">{formatEuro(total)}</dd>
                </div>
              </dl>
              {product.sampleData && <p className="mt-2"><SampleTag>Preços de exemplo para demonstração</SampleTag></p>}
              {belowMin && <p className="field-error">A quantidade mínima é de {product.minOrderUnits} unidades.</p>}
              {overStock && <p className="field-error">Só temos {product.stock} unidades disponíveis.</p>}
              <button type="submit" className="btn btn-primary btn-lg w-full mt-4" disabled={!buyable || belowMin || overStock}>
                <LuShoppingBasket aria-hidden />
                {buyable ? 'Adicionar ao carrinho' : product.availability === 'esgotado' ? 'Esgotado' : 'Ainda não disponível'}
              </button>
            </div>
          </form>

          <section className="mt-8" aria-labelledby="tabela-precos">
            <h2 id="tabela-precos" className="text-xl font-bold mb-3 flex items-center gap-2"><LuPackage className="text-accent-600" aria-hidden />Tabela de preços</h2>
            <div className="table-wrap panel">
              <table className="table num">
                <thead>
                  <tr><th>Quantidade</th>{PREP_OPTIONS.filter((o) => preps.includes(o.id)).map((o) => <th key={o.id}>{o.label}</th>)}</tr>
                </thead>
                <tbody>
                  <tr className="bg-brand-50/60">
                    <td className="font-semibold">Por unidade</td>
                    {preps.map((k) => <td key={k}>{formatEuro(priceFor(product, k) ?? 0)}</td>)}
                  </tr>
                  {product.packSizes.map((s) => (
                    <tr key={s}>
                      <td>Pack de {s} unidades</td>
                      {preps.map((k) => <td key={k}>{formatEuro((priceFor(product, k) ?? 0) * s)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(product.tiers.length > 0 || (product.resale && settings.pricing.wholesaleDiscountPct > 0)) && (
              <ul className="mt-3 grid gap-1 text-[0.9rem] text-ok font-semibold">
                {[...product.tiers].sort((x, y) => x.minUnits - y.minUnits).map((t) => <li key={t.label}>{t.label}: −{t.discountPct}% a partir de {t.minUnits} unidades</li>)}
                {product.resale && settings.pricing.wholesaleDiscountPct > 0 && <li>Preço revenda: −{settings.pricing.wholesaleDiscountPct}% para contas de revenda aprovadas</li>}
              </ul>
            )}
          </section>

          <section className="mt-8" aria-labelledby="ingredientes">
            <h2 id="ingredientes" className="text-xl font-bold mb-3">Ingredientes e alergénios</h2>
            {product.nutrition || product.allergenIds?.length ? (
              <div className="grid gap-4">
                {product.ingredients && <p className="text-muted text-[0.95rem]"><span className="font-semibold text-ink">Ingredientes: </span>{product.ingredients}</p>}
                <AllergenSummary product={product} />
              </div>
            ) : product.ingredients || product.allergens ? (
              <dl className="grid gap-2 text-[0.95rem]">
                <div><dt className="font-semibold">Ingredientes</dt><dd className="text-muted">{product.ingredients || 'A confirmar pelo negócio.'}</dd></div>
                <div><dt className="font-semibold">Alergénios</dt><dd className="text-muted">{product.allergens || 'A confirmar pelo negócio.'}</dd></div>
              </dl>
            ) : (
              <Notice tone="warn" title="Informação a confirmar">
                A lista de ingredientes e de alergénios deste produto ainda tem de ser confirmada pelo negócio. Em caso de alergia ou intolerância, contacte-nos antes de encomendar.
              </Notice>
            )}
          </section>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-16" aria-labelledby="relacionados">
          <h2 id="relacionados" className="text-2xl md:text-3xl font-extrabold text-brand-900 mb-6">Junte à sua encomenda</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
