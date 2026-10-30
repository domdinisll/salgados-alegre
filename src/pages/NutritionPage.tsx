import type { ReactNode } from 'react';
import { LuChevronRight, LuFlame, LuBeef, LuWheat, LuDroplet, LuSearchX, LuTriangleAlert, LuCheck } from 'react-icons/lu';
import type { Nutrition, Product } from '../types';
import { useProducts } from '../state';
import { Link } from '../router';
import { ProductArt } from '../components/ProductArt';
import { EmptyState, Notice } from '../components/ui';
import { ALLERGENS } from '../data/allergens';

// Doses de referência para um adulto médio (Regulamento (UE) 1169/2011, anexo XIII).
const RI = { energyKcal: 2000, fat: 70, saturates: 20, carbs: 260, sugars: 90, protein: 50, salt: 6 };

const n1 = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: v < 10 && v % 1 !== 0 ? 1 : 0 });
const per100 = (v: number, portion: number) => Math.round((v / portion) * 1000) / 10;
const pct = (v: number, ref: number) => Math.round((v / ref) * 100);

function Highlight({ icon, label, value, unit, ri }: { icon: ReactNode; label: string; value: number; unit: string; ri: number }) {
  const p = pct(value, ri);
  return (
    <div className="panel p-4 sm:p-5 min-w-0">
      <div className="flex items-center gap-2 text-muted text-[0.85rem] font-semibold">
        <span className="text-accent-600 text-lg" aria-hidden>{icon}</span>{label}
      </div>
      <p className="mt-2 num font-display text-3xl font-extrabold text-brand-900 leading-none">
        {n1(value)}<span className="text-lg font-bold text-muted ml-1">{unit}</span>
      </p>
      <div className="mt-3 h-1.5 rounded-full bg-cream-2 overflow-hidden" aria-hidden>
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, p)}%` }} />
      </div>
      <p className="mt-1.5 text-[0.78rem] text-muted num">{p}% da dose de referência</p>
    </div>
  );
}

function NutritionTable({ n }: { n: Nutrition }) {
  const salt = (n.sodiumMg / 1000) * 2.5;
  const kj = (kcal: number) => Math.round(kcal * 4.184);
  const rows: { label: string; sub?: boolean; p100: string; portion: string; ri?: number }[] = [
    { label: 'Energia', p100: `${kj(per100(n.energyKcal, n.portionGrams))} kJ / ${Math.round(per100(n.energyKcal, n.portionGrams))} kcal`, portion: `${kj(n.energyKcal)} kJ / ${n.energyKcal} kcal`, ri: pct(n.energyKcal, RI.energyKcal) },
    { label: 'Lípidos', p100: `${n1(per100(n.fat, n.portionGrams))} g`, portion: `${n1(n.fat)} g`, ri: pct(n.fat, RI.fat) },
    { label: 'dos quais saturados', sub: true, p100: `${n1(per100(n.saturates, n.portionGrams))} g`, portion: `${n1(n.saturates)} g`, ri: pct(n.saturates, RI.saturates) },
    { label: 'Hidratos de carbono', p100: `${n1(per100(n.carbs, n.portionGrams))} g`, portion: `${n1(n.carbs)} g`, ri: pct(n.carbs, RI.carbs) },
    { label: 'dos quais açúcares', sub: true, p100: n.sugars !== undefined ? `${n1(per100(n.sugars, n.portionGrams))} g` : '—', portion: n.sugars !== undefined ? `${n1(n.sugars)} g` : '—', ri: n.sugars !== undefined ? pct(n.sugars, RI.sugars) : undefined },
    ...(n.fibre !== undefined ? [{ label: 'Fibra', p100: `${n1(per100(n.fibre, n.portionGrams))} g`, portion: `${n1(n.fibre)} g` }] : []),
    { label: 'Proteínas', p100: `${n1(per100(n.protein, n.portionGrams))} g`, portion: `${n1(n.protein)} g`, ri: pct(n.protein, RI.protein) },
    { label: 'Sal', p100: `${n1(per100(salt, n.portionGrams))} g`, portion: `${n1(Math.round(salt * 100) / 100)} g`, ri: pct(salt, RI.salt) },
  ];
  return (
    <div className="panel table-wrap">
      <table className="table num">
        <caption className="sr-only">Declaração nutricional</caption>
        <thead>
          <tr><th>Declaração nutricional</th><th className="text-right">Por 100 g</th><th className="text-right">Por porção ({n.portionGrams} g)</th><th className="text-right">% DR*</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className={r.sub ? 'pl-8 text-muted' : 'font-semibold'}>{r.label}</td>
              <td className="text-right whitespace-nowrap">{r.p100}</td>
              <td className="text-right whitespace-nowrap">{r.portion}</td>
              <td className="text-right whitespace-nowrap">{r.ri !== undefined ? `${r.ri}%` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[0.8rem] text-muted border-t border-line">* Dose de referência para um adulto médio (8400 kJ / 2000 kcal).</p>
    </div>
  );
}

function AllergenGrid({ product }: { product: Product }) {
  const has = new Set(product.allergenIds ?? []);
  const contains = ALLERGENS.filter((a) => has.has(a.id));
  const others = ALLERGENS.filter((a) => !has.has(a.id));
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {contains.length > 0 && (
        <div>
          <p className="field-label">Contém</p>
          <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {contains.map((a) => (
              <li key={a.id} className="rounded-2xl bg-accent-50 border-2 border-accent-400 p-4 flex flex-col items-center text-center gap-2">
                <span className="w-14 h-14 rounded-full bg-accent-500 text-brand-900 text-3xl flex items-center justify-center" aria-hidden>{a.icon}</span>
                <span className="font-bold text-accent-800 inline-flex items-center gap-1"><LuTriangleAlert aria-hidden />{a.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="field-label">Não presentes na receita</p>
        <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {others.map((a) => (
            <li key={a.id} className="rounded-xl bg-paper border border-line p-3 flex flex-col items-center text-center gap-1.5 text-muted">
              <span className="text-xl opacity-70" aria-hidden>{a.icon}</span>
              <span className="text-[0.78rem] leading-tight">{a.label}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function NutritionPage({ slug }: { slug: string }) {
  const product = useProducts().find((p) => p.slug === slug && p.active);
  if (!product) {
    return (
      <div className="wrap py-16">
        <EmptyState icon={<LuSearchX />} title="Produto não encontrado" action={<Link to="produtos" className="btn btn-primary">Ver produtos</Link>} />
      </div>
    );
  }
  const n = product.nutrition;
  const ing = [...(product.ingredientsList ?? [])].sort((a, b) => b.qty - a.qty);
  const maxQty = Math.max(1, ...ing.map((i) => i.qty));
  const total = ing.reduce((s, i) => s + i.qty, 0);
  const hasInfo = !!n || ing.length > 0 || (product.allergenIds?.length ?? 0) > 0;

  return (
    <div className="wrap py-8 md:py-12 max-w-5xl">
      <nav aria-label="Caminho" className="mb-6 text-[0.9rem] text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link to="produtos" className="hover:text-brand-700">Produtos</Link></li>
          <li aria-hidden><LuChevronRight /></li>
          <li><Link to={`produto-${product.slug}`} className="hover:text-brand-700">{product.name}</Link></li>
          <li aria-hidden><LuChevronRight /></li>
          <li aria-current="page" className="text-ink font-medium">Informação nutricional</li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-center gap-5 mb-10">
        <span className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 shadow-[var(--shadow-card)]" aria-hidden><ProductArt product={product} /></span>
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">Informação nutricional e alergénios</p>
          <h1 className="text-3xl md:text-4xl font-extrabold text-brand-900 leading-tight" data-page-title tabIndex={-1}>{product.name}</h1>
          {n && <p className="mt-1 text-muted">Valores por unidade ({n.portionGrams} g) e por 100 g.</p>}
        </div>
      </header>

      {!hasInfo ? (
        <Notice tone="warn" title="Informação a confirmar">
          A informação nutricional e os alergénios deste produto ainda não foram publicados. Em caso de alergia ou intolerância, contacte-nos antes de encomendar.
        </Notice>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-12">
          <section aria-labelledby="alergenios">
            <h2 id="alergenios" className="text-2xl font-extrabold text-brand-900 mb-4">Alergénios</h2>
            <AllergenGrid product={product} />
            <p className="mt-4 text-[0.85rem] text-muted max-w-[70ch]">
              Com base na receita do produtor. Ingredientes compostos, como a margarina e o caldo, podem conter outros alergénios e o produto é preparado num espaço onde
              se manipulam outros alimentos. Em caso de alergia ou intolerância, contacte-nos antes de encomendar.
            </p>
          </section>

          {n && (
            <section aria-labelledby="nutricao">
              <h2 id="nutricao" className="text-2xl font-extrabold text-brand-900 mb-4">Valor nutricional por unidade</h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <Highlight icon={<LuFlame />} label="Energia" value={n.energyKcal} unit="kcal" ri={RI.energyKcal} />
                <Highlight icon={<LuBeef />} label="Proteínas" value={n.protein} unit="g" ri={RI.protein} />
                <Highlight icon={<LuWheat />} label="Hidratos de carbono" value={n.carbs} unit="g" ri={RI.carbs} />
                <Highlight icon={<LuDroplet />} label="Lípidos" value={n.fat} unit="g" ri={RI.fat} />
              </div>
              <NutritionTable n={n} />
            </section>
          )}

          {ing.length > 0 && (
            <section aria-labelledby="ingredientes">
              <h2 id="ingredientes" className="text-2xl font-extrabold text-brand-900 mb-1">Ingredientes</h2>
              <p className="text-muted mb-4">Por ordem decrescente de quantidade. Os alergénios estão destacados.</p>
              <ul className="panel divide-y divide-line">
                {ing.map((i) => {
                  const a = i.allergen ? ALLERGENS.find((x) => x.id === i.allergen) : undefined;
                  return (
                    <li key={i.name} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1.3fr)_1fr_auto] items-center gap-x-4 gap-y-1.5 px-4 py-3">
                      <span className={`min-w-0 ${a ? 'font-bold text-accent-800' : ''}`}>
                        {a && <span className="inline-flex align-[-2px] mr-1.5" aria-hidden>{a.icon}</span>}
                        {i.name}
                        {a && <span className="sr-only"> (alergénio: {a.label})</span>}
                      </span>
                      <span className="order-3 sm:order-none col-span-2 sm:col-span-1 h-2 rounded-full bg-cream-2 overflow-hidden" aria-hidden>
                        <span className={`block h-full rounded-full ${a ? 'bg-accent-500' : 'bg-brand-200'}`} style={{ width: `${(i.qty / maxQty) * 100}%` }} />
                      </span>
                      <span className="num text-right text-[0.92rem] text-muted whitespace-nowrap">{n1(i.qty)} {i.unit}</span>
                    </li>
                  );
                })}
                <li className="flex justify-between px-4 py-3 font-semibold">
                  <span>Peso total aproximado</span><span className="num">{n1(total)} g</span>
                </li>
              </ul>
            </section>
          )}

          <div className="flex flex-wrap gap-3">
            <Link to={`produto-${product.slug}`} className="btn btn-primary">Voltar ao produto</Link>
            <Link to="produtos" className="btn btn-outline">Ver todos os produtos</Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Resumo para a página do produto: ícones dos alergénios e ligação para a página completa. */
export function AllergenSummary({ product }: { product: Product }) {
  const ids = product.allergenIds ?? [];
  const hasInfo = !!product.nutrition || ids.length > 0;
  if (!hasInfo) return null;
  return (
    <div className="grid gap-4">
      {ids.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Alergénios presentes">
          {ALLERGENS.filter((a) => ids.includes(a.id)).map((a) => (
            <li key={a.id} className="badge !text-[0.9rem] !py-1.5 !px-3 bg-accent-50 text-accent-800 ring-1 ring-accent-400">
              <span className="text-base" aria-hidden>{a.icon}</span>Contém {a.label.toLowerCase()}
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-ok font-semibold"><LuCheck aria-hidden />Sem alergénios de declaração obrigatória na receita.</p>
      )}
      {product.nutrition && (
        <p className="num text-muted text-[0.95rem]">
          {product.nutrition.energyKcal} kcal · {n1(product.nutrition.protein)} g de proteínas por unidade ({product.nutrition.portionGrams} g)
        </p>
      )}
      <Link to={`nutricao-${product.slug}`} className="btn btn-outline w-fit">Ver informação nutricional e alergénios <LuChevronRight aria-hidden /></Link>
    </div>
  );
}
