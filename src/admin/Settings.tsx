import { useState } from 'react';
import { LuPlus, LuTrash2 } from 'react-icons/lu';
import type { DeliveryZone, DiscountCode, Settings } from '../types';
import { resetDemo, settingsStore, toast, useSettings } from '../state';
import { earliestDeliveryDate } from '../lib/delivery';
import { formatDate, formatDateLong, formatEuro, uid, weekdayName } from '../lib/format';
import { ConfirmDialog, Field, Notice } from '../components/ui';
import { Link } from '../router';
import { AdminHeader } from './AdminApp';

function useDraft<K extends keyof Settings>(key: K) {
  const s = useSettings();
  const [draft, setDraft] = useState<Settings[K]>(() => structuredClone(s[key]));
  const dirty = JSON.stringify(draft) !== JSON.stringify(s[key]);
  const save = () => { settingsStore.set((x) => ({ ...x, [key]: draft })); toast('Definições guardadas.'); };
  const discard = () => setDraft(structuredClone(s[key]));
  return { draft, setDraft, dirty, save, discard };
}

function SaveBar({ dirty, save, discard }: { dirty: boolean; save: () => void; discard: () => void }) {
  return (
    <div className="sticky bottom-[env(safe-area-inset-bottom,0px)] z-10 mt-6 panel p-3 flex flex-wrap items-center justify-between gap-3 shadow-[var(--shadow-lift)]">
      <p className="text-[0.9rem] text-muted px-2">{dirty ? 'Tem alterações por guardar.' : 'Sem alterações.'}</p>
      <div className="flex gap-2">
        <button type="button" className="btn btn-ghost" disabled={!dirty} onClick={discard}>Descartar</button>
        <button type="button" className="btn btn-primary" disabled={!dirty} onClick={save}>Guardar alterações</button>
      </div>
    </div>
  );
}

const num = (v: string) => (v === '' ? 0 : Number(v));

export function DeliverySettings() {
  const { draft: d, setDraft, dirty, save, discard } = useDraft('delivery');
  const set = <K extends keyof Settings['delivery']>(k: K, v: Settings['delivery'][K]) => setDraft((x) => ({ ...x, [k]: v }));
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState('');
  const setZone = (i: number, patch: Partial<DeliveryZone>) => set('zones', d.zones.map((z, k) => (k === i ? { ...z, ...patch } : z)));
  const earliest = earliestDeliveryDate(new Date(), d);

  return (
    <>
      <AdminHeader title="Entregas">Taxas, zonas, dias e horários. As alterações aplicam-se de imediato na loja depois de guardar.</AdminHeader>
      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <section className="panel p-5 grid gap-5">
          <h2 className="font-bold text-lg">Valores</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Taxa de entrega padrão (€)" required hint="Usada quando ainda não há código postal.">{(a) => <input {...a} type="number" step="0.5" min="0" className="input num" value={d.standardFee} onChange={(e) => set('standardFee', num(e.target.value))} />}</Field>
            <Field label="Entrega grátis a partir de (€)" required>{(a) => <input {...a} type="number" step="1" min="0" className="input num" value={d.freeThreshold} onChange={(e) => set('freeThreshold', num(e.target.value))} />}</Field>
            <Field label="Encomenda mínima (€)" required>{(a) => <input {...a} type="number" step="1" min="0" className="input num" value={d.minOrderAmount} onChange={(e) => set('minOrderAmount', num(e.target.value))} />}</Field>
          </div>
          <Notice tone="info">O limiar de entrega grátis é comparado com o subtotal dos produtos depois dos descontos (quantidade, revenda e códigos) e antes da taxa de entrega.</Notice>
        </section>

        <section className="panel p-5 grid gap-5">
          <h2 className="font-bold text-lg">Antecedência e calendário</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Antecedência mínima (dias)" required>{(a) => <input {...a} type="number" min="0" className="input num" value={d.leadTimeDays} onChange={(e) => set('leadTimeDays', Math.max(0, parseInt(e.target.value, 10) || 0))} />}</Field>
            <Field label="Hora-limite do dia" required hint="Depois desta hora conta +1 dia.">{(a) => <input {...a} type="number" min="0" max="23" className="input num" value={d.cutoffHour} onChange={(e) => set('cutoffHour', Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 0)))} />}</Field>
            <Field label="Máximo de dias no futuro" required>{(a) => <input {...a} type="number" min="7" className="input num" value={d.maxDaysAhead} onChange={(e) => set('maxDaysAhead', Math.max(7, parseInt(e.target.value, 10) || 7))} />}</Field>
          </div>
          <fieldset>
            <legend className="field-label">Dias com entregas</legend>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((w) => (
                <label key={w} className={`rounded-xl border-2 px-3 py-2 cursor-pointer text-[0.9rem] font-semibold capitalize has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${d.weekdays.includes(w) ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
                  <input type="checkbox" className="sr-only" checked={d.weekdays.includes(w)} onChange={(e) => set('weekdays', e.target.checked ? [...d.weekdays, w] : d.weekdays.filter((x) => x !== w))} />
                  {weekdayName(w).replace('-feira', '')}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-[0.9rem]">Com estas regras, a primeira data disponível hoje é: <strong>{earliest ? formatDateLong(earliest) : 'nenhuma'}</strong>.</p>
          <div>
            <p className="field-label">Datas sem entregas (feriados, férias)</p>
            <ul className="flex flex-wrap gap-2 mb-3">
              {d.blackoutDates.length === 0 && <li className="text-muted text-[0.9rem]">Nenhuma.</li>}
              {[...d.blackoutDates].sort().map((x) => (
                <li key={x} className="badge bg-cream-2 text-ink !text-[0.85rem] !pr-1">
                  <span className="num">{formatDate(x)}</span>
                  <button type="button" className="w-6 h-6 rounded-full hover:bg-danger-bg hover:text-danger inline-flex items-center justify-center" aria-label={`Remover ${formatDate(x)}`} onClick={() => set('blackoutDates', d.blackoutDates.filter((y) => y !== x))}>×</button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 max-w-sm">
              <label htmlFor="nova-data" className="sr-only">Nova data sem entregas</label>
              <input id="nova-data" type="date" className="input" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              <button type="button" className="btn btn-outline shrink-0" disabled={!newDate} onClick={() => { if (!d.blackoutDates.includes(newDate)) set('blackoutDates', [...d.blackoutDates, newDate]); setNewDate(''); }}>Adicionar</button>
            </div>
          </div>
        </section>

        <section className="panel p-5 grid gap-4">
          <h2 className="font-bold text-lg">Horários de entrega</h2>
          <ul className="grid gap-2">
            {d.timeSlots.map((s, i) => (
              <li key={i} className="flex gap-2">
                <label htmlFor={`slot-${i}`} className="sr-only">Horário {i + 1}</label>
                <input id={`slot-${i}`} className="input num" value={s} onChange={(e) => set('timeSlots', d.timeSlots.map((x, k) => (k === i ? e.target.value : x)))} />
                <button type="button" className="icon-btn text-danger shrink-0" aria-label={`Remover horário ${s}`} onClick={() => set('timeSlots', d.timeSlots.filter((_, k) => k !== i))}><LuTrash2 aria-hidden /></button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <label htmlFor="novo-slot" className="sr-only">Novo horário</label>
            <input id="novo-slot" className="input" placeholder="Ex.: 19:00 – 21:00" value={newSlot} onChange={(e) => setNewSlot(e.target.value)} />
            <button type="button" className="btn btn-outline shrink-0" disabled={!newSlot.trim()} onClick={() => { set('timeSlots', [...d.timeSlots, newSlot.trim()]); setNewSlot(''); }}><LuPlus aria-hidden />Adicionar</button>
          </div>
          <p className="field-hint !mt-0">Sem horários, o cliente não escolhe horário no checkout.</p>
        </section>

        <section className="panel p-5 grid gap-4 xl:col-span-2">
          <h2 className="font-bold text-lg">Zonas de entrega</h2>
          <p className="text-muted text-[0.92rem] -mt-2">Indique intervalos com os 4 primeiros dígitos do código postal, separados por vírgulas (ex.: 2800-2899, 2900). Códigos fora de todas as zonas ativas não podem encomendar.</p>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ativa</th><th>Nome</th><th>Códigos postais</th><th>Taxa (€)</th><th><span className="sr-only">Remover</span></th></tr></thead>
              <tbody>
                {d.zones.map((z, i) => (
                  <tr key={z.id}>
                    <td><input type="checkbox" className="w-5 h-5 accent-brand-700" checked={z.enabled} aria-label={`Zona ${z.name} ativa`} onChange={(e) => setZone(i, { enabled: e.target.checked })} /></td>
                    <td><input className="input !min-h-10 min-w-48" aria-label="Nome da zona" value={z.name} onChange={(e) => setZone(i, { name: e.target.value })} /></td>
                    <td><input className="input num !min-h-10 min-w-40" aria-label={`Códigos postais da zona ${z.name}`} value={z.ranges} onChange={(e) => setZone(i, { ranges: e.target.value })} /></td>
                    <td><input type="number" step="0.5" min="0" className="input num !min-h-10 w-28" aria-label={`Taxa da zona ${z.name}`} value={z.fee} onChange={(e) => setZone(i, { fee: num(e.target.value) })} /></td>
                    <td><button type="button" className="icon-btn text-danger" aria-label={`Remover zona ${z.name}`} onClick={() => set('zones', d.zones.filter((_, k) => k !== i))}><LuTrash2 aria-hidden /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-outline btn-sm w-fit" onClick={() => set('zones', [...d.zones, { id: uid('z'), name: 'Nova zona', ranges: '', fee: d.standardFee, enabled: false }])}><LuPlus aria-hidden />Adicionar zona</button>
          <Field label="Restrições de entrega (texto mostrado ao cliente)">{(a) => <input {...a} className="input" value={d.restrictionsNote} onChange={(e) => set('restrictionsNote', e.target.value)} />}</Field>
        </section>
      </div>
      <SaveBar dirty={dirty} save={save} discard={discard} />
    </>
  );
}

export function PricingSettings() {
  const { draft: p, setDraft, dirty, save, discard } = useDraft('pricing');
  const setCode = (i: number, patch: Partial<DiscountCode>) => setDraft((x) => ({ ...x, codes: x.codes.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  return (
    <>
      <AdminHeader title="Preços e promoções">Preço de revenda e códigos de desconto. Os descontos por quantidade definem-se em cada produto.</AdminHeader>
      <div className="grid gap-6">
        <section className="panel p-5 grid gap-4 max-w-2xl">
          <h2 className="font-bold text-lg">Preço de revenda</h2>
          <Field label="Desconto para contas de revenda aprovadas (%)" required hint="Aplica-se a produtos marcados como «ideal para revenda». Se um desconto por quantidade for maior, aplica-se esse.">
            {(a) => <input {...a} type="number" min="0" max="60" className="input num max-w-40" value={p.wholesaleDiscountPct} onChange={(e) => setDraft({ ...p, wholesaleDiscountPct: Math.min(60, Math.max(0, Number(e.target.value) || 0)) })} />}
          </Field>
          <p className="text-[0.9rem] text-muted">Para aprovar contas, vá a <Link to="admin-clientes" className="font-semibold text-brand-700 underline">Clientes</Link>. Para escalões por quantidade, edite cada <Link to="admin-produtos" className="font-semibold text-brand-700 underline">produto</Link>.</p>
        </section>
        <section className="panel p-5 grid gap-4">
          <h2 className="font-bold text-lg">Códigos de desconto</h2>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Ativo</th><th>Código</th><th>Tipo</th><th>Valor</th><th>Mínimo (€)</th><th>Válido até</th><th>Descrição interna</th><th><span className="sr-only">Remover</span></th></tr></thead>
              <tbody>
                {p.codes.map((c, i) => (
                  <tr key={c.id}>
                    <td><input type="checkbox" className="w-5 h-5 accent-brand-700" checked={c.active} aria-label={`Código ${c.code} ativo`} onChange={(e) => setCode(i, { active: e.target.checked })} /></td>
                    <td><input className="input !min-h-10 uppercase font-semibold w-36" aria-label="Código" value={c.code} onChange={(e) => setCode(i, { code: e.target.value.toUpperCase().replace(/\s/g, '') })} /></td>
                    <td>
                      <select className="input !min-h-10 w-28" aria-label={`Tipo do código ${c.code}`} value={c.type} onChange={(e) => setCode(i, { type: e.target.value as DiscountCode['type'] })}>
                        <option value="percent">%</option><option value="fixed">€</option>
                      </select>
                    </td>
                    <td><input type="number" min="0" className="input num !min-h-10 w-24" aria-label={`Valor do código ${c.code}`} value={c.value} onChange={(e) => setCode(i, { value: num(e.target.value) })} /></td>
                    <td><input type="number" min="0" className="input num !min-h-10 w-24" aria-label={`Mínimo do código ${c.code}`} value={c.minSubtotal} onChange={(e) => setCode(i, { minSubtotal: num(e.target.value) })} /></td>
                    <td><input type="date" className="input !min-h-10" aria-label={`Validade do código ${c.code}`} value={c.validUntil} onChange={(e) => setCode(i, { validUntil: e.target.value })} /></td>
                    <td><input className="input !min-h-10 min-w-56" aria-label={`Descrição do código ${c.code}`} value={c.description} onChange={(e) => setCode(i, { description: e.target.value })} /></td>
                    <td><button type="button" className="icon-btn text-danger" aria-label={`Remover código ${c.code}`} onClick={() => setDraft({ ...p, codes: p.codes.filter((_, k) => k !== i) })}><LuTrash2 aria-hidden /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" className="btn btn-outline btn-sm w-fit" onClick={() => setDraft({ ...p, codes: [...p.codes, { id: uid('c'), code: 'NOVOCODIGO', type: 'percent', value: 5, minSubtotal: 0, active: false, validUntil: '', description: '' }] })}>
            <LuPlus aria-hidden />Novo código
          </button>
          <p className="field-hint !mt-0">Exemplo: com 10% e mínimo de {formatEuro(20)}, uma encomenda de {formatEuro(40)} desconta {formatEuro(4)}.</p>
        </section>
      </div>
      <SaveBar dirty={dirty} save={save} discard={discard} />
    </>
  );
}

export function BusinessSettings() {
  const { draft: b, setDraft, dirty, save, discard } = useDraft('business');
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof Settings['business']>(k: K, v: Settings['business'][K]) => setDraft((x) => ({ ...x, [k]: v }));
  return (
    <>
      <AdminHeader title="Negócio">Dados mostrados na loja. Campos vazios aparecem como «a definir».</AdminHeader>
      <div className="grid xl:grid-cols-2 gap-6 items-start">
        <section className="panel p-5 grid gap-5">
          <h2 className="font-bold text-lg">Identificação e contactos</h2>
          <Field label="Nome do negócio" required>{(a) => <input {...a} className="input" value={b.name} onChange={(e) => set('name', e.target.value)} />}</Field>
          <Field label="Frase de apresentação">{(a) => <input {...a} className="input" value={b.tagline} onChange={(e) => set('tagline', e.target.value)} />}</Field>
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Email de contacto">{(a) => <input {...a} type="email" className="input" value={b.email} onChange={(e) => set('email', e.target.value)} />}</Field>
            <Field label="Telefone">{(a) => <input {...a} type="tel" className="input" value={b.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
          </div>
          <Field label="Morada">{(a) => <input {...a} className="input" value={b.address} onChange={(e) => set('address', e.target.value)} />}</Field>
          <Field label="NIF da empresa">{(a) => <input {...a} className="input num" inputMode="numeric" maxLength={9} value={b.nif} onChange={(e) => set('nif', e.target.value.replace(/\D/g, ''))} />}</Field>
          <div>
            <p className="field-label">Logótipo</p>
            <p className="text-[0.9rem] text-muted">O logótipo atual é um logótipo de texto. Para usar um ficheiro de imagem, substitua o componente <code className="text-[0.85rem] bg-cream px-1 rounded">Logo</code> (ver README).</p>
          </div>
        </section>
        <div className="grid gap-6">
          <section className="panel p-5 grid gap-5">
            <h2 className="font-bold text-lg">Loja</h2>
            <label className="flex items-center gap-3 font-semibold">
              <input type="checkbox" role="switch" className="w-5 h-5 accent-brand-700" checked={b.storeOpen} onChange={(e) => set('storeOpen', e.target.checked)} />
              Loja aberta a encomendas
            </label>
            <Field label="Mensagem quando a loja está fechada">{(a) => <input {...a} className="input" value={b.closedMessage} onChange={(e) => set('closedMessage', e.target.value)} />}</Field>
          </section>
          <section className="panel p-5 grid gap-5">
            <h2 className="font-bold text-lg">Moeda e impostos</h2>
            <div className="grid sm:grid-cols-2 gap-5">
              <div><p className="field-label">Moeda</p><p className="input flex items-center bg-cream">Euro (€)</p></div>
              <Field label="Taxa de IVA (%)" hint="A confirmar com o contabilista.">{(a) => <input {...a} type="number" min="0" max="30" className="input num" value={b.vatRate} onChange={(e) => set('vatRate', num(e.target.value))} />}</Field>
            </div>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={b.pricesIncludeVat} onChange={(e) => set('pricesIncludeVat', e.target.checked)} />
              Os preços indicados incluem IVA
            </label>
            <Notice tone="warn">Faturação certificada e cálculo de IVA por linha têm de ser feitos por software de faturação certificado, ligado ao servidor.</Notice>
          </section>
          <section className="panel p-5 grid gap-3">
            <h2 className="font-bold text-lg">Dados de demonstração</h2>
            <p className="text-muted text-[0.92rem]">Repõe produtos, encomendas, clientes e definições de exemplo neste navegador.</p>
            <button type="button" className="btn btn-outline text-danger w-fit" onClick={() => setConfirm(true)}>Repor dados de exemplo</button>
          </section>
        </div>
      </div>
      <SaveBar dirty={dirty} save={save} discard={discard} />
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} title="Repor os dados de exemplo?" confirmLabel="Repor dados" message="Todas as alterações feitas neste navegador serão perdidas." onConfirm={resetDemo} />
    </>
  );
}
