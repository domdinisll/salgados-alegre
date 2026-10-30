import { LuPlus, LuTrash2 } from 'react-icons/lu';
import type { AllergenId, IngredientLine, Nutrition, Product } from '../types';
import { ALLERGENS } from '../data/allergens';

const EMPTY: Nutrition = { portionGrams: 100, energyKcal: 0, fat: 0, saturates: 0, carbs: 0, sugars: undefined, fibre: undefined, protein: 0, sodiumMg: 0 };

const FIELDS: { key: keyof Nutrition; label: string; unit: string; optional?: boolean }[] = [
  { key: 'portionGrams', label: 'Peso da unidade / porção', unit: 'g' },
  { key: 'energyKcal', label: 'Energia', unit: 'kcal' },
  { key: 'fat', label: 'Lípidos', unit: 'g' },
  { key: 'saturates', label: 'dos quais saturados', unit: 'g' },
  { key: 'carbs', label: 'Hidratos de carbono', unit: 'g' },
  { key: 'sugars', label: 'dos quais açúcares', unit: 'g', optional: true },
  { key: 'fibre', label: 'Fibra', unit: 'g', optional: true },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'sodiumMg', label: 'Sódio', unit: 'mg' },
];

/** Editor de alergénios, informação nutricional (por porção) e lista de ingredientes. */
export function NutritionEditor({ p, set }: { p: Product; set: <K extends keyof Product>(k: K, v: Product[K]) => void }) {
  const allergens = new Set(p.allergenIds ?? []);
  const toggle = (id: AllergenId) => {
    const next = new Set(allergens);
    if (next.has(id)) next.delete(id); else next.add(id);
    set('allergenIds', ALLERGENS.map((a) => a.id).filter((x) => next.has(x)));
  };
  const n = p.nutrition;
  const setN = (k: keyof Nutrition, raw: string) => {
    const v = raw === '' ? undefined : Math.max(0, Number(raw));
    set('nutrition', { ...(n ?? EMPTY), [k]: v ?? (FIELDS.find((f) => f.key === k)?.optional ? undefined : 0) });
  };
  const ing = p.ingredientsList ?? [];
  const setIng = (i: number, patch: Partial<IngredientLine>) => set('ingredientsList', ing.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  return (
    <section className="panel p-5 grid grid-cols-[minmax(0,1fr)] gap-6 min-w-0" aria-labelledby="ed-nutricao">
      <div>
        <h2 id="ed-nutricao" className="font-bold text-lg">Alergénios e informação nutricional</h2>
        <p className="text-[0.88rem] text-muted mt-1">Aparece na página «Informação nutricional» do produto. O sal e os valores por 100 g são calculados automaticamente.</p>
      </div>

      <fieldset>
        <legend className="field-label">Alergénios presentes</legend>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => {
            const on = allergens.has(a.id);
            return (
              <label key={a.id} className={`inline-flex items-center gap-2 rounded-full border-2 px-3 py-1.5 text-[0.88rem] font-semibold cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${on ? 'border-accent-500 bg-accent-50 text-accent-800' : 'border-line text-muted hover:border-brand-200'}`}>
                <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(a.id)} />
                <span className="text-base" aria-hidden>{a.icon}</span>{a.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className="inline-flex items-center gap-2.5 font-semibold">
          <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={!!n} onChange={(e) => set('nutrition', e.target.checked ? { ...EMPTY } : undefined)} />
          Publicar informação nutricional
        </label>
        {n && (
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FIELDS.map((f) => (
              <div key={f.key}>
                <label htmlFor={`nut-${f.key}`} className="field-label">{f.label} ({f.unit}){f.optional && <span className="font-normal text-muted"> (opcional)</span>}</label>
                <input id={`nut-${f.key}`} type="number" min="0" step="0.1" className="input num" value={n[f.key] ?? ''} onChange={(e) => setN(f.key, e.target.value)} />
              </div>
            ))}
            <p className="sm:col-span-2 lg:col-span-3 text-[0.85rem] text-muted num">
              Sal calculado: {((n.sodiumMg / 1000) * 2.5).toLocaleString('pt-PT', { maximumFractionDigits: 2 })} g por porção. Os açúcares são obrigatórios no rótulo; se ficarem vazios, aparece «—».
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="field-label">Ingredientes (receita)</p>
        {ing.length > 0 && (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ingrediente</th><th>Quantidade</th><th>Unid.</th><th>Alergénio</th><th><span className="sr-only">Remover</span></th></tr></thead>
              <tbody>
                {ing.map((x, i) => (
                  <tr key={i}>
                    <td><input className="input !min-h-10 min-w-48" aria-label={`Ingrediente ${i + 1}`} value={x.name} onChange={(e) => setIng(i, { name: e.target.value })} /></td>
                    <td><input type="number" min="0" step="0.1" className="input num !min-h-10 w-24" aria-label={`Quantidade de ${x.name || 'ingrediente'}`} value={x.qty} onChange={(e) => setIng(i, { qty: Math.max(0, Number(e.target.value) || 0) })} /></td>
                    <td>
                      <select className="input !min-h-10 w-20" aria-label={`Unidade de ${x.name || 'ingrediente'}`} value={x.unit} onChange={(e) => setIng(i, { unit: e.target.value as IngredientLine['unit'] })}>
                        <option value="g">g</option><option value="ml">ml</option>
                      </select>
                    </td>
                    <td>
                      <select className="input !min-h-10 min-w-40" aria-label={`Alergénio em ${x.name || 'ingrediente'}`} value={x.allergen ?? ''} onChange={(e) => setIng(i, { allergen: (e.target.value || undefined) as AllergenId | undefined })}>
                        <option value="">—</option>
                        {ALLERGENS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </td>
                    <td><button type="button" className="icon-btn text-danger" aria-label={`Remover ${x.name || 'ingrediente'}`} onClick={() => set('ingredientsList', ing.filter((_, k) => k !== i))}><LuTrash2 aria-hidden /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button type="button" className="btn btn-outline btn-sm mt-3" onClick={() => set('ingredientsList', [...ing, { name: '', qty: 0, unit: 'g' }])}><LuPlus aria-hidden />Adicionar ingrediente</button>
        <p className="field-hint">Na página do produto, os ingredientes aparecem por ordem decrescente de quantidade e os que têm alergénio ficam destacados.</p>
      </div>
    </section>
  );
}
