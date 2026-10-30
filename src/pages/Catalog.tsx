import { useMemo, useState } from 'react';
import { LuSearch, LuSearchX } from 'react-icons/lu';
import { CATEGORIES } from '../config/defaults';
import { useCurrentCustomer, useProducts, isWholesale } from '../state';
import { ProductCard, canBuy } from '../components/ProductCard';
import { EmptyState, PageHeader, Notice } from '../components/ui';
import { fromPrice } from '../lib/pricing';
import { normalize } from '../lib/format';
import { Link } from '../router';

type Sort = 'destaque' | 'preco-asc' | 'preco-desc' | 'nome';

export function Catalog() {
  const products = useProducts();
  const customer = useCurrentCustomer();
  const wholesale = isWholesale(customer);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('todas');
  const [sort, setSort] = useState<Sort>('destaque');
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [onlyResale, setOnlyResale] = useState(false);

  const visible = products.filter((p) => p.active && (!p.wholesaleOnly || wholesale));
  const categories = Array.from(new Set([...CATEGORIES, ...visible.map((p) => p.category)]));

  const list = useMemo(() => {
    const nq = normalize(q);
    let r = visible.filter((p) =>
      (cat === 'todas' || p.category === cat) &&
      (!nq || normalize(`${p.name} ${p.shortDescription} ${p.category}`).includes(nq)) &&
      (!onlyAvailable || canBuy(p)) &&
      (!onlyResale || p.resale),
    );
    r = [...r].sort((a, b) => {
      if (sort === 'preco-asc') return fromPrice(a) - fromPrice(b);
      if (sort === 'preco-desc') return fromPrice(b) - fromPrice(a);
      if (sort === 'nome') return a.name.localeCompare(b.name, 'pt-PT');
      return categories.indexOf(a.category) - categories.indexOf(b.category);
    });
    return r;
  }, [visible, q, cat, sort, onlyAvailable, onlyResale]);

  const reset = () => { setQ(''); setCat('todas'); setOnlyAvailable(false); setOnlyResale(false); };
  const catCount = (c: string) => visible.filter((p) => c === 'todas' || p.category === c).length;

  return (
    <div className="wrap py-10 md:py-14">
      <PageHeader eyebrow="Catálogo" title="Produtos">
        Escolha o pack, a quantidade e se quer os salgados fritos ou congelados para fritar. Pode misturar preparações diferentes na mesma encomenda.
      </PageHeader>

      <Notice tone="info" className="mb-6">
        Salgados grandes em packs de 50, médios em packs de 25 e miniatura em packs de 100 unidades.
      </Notice>

      <div className="panel p-4 md:p-5 mb-8 grid gap-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <label htmlFor="pesquisa" className="sr-only">Pesquisar produtos</label>
            <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted text-lg" aria-hidden />
            <input id="pesquisa" type="search" className="input !pl-10" placeholder="Pesquisar, por exemplo: rissóis" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="ordenar" className="text-[0.9rem] font-semibold whitespace-nowrap">Ordenar por</label>
            <select id="ordenar" className="input md:w-56" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="destaque">Categoria</option>
              <option value="preco-asc">Preço: mais baixo primeiro</option>
              <option value="preco-desc">Preço: mais alto primeiro</option>
              <option value="nome">Nome (A–Z)</option>
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por categoria">
          {['todas', ...categories].map((c) => (
            <button key={c} type="button" aria-pressed={cat === c} onClick={() => setCat(c)}
              className={`rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold border-[1.5px] transition-colors ${cat === c ? 'bg-brand-700 border-brand-700 text-white' : 'bg-paper border-line text-ink/80 hover:border-brand-200'}`}>
              {c === 'todas' ? 'Todas' : c} <span className="num opacity-70">({catCount(c)})</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[0.92rem]">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} />
            Apenas disponíveis
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={onlyResale} onChange={(e) => setOnlyResale(e.target.checked)} />
            Ideais para revenda
          </label>
        </div>
      </div>

      <p className="text-[0.9rem] text-muted mb-4" aria-live="polite">{list.length} {list.length === 1 ? 'produto' : 'produtos'}</p>

      {list.length === 0 ? (
        catCount(cat) === 0 && !q ? (
          <EmptyState icon={<LuSearchX />} title="Ainda não há produtos nesta categoria" action={<button type="button" className="btn btn-primary" onClick={reset}>Ver todos os produtos</button>}>
            Estamos a preparar novidades. Entretanto, veja as outras categorias.
          </EmptyState>
        ) : (
          <EmptyState icon={<LuSearchX />} title="Nenhum produto encontrado" action={<button type="button" className="btn btn-primary" onClick={reset}>Limpar filtros</button>}>
            Não encontrámos produtos{q ? <> para «{q}»</> : ''} com estes filtros. Experimente outra pesquisa ou limpe os filtros.
          </EmptyState>
        )
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}

      <p className="mt-10 text-center text-muted">
        Compra regularmente as mesmas quantidades? <Link to="grosso" className="font-semibold text-brand-700 underline underline-offset-4">Use a encomenda rápida</Link>.
      </p>
    </div>
  );
}
