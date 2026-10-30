import { useState } from 'react';
import { LuPackage, LuPercent, LuBuilding2, LuRepeat, LuClipboardList, LuSnowflake, LuShoppingBasket, LuArrowRight } from 'react-icons/lu';
import type { PrepOptionId } from '../types';
import { PREP_OPTIONS } from '../config/defaults';
import { cart, isWholesale, toast, useCurrentCustomer, useOrders, useProducts, useSettings } from '../state';
import { computeLine, enabledPreps, fromPrice } from '../lib/pricing';
import { formatEuro, round2 } from '../lib/format';
import { ProductArt } from '../components/ProductArt';
import { Notice, AvailabilityBadge } from '../components/ui';
import { canBuy } from '../components/ProductCard';
import { Link, navigate } from '../router';
import { reorder } from './Account';

interface Row { pack: number; prep: PrepOptionId; qty: number }

export function Wholesale() {
  const products = useProducts();
  const settings = useSettings();
  const customer = useCurrentCustomer();
  const wholesale = isWholesale(customer);
  const orders = useOrders().filter((o) => customer && o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = products.filter((p) => p.active && (!p.wholesaleOnly || wholesale));
  const [rows, setRows] = useState<Record<string, Row>>(() =>
    Object.fromEntries(list.map((p) => [p.id, { pack: p.packSizes[p.packSizes.length - 1], prep: enabledPreps(p)[0] ?? 'frito', qty: 0 }])),
  );
  const row = (id: string) => rows[id] ?? { pack: 10, prep: 'frito' as PrepOptionId, qty: 0 };
  const setRow = (id: string, patch: Partial<Row>) => setRows((r) => ({ ...r, [id]: { ...row(id), ...patch } }));

  const lines = list.map((p) => {
    const r = row(p.id);
    return { p, r, line: computeLine({ key: '', productId: p.id, packSize: r.pack, quantity: r.qty, prep: r.prep }, p, { wholesale }, settings) };
  });
  const chosen = lines.filter((l) => l.r.qty > 0);
  const total = round2(chosen.reduce((s, l) => s + l.line.total, 0));
  const invalid = chosen.filter((l) => l.line.error);

  function addAll() {
    if (!chosen.length || invalid.length) return;
    chosen.forEach(({ p, r }) => cart.add(p.id, r.pack, r.qty, r.prep));
    toast(`${chosen.length} ${chosen.length === 1 ? 'produto adicionado' : 'produtos adicionados'} ao carrinho.`);
    setRows((rs) => Object.fromEntries(Object.entries(rs).map(([k, v]) => [k, { ...v, qty: 0 }])));
    navigate('carrinho');
  }

  return (
    <>
      <section className="bg-brand-800 text-cream">
        <div className="wrap py-14 md:py-20 grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div>
            <p className="eyebrow !text-accent-400 mb-3">Encomendas por grosso</p>
            <h1 className="text-4xl md:text-5xl font-extrabold leading-[1.05] text-cream" data-page-title tabIndex={-1}>Salgados em quantidade para o seu negócio.</h1>
            <p className="mt-5 text-lg text-cream/80 max-w-[56ch]">Para cafés, restaurantes, lojas, eventos e revendedores. Packs grandes, preços por quantidade e uma encomenda rápida para quem compra sempre o mesmo.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#encomenda-rapida" onClick={(e) => { e.preventDefault(); document.getElementById('encomenda-rapida')?.scrollIntoView({ behavior: 'smooth' }); document.getElementById('encomenda-rapida-titulo')?.focus({ preventScroll: true }); }} className="btn btn-accent btn-lg">Encomenda rápida <LuArrowRight aria-hidden /></a>
              {!customer && <Link to="registar" className="btn btn-lg bg-transparent text-cream border-cream/40 hover:bg-brand-900">Criar conta de revenda</Link>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ['Packs até', `${Math.max(...products.flatMap((p) => p.packSizes))} un.`],
              ['Miniaturas', `100 un. desde ${formatEuro(Math.min(...products.filter((p) => p.active && p.packSizes.includes(100)).map((p) => fromPrice(p) * 100)))}`],
              ['Variedades', `${products.filter((p) => p.active).length} salgados`],
              ['Entrega grátis', `desde ${formatEuro(settings.delivery.freeThreshold)}`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-brand-900/50 border border-cream/10 p-5">
                <dt className="text-[0.85rem] text-cream/70">{k}</dt>
                <dd className="num font-display text-2xl font-extrabold mt-1">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="wrap py-14" aria-labelledby="vantagens">
        <h2 id="vantagens" className="text-3xl font-extrabold text-brand-900 mb-8">Porque encomendar por grosso</h2>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { i: <LuPackage />, t: 'Packs configuráveis', d: 'Escolha entre vários tamanhos de pack para cada produto.' },
            { i: <LuPercent />, t: 'Preços claros', d: 'Preço por unidade e por pack, sempre visível antes de encomendar.' },
            { i: <LuBuilding2 />, t: 'Contas de empresa', d: 'Registe a sua empresa com NIF. Depois de aprovada, vê os preços de revenda.' },
            { i: <LuRepeat />, t: 'Repetir encomendas', d: 'Volte a encomendar uma encomenda anterior com um clique.' },
            { i: <LuClipboardList />, t: 'Gestão simples', d: 'Consulte o estado e o histórico de todas as encomendas na sua conta.' },
            { i: <LuSnowflake />, t: 'Opção congelada', d: 'Tenha stock no congelador e frite apenas o que vai vender.' },
          ].map((b) => (
            <li key={b.t} className="panel p-6">
              <span className="text-3xl text-accent-600" aria-hidden>{b.i}</span>
              <h3 className="mt-3 font-bold text-lg">{b.t}</h3>
              <p className="mt-1 text-muted">{b.d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="encomenda-rapida" className="wrap pb-6 scroll-mt-28" aria-labelledby="encomenda-rapida-titulo">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
          <div>
            <h2 id="encomenda-rapida-titulo" tabIndex={-1} className="text-3xl font-extrabold text-brand-900 outline-none">Encomenda rápida</h2>
            <p className="text-muted mt-1">Indique a quantidade de packs de cada produto e adicione tudo ao carrinho de uma vez.</p>
          </div>
          {orders[0] && (
            <button type="button" className="btn btn-outline" onClick={() => reorder(orders[0], products)}><LuRepeat aria-hidden />Repetir a última encomenda ({orders[0].number})</button>
          )}
        </div>
        {wholesale ? <Notice tone="success" className="mb-5">Preços de revenda ativos para a sua conta.</Notice>
          : <Notice tone="info" className="mb-5">Preços de revenda disponíveis para contas de empresa aprovadas. {customer ? '' : <><Link to="entrar" className="font-semibold underline underline-offset-2">Inicie sessão</Link> ou <Link to="registar" className="font-semibold underline underline-offset-2">crie uma conta</Link>.</>}</Notice>}

        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_0.8fr_0.9fr] gap-4 px-5 py-3 border-b border-line text-[0.8rem] uppercase tracking-wider font-semibold text-muted" aria-hidden>
            <span>Produto</span><span>Pack</span><span>Preparação</span><span>Quantidade</span><span className="text-right">Subtotal</span>
          </div>
          <ul>
            {lines.map(({ p, r, line }) => {
              const buy = canBuy(p);
              const preps = enabledPreps(p);
              return (
                <li key={p.id} className={`grid grid-cols-2 md:grid-cols-[minmax(0,2.2fr)_1fr_1.1fr_0.8fr_0.9fr] gap-3 md:gap-4 items-center px-4 md:px-5 py-4 border-b border-line last:border-0 ${r.qty > 0 ? 'bg-brand-50/60' : ''}`}>
                  <div className="col-span-2 md:col-span-1 flex items-center gap-3 min-w-0">
                    <span className="w-14 h-14 rounded-xl overflow-hidden shrink-0" aria-hidden><ProductArt product={p} /></span>
                    <span className="min-w-0">
                      <Link to={`produto-${p.slug}`} className="font-bold hover:text-brand-700 block leading-tight">{p.name}</Link>
                      <span className="num text-[0.82rem] text-muted">{line.unitPrice ? `${formatEuro(line.unitPrice)}/un.` : '—'}</span>
                      {!buy && <span className="ml-2"><AvailabilityBadge value={p.availability} /></span>}
                    </span>
                  </div>
                  <div>
                    <label htmlFor={`qo-pack-${p.id}`} className="md:sr-only text-[0.8rem] font-semibold text-muted">Pack</label>
                    <select id={`qo-pack-${p.id}`} className="input !min-h-10 !py-1.5 text-[0.92rem]" value={r.pack} disabled={!buy} onChange={(e) => setRow(p.id, { pack: Number(e.target.value) })} aria-label={`Pack de ${p.name}`}>
                      {p.packSizes.map((s) => <option key={s} value={s}>{s} un.</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`qo-prep-${p.id}`} className="md:sr-only text-[0.8rem] font-semibold text-muted">Preparação</label>
                    <select id={`qo-prep-${p.id}`} className="input !min-h-10 !py-1.5 text-[0.92rem]" value={r.prep} disabled={!buy} onChange={(e) => setRow(p.id, { prep: e.target.value as PrepOptionId })} aria-label={`Preparação de ${p.name}`}>
                      {PREP_OPTIONS.filter((o) => preps.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`qo-qty-${p.id}`} className="md:sr-only text-[0.8rem] font-semibold text-muted">Packs</label>
                    <input id={`qo-qty-${p.id}`} type="number" min={0} max={999} inputMode="numeric" className="input num !min-h-10 !py-1.5" value={r.qty || ''} placeholder="0" disabled={!buy}
                      onChange={(e) => setRow(p.id, { qty: Math.max(0, Math.min(999, parseInt(e.target.value, 10) || 0)) })} aria-label={`Número de packs de ${p.name}`} />
                  </div>
                  <div className="text-right num">
                    <span className="md:hidden text-[0.8rem] font-semibold text-muted block">Subtotal</span>
                    <span className="font-bold">{r.qty > 0 ? formatEuro(line.total) : '—'}</span>
                    {r.qty > 0 && line.discount > 0 && <span className="block text-[0.75rem] text-ok font-semibold">{line.discountLabel}</span>}
                  </div>
                  {r.qty > 0 && line.error && <p className="col-span-full field-error !mt-0">{line.error}</p>}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 bg-cream border-t border-line">
            <p className="num">
              <span className="text-muted">{chosen.length} {chosen.length === 1 ? 'produto' : 'produtos'} · </span>
              <strong className="text-xl">{formatEuro(total)}</strong>
              <span className="text-muted text-[0.85rem]"> antes de portes</span>
            </p>
            <button type="button" className="btn btn-primary btn-lg" disabled={!chosen.length || invalid.length > 0} onClick={addAll}>
              <LuShoppingBasket aria-hidden />Adicionar tudo ao carrinho
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
