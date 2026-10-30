import { useState } from 'react';
import { LuPlus, LuPencil, LuChevronLeft, LuTrash2, LuUpload, LuPackage, LuSearch } from 'react-icons/lu';
import type { Availability, PriceTier, Product } from '../types';
import { CATEGORIES, PREP_OPTIONS } from '../config/defaults';
import { productsStore, toast, useProducts } from '../state';
import { formatEuro, normalize } from '../lib/format';
import { Link, navigate } from '../router';
import { AvailabilityBadge, ConfirmDialog, EmptyState, Field, Notice } from '../components/ui';
import { ProductArt } from '../components/ProductArt';
import { AdminHeader } from './AdminApp';

const ARTS = ['coxinha', 'empada', 'croquete', 'frango', 'milho', 'salsicha', 'mistos', 'rissol'];

function slugify(s: string) {
  return normalize(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function ProductsAdmin() {
  const products = useProducts();
  const [q, setQ] = useState('');
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const list = products.filter((p) => !q || normalize(`${p.name} ${p.category}`).includes(normalize(q)));
  const toggle = (p: Product) => {
    productsStore.set((ps) => ps.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)));
    toast(p.active ? `${p.name} desativado. Deixou de aparecer na loja.` : `${p.name} ativado.`);
  };
  return (
    <>
      <AdminHeader title="Produtos" actions={<Link to="admin-produto-novo" className="btn btn-primary"><LuPlus aria-hidden />Novo produto</Link>}>
        {products.filter((p) => p.active).length} ativos de {products.length}
      </AdminHeader>
      <div className="relative max-w-sm mb-4">
        <label htmlFor="ap-q" className="sr-only">Pesquisar produtos</label>
        <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
        <input id="ap-q" type="search" className="input !pl-9" placeholder="Pesquisar produtos" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? <EmptyState icon={<LuPackage />} title="Nenhum produto encontrado" /> : (
        <div className="panel table-wrap">
          <table className="table num">
            <caption className="sr-only">Produtos</caption>
            <thead><tr><th>Produto</th><th>Preço / unidade</th><th>Packs</th><th>Disponibilidade</th><th>Na loja</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className={p.active ? '' : 'opacity-60'}>
                  <td className="min-w-56">
                    <div className="flex items-center gap-3">
                      <span className="w-12 h-12 rounded-lg overflow-hidden shrink-0" aria-hidden><ProductArt product={p} /></span>
                      <span><Link to={`admin-produto-${p.id}`} className="font-semibold hover:underline">{p.name}</Link><span className="block text-[0.78rem] text-muted">{p.category}{p.wholesaleOnly ? ' · só revenda' : ''}</span></span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap">
                    {PREP_OPTIONS.filter((o) => p.prep[o.id]?.enabled).map((o) => (
                      <span key={o.id} className="block text-[0.88rem]"><span className="text-muted">{o.short}:</span> {formatEuro(p.prep[o.id].unitPrice)}</span>
                    ))}
                  </td>
                  <td className="whitespace-nowrap">{p.packSizes.join(', ')}</td>
                  <td><AvailabilityBadge value={p.availability} />{p.stock !== null && <span className="block text-[0.78rem] text-muted mt-1">{p.stock} un. em stock</span>}</td>
                  <td>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" role="switch" className="w-5 h-5 accent-brand-700" checked={p.active} onChange={() => toggle(p)} aria-label={`${p.name} visível na loja`} />
                      <span className="text-[0.85rem]">{p.active ? 'Ativo' : 'Inativo'}</span>
                    </label>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Link to={`admin-produto-${p.id}`} className="btn btn-ghost btn-sm" aria-label={`Editar ${p.name}`}><LuPencil aria-hidden />Editar</Link>
                    <button type="button" className="btn btn-ghost btn-sm text-danger" onClick={() => setToDelete(p)} aria-label={`Apagar ${p.name}`}><LuTrash2 aria-hidden /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title={`Apagar ${toDelete?.name ?? ''}?`} confirmLabel="Apagar produto"
        message="O produto é removido do catálogo. As encomendas antigas mantêm o registo. Se quiser apenas escondê-lo da loja, use «Desativar»."
        onConfirm={() => { if (toDelete) { productsStore.set((ps) => ps.filter((p) => p.id !== toDelete.id)); toast(`${toDelete.name} apagado.`); } }} />
    </>
  );
}

function blank(): Product {
  return {
    id: '', slug: '', name: '', category: CATEGORIES[0], shortDescription: '', description: '', ingredients: '', allergens: '',
    packSizes: [10, 25, 50, 100], minOrderUnits: 10,
    prep: { frito: { enabled: true, unitPrice: 1 }, congelado: { enabled: true, unitPrice: 0.9 }, pronto: { enabled: false, unitPrice: 0 } },
    tiers: [],
    availability: 'disponivel', stock: null, active: true, featured: false, resale: true, wholesaleOnly: false, art: 'mistos', sampleData: false,
  };
}

export function ProductEditor({ id }: { id: string }) {
  const products = useProducts();
  const existing = products.find((p) => p.id === id);
  const isNew = id === 'novo';
  const [p, setP] = useState<Product>(() => (existing ? structuredClone(existing) : blank()));
  const [packs, setPacks] = useState(p.packSizes.join(', '));
  const [stock, setStock] = useState(p.stock === null ? '' : String(p.stock));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!existing && !isNew) return <EmptyState icon={<LuPackage />} title="Produto não encontrado" action={<Link to="admin-produtos" className="btn btn-primary">Ver produtos</Link>} />;

  const set = <K extends keyof Product>(k: K, v: Product[K]) => setP((x) => ({ ...x, [k]: v }));
  const setTier = (i: number, patch: Partial<PriceTier>) => set('tiers', p.tiers.map((t, k) => (k === i ? { ...t, ...patch } : t)));

  function save() {
    const er: Record<string, string> = {};
    const slug = p.slug || slugify(p.name);
    const sizes = packs.split(/[,;\s]+/).map((x) => parseInt(x, 10)).filter((n) => Number.isInteger(n) && n > 0);
    if (p.name.trim().length < 2) er.name = 'Indique o nome do produto.';
    if (products.some((x) => x.slug === slug && x.id !== p.id)) er.slug = 'Já existe um produto com este endereço.';
    if (!sizes.length) er.packs = 'Indique pelo menos um tamanho de pack (números separados por vírgulas).';
    const active = PREP_OPTIONS.filter((o) => p.prep[o.id]?.enabled);
    if (!active.length) er.prep = 'Ative pelo menos uma preparação.';
    else if (active.some((o) => !(p.prep[o.id].unitPrice > 0))) er.prep = 'Indique um preço maior que zero para cada preparação ativa.';
    if (stock !== '' && !(parseInt(stock, 10) >= 0)) er.stock = 'O stock tem de ser um número inteiro (ou vazio para não controlar).';
    setErrors(er);
    if (Object.keys(er).length) { toast('Corrija os campos assinalados.', 'error'); return; }
    const final: Product = { ...p, slug, name: p.name.trim(), packSizes: [...new Set(sizes)].sort((a, b) => a - b), stock: stock === '' ? null : parseInt(stock, 10), id: p.id || `p-${slug}`, sampleData: false };
    productsStore.set((ps) => (isNew ? [...ps, final] : ps.map((x) => (x.id === final.id ? final : x))));
    toast(isNew ? 'Produto criado.' : 'Alterações guardadas.');
    navigate('admin-produtos');
  }

  function onImage(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Escolha um ficheiro de imagem (JPG, PNG ou WebP).', 'error');
    if (file.size > 1.5 * 1024 * 1024) return toast('A imagem tem de ter menos de 1,5 MB nesta demonstração.', 'error');
    const r = new FileReader();
    r.onload = () => set('imageUrl', String(r.result));
    r.readAsDataURL(file);
  }

  return (
    <>
      <Link to="admin-produtos" className="btn btn-ghost btn-sm mb-3 -ml-2"><LuChevronLeft aria-hidden />Produtos</Link>
      <AdminHeader title={isNew ? 'Novo produto' : `Editar ${existing!.name}`} actions={
        <>
          {!isNew && <button type="button" className="btn btn-outline text-danger" onClick={() => setConfirmDelete(true)}><LuTrash2 aria-hidden />Apagar</button>}
          <button type="button" className="btn btn-primary" onClick={save}>Guardar produto</button>
        </>
      } />
      {p.sampleData && <Notice tone="warn" className="mb-5">Este produto tem dados de exemplo. Ao guardar, deixa de ser assinalado como exemplo na loja.</Notice>}
      <form className="grid xl:grid-cols-[1fr_360px] gap-6 items-start" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
        <div className="grid gap-6 min-w-0">
          <section className="panel p-5 grid gap-5">
            <h2 className="font-bold text-lg">Informação</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Nome" required error={errors.name}>{(a) => <input {...a} className="input" value={p.name} onChange={(e) => set('name', e.target.value)} />}</Field>
              <Field label="Endereço (slug)" error={errors.slug} hint={`#produto-${p.slug || slugify(p.name) || '…'}`}>{(a) => <input {...a} className="input" value={p.slug} placeholder={slugify(p.name)} onChange={(e) => set('slug', slugify(e.target.value))} />}</Field>
            </div>
            <Field label="Categoria" required>{(a) => (
              <>
                <input {...a} className="input" list="categorias" value={p.category} onChange={(e) => set('category', e.target.value)} />
                <datalist id="categorias">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
              </>
            )}</Field>
            <Field label="Descrição curta" hint="Aparece nos cartões de produto.">{(a) => <input {...a} className="input" value={p.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} />}</Field>
            <Field label="Descrição completa">{(a) => <textarea {...a} className="input" rows={4} value={p.description} onChange={(e) => set('description', e.target.value)} />}</Field>
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Ingredientes" hint="Vazio = «a confirmar pelo negócio».">{(a) => <textarea {...a} className="input" rows={3} value={p.ingredients} onChange={(e) => set('ingredients', e.target.value)} />}</Field>
              <Field label="Alergénios" hint="Vazio = «a confirmar pelo negócio».">{(a) => <textarea {...a} className="input" rows={3} value={p.allergens} onChange={(e) => set('allergens', e.target.value)} />}</Field>
            </div>
          </section>

          <section className="panel p-5 grid gap-5">
            <h2 className="font-bold text-lg">Preparação e preços</h2>
            <div className="grid sm:grid-cols-3 gap-4">
              {PREP_OPTIONS.map((o) => o.id).map((k) => (
                <div key={k} className={`rounded-xl border-2 p-4 ${p.prep[k]?.enabled ? 'border-brand-200 bg-brand-50/50' : 'border-line'}`}>
                  <label className="flex items-center gap-2 font-semibold">
                    <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={!!p.prep[k]?.enabled} onChange={(e) => set('prep', { ...p.prep, [k]: { unitPrice: 0, ...p.prep[k], enabled: e.target.checked } })} />
                    {PREP_OPTIONS.find((o) => o.id === k)!.label}
                  </label>
                  <label htmlFor={`preco-${k}`} className="field-label mt-3">Preço por unidade (€)</label>
                  <input id={`preco-${k}`} type="number" step="0.01" min="0" className="input num" disabled={!p.prep[k]?.enabled} value={p.prep[k]?.unitPrice ?? 0}
                    onChange={(e) => set('prep', { ...p.prep, [k]: { enabled: true, ...p.prep[k], unitPrice: Number(e.target.value) } })} />
                </div>
              ))}
            </div>
            {errors.prep && <p className="field-error">{errors.prep}</p>}
            <div className="grid sm:grid-cols-2 gap-5">
              <Field label="Tamanhos de pack (unidades)" required error={errors.packs} hint="Separados por vírgulas, ex.: 10, 25, 50, 100">{(a) => <input {...a} className="input num" value={packs} onChange={(e) => setPacks(e.target.value)} />}</Field>
              <Field label="Mínimo por linha (unidades)" required>{(a) => <input {...a} type="number" min={1} className="input num" value={p.minOrderUnits} onChange={(e) => set('minOrderUnits', Math.max(1, parseInt(e.target.value, 10) || 1))} />}</Field>
            </div>
            <div>
              <p className="field-label">Descontos por quantidade</p>
              <div className="table-wrap">
                <table className="table">
                  <thead><tr><th>Nome</th><th>A partir de (un.)</th><th>Desconto (%)</th><th><span className="sr-only">Remover</span></th></tr></thead>
                  <tbody>
                    {p.tiers.map((t, i) => (
                      <tr key={i}>
                        <td><input className="input !min-h-10" aria-label={`Nome do escalão ${i + 1}`} value={t.label} onChange={(e) => setTier(i, { label: e.target.value })} /></td>
                        <td><input type="number" min={1} className="input num !min-h-10 w-28" aria-label={`Unidades mínimas do escalão ${i + 1}`} value={t.minUnits} onChange={(e) => setTier(i, { minUnits: parseInt(e.target.value, 10) || 0 })} /></td>
                        <td><input type="number" min={0} max={90} className="input num !min-h-10 w-24" aria-label={`Desconto do escalão ${i + 1}`} value={t.discountPct} onChange={(e) => setTier(i, { discountPct: Math.min(90, Number(e.target.value) || 0) })} /></td>
                        <td><button type="button" className="icon-btn text-danger" aria-label={`Remover escalão ${t.label}`} onClick={() => set('tiers', p.tiers.filter((_, k) => k !== i))}><LuTrash2 aria-hidden /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => set('tiers', [...p.tiers, { minUnits: 500, discountPct: 12, label: 'Novo escalão' }])}><LuPlus aria-hidden />Adicionar escalão</button>
            </div>
          </section>
        </div>

        <div className="grid gap-6">
          <section className="panel p-5 grid gap-4">
            <h2 className="font-bold text-lg">Imagem</h2>
            <div className="aspect-[4/3] rounded-xl overflow-hidden"><ProductArt product={{ ...p, name: p.name || 'Novo produto' }} /></div>
            <label className="btn btn-outline cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500">
              <LuUpload aria-hidden />Carregar fotografia
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => onImage(e.target.files?.[0])} />
            </label>
            {p.imageUrl && <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('imageUrl', undefined)}>Remover fotografia</button>}
            {!p.imageUrl && (
              <div>
                <label htmlFor="ilustracao" className="field-label">Ilustração de substituição</label>
                <select id="ilustracao" className="input" value={p.art} onChange={(e) => set('art', e.target.value)}>
                  {ARTS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
            )}
            <p className="field-hint !mt-0">Na demonstração, a imagem fica guardada no navegador. Em produção, use armazenamento de ficheiros (por exemplo, um bucket com CDN).</p>
          </section>
          <section className="panel p-5 grid gap-4">
            <h2 className="font-bold text-lg">Disponibilidade</h2>
            <div>
              <label htmlFor="disp" className="field-label">Estado</label>
              <select id="disp" className="input" value={p.availability} onChange={(e) => set('availability', e.target.value as Availability)}>
                <option value="disponivel">Disponível</option><option value="stock_limitado">Stock limitado</option><option value="esgotado">Esgotado</option><option value="brevemente">Brevemente</option>
              </select>
            </div>
            <Field label="Stock (unidades)" error={errors.stock} hint="Deixe vazio para não controlar stock.">{(a) => <input {...a} type="number" min={0} className="input num" value={stock} onChange={(e) => setStock(e.target.value)} />}</Field>
            {([['active', 'Visível na loja'], ['featured', 'Em destaque na página inicial'], ['resale', 'Ideal para revenda (aplica preço revenda)'], ['wholesaleOnly', 'Apenas para clientes de revenda']] as const).map(([k, label]) => (
              <label key={k} className="flex items-center gap-2.5">
                <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={p[k]} onChange={(e) => set(k, e.target.checked)} />{label}
              </label>
            ))}
          </section>
          <button type="submit" className="btn btn-primary btn-lg">Guardar produto</button>
        </div>
      </form>
      <ConfirmDialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={`Apagar ${p.name}?`} confirmLabel="Apagar produto"
        message="O produto é removido do catálogo. As encomendas antigas mantêm o registo." onConfirm={() => { productsStore.set((ps) => ps.filter((x) => x.id !== p.id)); toast('Produto apagado.'); navigate('admin-produtos'); }} />
    </>
  );
}
