import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { LuCheck, LuChevronLeft, LuArrowRight, LuLock, LuPencil, LuShoppingBasket, LuInfo } from 'react-icons/lu';
import type { CustomerType, PaymentMethodId } from '../types';
import { isWholesale, toast, useCart, useCartTotals, useCurrentCustomer, useSettings } from '../state';
import { Field, Notice, EmptyState, PrepBadge, PageHeader, prepLabel } from '../components/ui';
import { TotalsTable } from '../components/CartParts';
import { DeliveryCalendar } from '../components/DeliveryCalendar';
import { PaymentMethodSelector } from '../components/PaymentMethodSelector';
import { checkDeliveryDate, normalizePostalCode, resolveZone } from '../lib/delivery';
import { validateCustomerInfo, validateNif } from '../lib/orders';
import { formatDateLong, formatEuro, uid } from '../lib/format';
import { placeOrder } from '../services/orders';
import { PAYMENT_METHODS, realWorldNote } from '../services/payments';
import { updateCustomer } from '../services/auth';
import { Link, navigate } from '../router';

const STEPS = ['Os seus dados', 'Entrega', 'Revisão', 'Pagamento'];

export function CheckoutSteps({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2 sm:gap-3 mb-8 overflow-x-auto pb-1" aria-label="Passos da encomenda">
      {[...STEPS, 'Confirmação'].map((s, i) => {
        const done = i < step, current = i === step;
        return (
          <li key={s} className="flex items-center gap-2 sm:gap-3 shrink-0" aria-current={current ? 'step' : undefined}>
            <span className={`num w-8 h-8 rounded-full flex items-center justify-center text-[0.85rem] font-bold ${done ? 'bg-brand-700 text-white' : current ? 'bg-accent-500 text-brand-900' : 'bg-cream-2 text-muted'}`}>
              {done ? <LuCheck aria-hidden /> : i + 1}
            </span>
            <span className={`text-[0.9rem] font-semibold ${current ? 'text-ink' : 'text-muted'} ${current ? '' : 'hidden md:inline'}`}>
              {s}{done && <span className="sr-only"> (concluído)</span>}
            </span>
            {i < STEPS.length && <span className="w-6 sm:w-10 h-px bg-line" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

interface Form {
  name: string; email: string; phone: string; type: CustomerType; businessName: string; nif: string;
  street: string; extra: string; postalCode: string; city: string;
  deliveryDate: string; timeSlot: string; instructions: string; saveAddress: boolean;
  paymentMethod: PaymentMethodId | ''; acceptTerms: boolean;
}

export function Checkout() {
  const customer = useCurrentCustomer();
  const settings = useSettings();
  const { items, code } = useCart();
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const addr0 = customer?.addresses[0];
  const [f, setF] = useState<Form>({
    name: customer?.name ?? '', email: customer?.email ?? '', phone: customer?.phone ?? '',
    type: customer?.type ?? 'particular', businessName: customer?.businessName ?? '', nif: customer?.nif ?? '',
    street: addr0?.street ?? '', extra: addr0?.extra ?? '', postalCode: addr0?.postalCode ?? '', city: addr0?.city ?? '',
    deliveryDate: '', timeSlot: settings.delivery.timeSlots[0] ?? '', instructions: '', saveAddress: true,
    paymentMethod: '', acceptTerms: false,
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const pc = normalizePostalCode(f.postalCode);
  const t = useCartTotals(step >= 1 && /^\d{4}-\d{3}$/.test(pc) ? pc : undefined);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { headingRef.current?.focus(); window.scrollTo({ top: 0 }); }, [step]);

  if (items.length === 0 && !submitting) {
    return (
      <div className="wrap py-12">
        <PageHeader title="Finalizar encomenda" />
        <EmptyState icon={<LuShoppingBasket />} title="Não há produtos para encomendar" action={<Link to="produtos" className="btn btn-primary">Ver produtos</Link>}>
          O seu carrinho está vazio. Adicione produtos para continuar.
        </EmptyState>
      </div>
    );
  }

  const zone = /^\d{4}-\d{3}$/.test(pc) ? resolveZone(pc, settings.delivery.zones) : null;

  function validate(s: number): Record<string, string> {
    const e: Record<string, string> = {};
    if (s === 0) {
      Object.assign(e, validateCustomerInfo(f));
      if (f.type === 'revenda' && f.nif && !validateNif(f.nif)) e.nif = 'O NIF indicado não é válido. Verifique os 9 dígitos.';
    }
    if (s === 1) {
      if (f.street.trim().length < 4) e.street = 'Indique a rua e o número da porta.';
      if (!/^\d{4}-\d{3}$/.test(pc)) e.postalCode = 'Indique um código postal válido (formato 0000-000).';
      else if (zone && !zone.ok) e.postalCode = 'Lamentamos, ainda não fazemos entregas neste código postal.';
      if (f.city.trim().length < 2) e.city = 'Indique a localidade.';
      const dc = checkDeliveryDate(f.deliveryDate, new Date(), settings.delivery);
      if (!dc.ok) e.deliveryDate = dc.message;
      if (settings.delivery.timeSlots.length && !f.timeSlot) e.timeSlot = 'Escolha um horário.';
    }
    if (s === 3) {
      if (!f.paymentMethod) e.paymentMethod = 'Escolha um método de pagamento.';
      if (!f.acceptTerms) e.acceptTerms = 'Para continuar, aceite os termos e condições e a política de privacidade.';
    }
    return e;
  }

  function next(e?: FormEvent) {
    e?.preventDefault();
    const v = validate(step);
    setErrors(v);
    if (Object.keys(v).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"], #pm-erro, #termos-erro')?.focus());
      return;
    }
    if (step === 2 && !t.canCheckout) return;
    setStep((s) => s + 1);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const v = validate(3);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSubmitting(true);
    setServerErrors([]);
    const res = await placeOrder({
      items, discountCode: code, customerId: customer?.id ?? null,
      customer: { name: f.name, email: f.email, phone: f.phone, type: f.type, businessName: f.businessName || undefined, nif: f.nif || undefined },
      address: { street: f.street, extra: f.extra, postalCode: f.postalCode, city: f.city },
      deliveryDate: f.deliveryDate, timeSlot: f.timeSlot, instructions: f.instructions,
      paymentMethod: f.paymentMethod as PaymentMethodId,
    });
    if (!res.ok) {
      setSubmitting(false);
      setServerErrors(res.errors);
      return;
    }
    if (customer && f.saveAddress && !customer.addresses.some((a) => a.street === f.street && a.postalCode === pc)) {
      updateCustomer(customer.id, { addresses: [...customer.addresses, { id: uid('a-'), label: `Morada ${customer.addresses.length + 1}`, street: f.street, extra: f.extra, postalCode: pc, city: f.city }] });
    }
    toast('Encomenda registada (simulação).');
    navigate(`confirmacao-${res.order.id}`);
  }

  const back = () => setStep((s) => Math.max(0, s - 1));
  const err = (k: string) => errors[k];

  const stepBody: Record<number, ReactNode> = {
    0: (
      <form onSubmit={next} noValidate className="grid gap-5">
        {!customer && (
          <Notice tone="info">
            Já tem conta? <Link to="entrar" className="font-semibold underline underline-offset-2">Inicie sessão</Link> para preencher os dados automaticamente. Também pode continuar sem conta.
          </Notice>
        )}
        <fieldset>
          <legend className="field-label">Tipo de cliente</legend>
          <div className="grid grid-cols-2 gap-2 max-w-md">
            {(['particular', 'revenda'] as const).map((tp) => (
              <label key={tp} className={`rounded-xl border-2 px-4 py-3 cursor-pointer font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${f.type === tp ? 'border-brand-600 bg-brand-50' : 'border-line bg-paper'}`}>
                <input type="radio" name="tipo" className="sr-only" checked={f.type === tp} onChange={() => set('type', tp)} />
                {tp === 'particular' ? 'Particular' : 'Empresa / revenda'}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Nome completo" required error={err('name')}>{(p) => <input {...p} className="input" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Email" required error={err('email')} hint="Enviaremos a confirmação para este email (quando o envio estiver ativo).">{(p) => <input {...p} type="email" className="input" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />}</Field>
          <Field label="Telefone" required error={err('phone')}>{(p) => <input {...p} type="tel" className="input" autoComplete="tel" placeholder="912 345 678" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        </div>
        {f.type === 'revenda' && (
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Nome da empresa">{(p) => <input {...p} className="input" autoComplete="organization" value={f.businessName} onChange={(e) => set('businessName', e.target.value)} />}</Field>
            <Field label="NIF" error={err('nif')} hint="Para emitir fatura com contribuinte.">{(p) => <input {...p} className="input" inputMode="numeric" maxLength={9} value={f.nif} onChange={(e) => set('nif', e.target.value.replace(/\D/g, ''))} />}</Field>
          </div>
        )}
        <div className="flex justify-between gap-3 flex-wrap pt-2">
          <Link to="carrinho" className="btn btn-ghost"><LuChevronLeft aria-hidden />Voltar ao carrinho</Link>
          <button type="submit" className="btn btn-primary btn-lg">Continuar para a entrega <LuArrowRight aria-hidden /></button>
        </div>
      </form>
    ),
    1: (
      <form onSubmit={next} noValidate className="grid gap-5">
        {customer && customer.addresses.length > 0 && (
          <fieldset>
            <legend className="field-label">Moradas guardadas</legend>
            <div className="flex flex-wrap gap-2">
              {customer.addresses.map((a) => (
                <button key={a.id} type="button" className="btn btn-outline btn-sm" onClick={() => setF((p) => ({ ...p, street: a.street, extra: a.extra, postalCode: a.postalCode, city: a.city }))}>
                  {a.label}: {a.street}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <Field label="Morada de entrega" required error={err('street')} hint="Rua, número e andar.">{(p) => <input {...p} className="input" autoComplete="street-address" value={f.street} onChange={(e) => set('street', e.target.value)} />}</Field>
        <Field label="Informações adicionais da morada">{(p) => <input {...p} className="input" placeholder="Ex.: loja B, traseiras, código da porta" value={f.extra} onChange={(e) => set('extra', e.target.value)} />}</Field>
        <div className="grid sm:grid-cols-[200px_1fr] gap-5">
          <Field label="Código postal" required error={err('postalCode')}>{(p) => <input {...p} className="input num" inputMode="numeric" autoComplete="postal-code" placeholder="0000-000" value={f.postalCode} onChange={(e) => set('postalCode', e.target.value)} onBlur={() => set('postalCode', normalizePostalCode(f.postalCode))} />}</Field>
          <Field label="Localidade" required error={err('city')}>{(p) => <input {...p} className="input" autoComplete="address-level2" value={f.city} onChange={(e) => set('city', e.target.value)} />}</Field>
        </div>
        {zone && (zone.ok ? (
          <Notice tone="success">Fazemos entregas nesta zona: {zone.zone.name}. Taxa de entrega: {t.freeDelivery ? 'grátis' : formatEuro(zone.zone.fee)}.</Notice>
        ) : (
          <Notice tone="error" title="Ainda não entregamos neste código postal">
            {settings.delivery.restrictionsNote} Se tem um negócio nesta zona, contacte-nos para sabermos do seu interesse.
          </Notice>
        ))}

        <div>
          <p id="data-label" className="field-label">Data de entrega pretendida <span className="text-danger" aria-hidden>*</span></p>
          <p className="field-hint !mt-0 mb-3">Pedimos {settings.delivery.leadTimeDays} dias de antecedência (encomendas depois das {settings.delivery.cutoffHour}h contam a partir do dia seguinte).</p>
          <DeliveryCalendar labelledBy="data-label" value={f.deliveryDate} onChange={(d) => set('deliveryDate', d)} delivery={settings.delivery} />
          {f.deliveryDate && <p className="mt-2 font-semibold text-brand-800">Data pedida: {formatDateLong(f.deliveryDate)}</p>}
          {err('deliveryDate') && <p className="field-error" role="alert" tabIndex={-1} aria-invalid="true">{err('deliveryDate')}</p>}
        </div>

        {settings.delivery.timeSlots.length > 0 && (
          <fieldset>
            <legend className="field-label">Horário preferido</legend>
            <div className="flex flex-wrap gap-2">
              {settings.delivery.timeSlots.map((s) => (
                <label key={s} className={`num rounded-xl border-2 px-4 py-2.5 cursor-pointer font-semibold has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${f.timeSlot === s ? 'border-brand-600 bg-brand-50' : 'border-line bg-paper'}`}>
                  <input type="radio" name="horario" className="sr-only" checked={f.timeSlot === s} onChange={() => set('timeSlot', s)} />
                  {s}
                </label>
              ))}
            </div>
            {err('timeSlot') && <p className="field-error">{err('timeSlot')}</p>}
          </fieldset>
        )}
        <Field label="Instruções de entrega">{(p) => <textarea {...p} className="input" placeholder="Ex.: tocar à campainha do café, entregar pela porta lateral" value={f.instructions} onChange={(e) => set('instructions', e.target.value)} />}</Field>
        {customer && (
          <label className="inline-flex items-center gap-2 text-[0.95rem]">
            <input type="checkbox" className="w-5 h-5 accent-brand-700" checked={f.saveAddress} onChange={(e) => set('saveAddress', e.target.checked)} />
            Guardar esta morada na minha conta
          </label>
        )}
        <Notice tone="info">A data indicada é um pedido. Só fica confirmada depois de a encomenda ser validada pela nossa equipa.</Notice>
        <div className="flex justify-between gap-3 flex-wrap pt-2">
          <button type="button" className="btn btn-ghost" onClick={back}><LuChevronLeft aria-hidden />Voltar</button>
          <button type="submit" className="btn btn-primary btn-lg">Rever encomenda <LuArrowRight aria-hidden /></button>
        </div>
      </form>
    ),
    2: (
      <div className="grid gap-6">
        <ReviewBlock title="Produtos" onEdit={() => navigate('carrinho')} editLabel="Editar produtos no carrinho">
          <ul className="grid gap-3">
            {t.lines.map((l) => (
              <li key={l.item.key} className="flex justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
                <div className="min-w-0">
                  <p className="font-semibold">{l.product?.name}</p>
                  <p className="num text-[0.88rem] text-muted">{l.item.quantity} × pack de {l.item.packSize} ({l.units} unidades) · {formatEuro(l.unitPrice)}/un.</p>
                  <div className="mt-1.5"><PrepBadge prep={l.item.prep} /></div>
                  {l.error && <p className="field-error">{l.error}</p>}
                </div>
                <div className="text-right num shrink-0">
                  <p className="font-bold">{formatEuro(l.total)}</p>
                  {l.discount > 0 && <p className="text-[0.78rem] text-ok font-semibold">−{formatEuro(l.discount)}</p>}
                </div>
              </li>
            ))}
          </ul>
        </ReviewBlock>
        <ReviewBlock title="Dados do cliente" onEdit={() => setStep(0)} editLabel="Editar os seus dados">
          <p>{f.name}{f.type === 'revenda' && f.businessName ? ` · ${f.businessName}` : ''}</p>
          <p className="text-muted">{f.email} · {f.phone}</p>
          <p className="text-muted">{f.type === 'revenda' ? 'Empresa / revenda' : 'Particular'}{f.nif ? ` · NIF ${f.nif}` : ''}</p>
        </ReviewBlock>
        <ReviewBlock title="Entrega" onEdit={() => setStep(1)} editLabel="Editar a entrega">
          <p>{f.street}{f.extra ? `, ${f.extra}` : ''}</p>
          <p className="text-muted num">{pc} {f.city}</p>
          <p className="mt-2"><span className="font-semibold">Data pedida:</span> {formatDateLong(f.deliveryDate)}{f.timeSlot ? `, ${f.timeSlot}` : ''}</p>
          {f.instructions && <p className="text-muted mt-1">Instruções: {f.instructions}</p>}
        </ReviewBlock>
        {!t.canCheckout && <Notice tone="error" title="Não é possível continuar">{t.errors.join(' ')}</Notice>}
        <div className="flex justify-between gap-3 flex-wrap">
          <button type="button" className="btn btn-ghost" onClick={back}><LuChevronLeft aria-hidden />Voltar</button>
          <button type="button" className="btn btn-primary btn-lg" onClick={() => next()} disabled={!t.canCheckout}>Escolher pagamento <LuArrowRight aria-hidden /></button>
        </div>
      </div>
    ),
    3: (
      <form onSubmit={submit} noValidate className="grid gap-6">
        <Notice tone="warn" title="Pagamento simulado">
          Esta é uma demonstração. Nenhum pagamento será processado e não pedimos dados de cartão. A encomenda fica registada com o pagamento «Pendente» e identificada como simulação.
        </Notice>
        <PaymentMethodSelector value={f.paymentMethod} onChange={(m) => set('paymentMethod', m)} error={err('paymentMethod')} />
        {f.paymentMethod && (
          <p className="flex gap-2 text-[0.92rem] text-muted"><LuInfo className="mt-0.5 shrink-0" aria-hidden />{realWorldNote(f.paymentMethod)}</p>
        )}
        <div>
          <label className="inline-flex items-start gap-2.5 text-[0.95rem]">
            <input type="checkbox" className="w-5 h-5 mt-0.5 accent-brand-700 shrink-0" checked={f.acceptTerms} onChange={(e) => set('acceptTerms', e.target.checked)} aria-invalid={!!err('acceptTerms')} aria-describedby={err('acceptTerms') ? 'termos-erro' : undefined} />
            <span>Li e aceito os <Link to="info-termos" className="font-semibold underline underline-offset-2">termos e condições</Link> e a <Link to="info-privacidade" className="font-semibold underline underline-offset-2">política de privacidade</Link>.</span>
          </label>
          {err('acceptTerms') && <p id="termos-erro" className="field-error" tabIndex={-1}>{err('acceptTerms')}</p>}
        </div>
        {serverErrors.length > 0 && <Notice tone="error" title="Não foi possível registar a encomenda">{serverErrors.map((e) => <p key={e}>{e}</p>)}</Notice>}
        <div className="flex justify-between gap-3 flex-wrap">
          <button type="button" className="btn btn-ghost" onClick={back} disabled={submitting}><LuChevronLeft aria-hidden />Voltar</button>
          <button type="submit" className="btn btn-accent btn-lg" disabled={submitting} aria-busy={submitting}>
            {submitting ? 'A registar encomenda…' : <>Confirmar encomenda · {formatEuro(t.total)} <span className="text-[0.8rem] font-semibold opacity-80">(simulação)</span></>}
          </button>
        </div>
      </form>
    ),
  };

  return (
    <div className="wrap py-10 md:py-12">
      <CheckoutSteps step={step} />
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        <section className="min-w-0 card p-5 sm:p-7" aria-labelledby="passo-titulo">
          <h1 id="passo-titulo" ref={headingRef} tabIndex={-1} className="text-2xl md:text-3xl font-extrabold text-brand-900 mb-6 outline-none">
            <span className="sr-only">Passo {step + 1} de 5: </span>{STEPS[step]}
          </h1>
          {stepBody[step]}
        </section>
        <aside className="card p-5 lg:sticky lg:top-28 grid gap-4" aria-labelledby="resumo-checkout">
          <h2 id="resumo-checkout" className="text-lg font-bold">Resumo da encomenda</h2>
          <ul className="grid gap-2 text-[0.9rem]">
            {t.lines.map((l) => (
              <li key={l.item.key} className="flex justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold">{l.item.quantity} × {l.product?.name}</span>
                  <span className="block text-muted text-[0.82rem]">Pack de {l.item.packSize} · {prepLabel(l.item.prep)}</span>
                </span>
                <span className="num shrink-0">{formatEuro(l.total)}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-3"><TotalsTable t={t} /></div>
          {isWholesale(customer) && <p className="text-[0.85rem] text-ok font-semibold">Preço de revenda aplicado à sua conta.</p>}
          {step === 3 && f.paymentMethod && <p className="text-[0.88rem] text-muted">Pagamento: {PAYMENT_METHODS.find((m) => m.id === f.paymentMethod)?.label} (simulação)</p>}
          <p className="flex items-center gap-2 text-[0.8rem] text-muted"><LuLock aria-hidden />Os totais são recalculados ao registar a encomenda.</p>
        </aside>
      </div>
    </div>
  );
}

function ReviewBlock({ title, children, onEdit, editLabel }: { title: string; children: ReactNode; onEdit: () => void; editLabel: string }) {
  return (
    <section className="panel p-5">
      <div className="flex justify-between items-center gap-3 mb-3">
        <h2 className="font-bold text-lg">{title}</h2>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit} aria-label={editLabel}><LuPencil aria-hidden />Editar</button>
      </div>
      <div className="text-[0.95rem]">{children}</div>
    </section>
  );
}
