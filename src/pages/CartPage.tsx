import { useState } from 'react';
import { LuShoppingBasket, LuTag, LuMapPin, LuArrowRight } from 'react-icons/lu';
import { cart, useCart, useCartTotals } from '../state';
import { CartLine, FreeDeliveryProgress, TotalsTable } from '../components/CartParts';
import { EmptyState, PageHeader, ConfirmDialog } from '../components/ui';
import { Link, navigate } from '../router';
import { normalizePostalCode } from '../lib/delivery';

export function CartPage() {
  const t = useCartTotals();
  const { code, postalCode } = useCart();
  const [codeInput, setCodeInput] = useState(code ?? '');
  const [pcInput, setPcInput] = useState(postalCode ?? '');
  const [confirmClear, setConfirmClear] = useState(false);

  if (t.lines.length === 0) {
    return (
      <div className="wrap py-12">
        <PageHeader title="Carrinho" />
        <EmptyState icon={<LuShoppingBasket />} title="O seu carrinho está vazio" action={<><Link to="produtos" className="btn btn-primary">Ver produtos</Link><Link to="grosso" className="btn btn-outline">Encomenda rápida</Link></>}>
          Ainda não adicionou salgados. Escolha os produtos, o pack e a preparação, e volte aqui para finalizar.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="wrap py-10 md:py-12">
      <PageHeader title="Carrinho" actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmClear(true)}>Esvaziar carrinho</button>}>
        Reveja os produtos, as preparações e as quantidades antes de finalizar.
      </PageHeader>
      <div className="grid lg:grid-cols-[1fr_380px] gap-8 items-start">
        <div className="grid gap-3 min-w-0">
          <FreeDeliveryProgress t={t} />
          {t.lines.map((l) => <CartLine key={l.item.key} line={l} />)}
          <Link to="produtos" className="btn btn-outline w-fit mt-2">Continuar a comprar</Link>
        </div>

        <aside className="card p-5 lg:sticky lg:top-28 grid gap-5" aria-labelledby="resumo">
          <h2 id="resumo" className="text-xl font-bold">Resumo da encomenda</h2>

          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); cart.setPostalCode(pcInput ? normalizePostalCode(pcInput) : null); }}>
            <label htmlFor="cp-estimativa" className="field-label !mb-0 flex items-center gap-1.5"><LuMapPin aria-hidden />Calcular taxa de entrega</label>
            <div className="flex gap-2">
              <input id="cp-estimativa" className="input" inputMode="numeric" placeholder="0000-000" value={pcInput} onChange={(e) => setPcInput(e.target.value)} aria-invalid={!!t.zoneError} aria-describedby={t.zoneError ? 'cp-erro' : undefined} autoComplete="postal-code" />
              <button type="submit" className="btn btn-outline shrink-0">Calcular</button>
            </div>
            {t.zoneError && <p id="cp-erro" className="field-error" role="alert">{t.zoneError}</p>}
          </form>

          <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); cart.setCode(codeInput.trim() || null); }}>
            <label htmlFor="codigo" className="field-label !mb-0 flex items-center gap-1.5"><LuTag aria-hidden />Código de desconto</label>
            <div className="flex gap-2">
              <input id="codigo" className="input uppercase" value={codeInput} onChange={(e) => setCodeInput(e.target.value)} aria-invalid={!!t.codeError} aria-describedby={t.codeError ? 'codigo-erro' : 'codigo-dica'} />
              {code ? (
                <button type="button" className="btn btn-outline shrink-0" onClick={() => { cart.setCode(null); setCodeInput(''); }}>Remover</button>
              ) : (
                <button type="submit" className="btn btn-outline shrink-0">Aplicar</button>
              )}
            </div>
            {t.codeError ? <p id="codigo-erro" className="field-error" role="alert">{t.codeError}</p>
              : t.code ? <p className="text-[0.85rem] text-ok font-semibold">Código {t.code.code} aplicado.</p>
              : <p id="codigo-dica" className="field-hint">Se tiver um código de desconto, introduza-o aqui.</p>}
          </form>

          <TotalsTable t={t} />

          {t.errors.length > 0 && (
            <ul className="grid gap-1 text-[0.88rem] text-danger" role="alert">
              {t.errors.map((e) => <li key={e}>• {e}</li>)}
            </ul>
          )}
          <button type="button" className="btn btn-primary btn-lg w-full" disabled={!t.canCheckout} onClick={() => navigate('finalizar')}>
            Finalizar encomenda <LuArrowRight aria-hidden />
          </button>
        </aside>
      </div>
      <ConfirmDialog open={confirmClear} onClose={() => setConfirmClear(false)} title="Esvaziar o carrinho?" message="Todos os produtos serão removidos do carrinho." confirmLabel="Esvaziar carrinho" onConfirm={() => cart.clear()} />
    </div>
  );
}
