import { useState, type ReactNode } from 'react';
import { LuClipboardList, LuMapPin, LuUser, LuLogOut, LuRepeat, LuPackage, LuTrash2, LuPlus, LuChevronLeft } from 'react-icons/lu';
import type { Address, Customer, Order } from '../types';
import { cart, errorText, toast, useCurrentCustomer, useOrders, useProducts } from '../state';
import { deleteMyAccount, logout, updateCustomer } from '../services/auth';
import { EmptyState, Field, Notice, StatusBadge, ConfirmDialog, PaymentBadge, Modal } from '../components/ui';
import { OrderFacts, OrderLinesTable, OrderTotals } from '../components/OrderView';
import { formatDate, formatEuro, uid } from '../lib/format';
import { normalizePostalCode, POSTAL_CODE_RE } from '../lib/delivery';
import { validateCustomerInfo } from '../lib/orders';
import { Link, navigate, useRoute } from '../router';
import { LoginPage } from './Auth';

const NAV = [
  { to: 'conta', label: 'Perfil', icon: <LuUser aria-hidden /> },
  { to: 'conta-encomendas', label: 'Encomendas', icon: <LuClipboardList aria-hidden /> },
  { to: 'conta-moradas', label: 'Moradas', icon: <LuMapPin aria-hidden /> },
];

function AccountShell({ customer, title, children }: { customer: Customer; title: string; children: ReactNode }) {
  const route = useRoute();
  return (
    <div className="wrap py-10 md:py-12">
      <p className="eyebrow mb-2">A minha conta</p>
      <h1 className="text-3xl md:text-4xl font-extrabold text-brand-900 mb-8" data-page-title tabIndex={-1}>{title}</h1>
      <div className="grid md:grid-cols-[220px_1fr] gap-8 items-start">
        <nav aria-label="Conta" className="panel p-2 md:sticky md:top-28">
          <p className="px-3 pt-2 pb-3 text-[0.9rem]">
            <span className="block font-semibold truncate">{customer.name}</span>
            <span className="block text-muted text-[0.82rem]">{customer.type === 'revenda' ? (customer.wholesaleApproved ? 'Revenda · preços aprovados' : 'Revenda · aprovação pendente') : 'Particular'}</span>
          </p>
          <ul className="grid gap-0.5">
            {NAV.map((n) => {
              const active = route === n.to || (n.to === 'conta-encomendas' && route.startsWith('conta-encomenda-'));
              return (
                <li key={n.to}>
                  <Link to={n.to} aria-current={active ? 'page' : undefined} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium ${active ? 'bg-brand-50 text-brand-800' : 'hover:bg-cream'}`}>{n.icon}{n.label}</Link>
                </li>
              );
            })}
            <li>
              <button type="button" className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-medium text-danger hover:bg-danger-bg" onClick={async () => { await logout(); toast('Sessão terminada.', 'info'); navigate(''); }}>
                <LuLogOut aria-hidden />Terminar sessão
              </button>
            </li>
          </ul>
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export function reorder(order: Order, products: ReturnType<typeof useProducts>) {
  let added = 0, skipped = 0;
  for (const l of order.lines) {
    const p = products.find((x) => x.id === l.productId);
    if (p && p.active && p.prep[l.prep]?.enabled && p.packSizes.includes(l.packSize) && p.availability !== 'esgotado' && p.availability !== 'brevemente') {
      cart.add(l.productId, l.packSize, l.quantity, l.prep);
      added++;
    } else skipped++;
  }
  if (added) toast(skipped ? `Adicionámos ${added} produtos ao carrinho. ${skipped} já não estão disponíveis.` : 'Produtos adicionados ao carrinho com os preços atuais.');
  else toast('Nenhum dos produtos desta encomenda está disponível.', 'error');
  if (added) navigate('carrinho');
}

export function AccountPage({ view, orderId }: { view: 'perfil' | 'encomendas' | 'encomenda' | 'moradas'; orderId?: string }) {
  const customer = useCurrentCustomer();
  if (!customer) return <LoginPage />;
  if (view === 'encomendas') return <AccountShell customer={customer} title="As minhas encomendas"><OrdersList customer={customer} /></AccountShell>;
  if (view === 'encomenda') return <AccountShell customer={customer} title="Detalhe da encomenda"><OrderDetail customer={customer} id={orderId!} /></AccountShell>;
  if (view === 'moradas') return <AccountShell customer={customer} title="Moradas de entrega"><Addresses customer={customer} /></AccountShell>;
  return <AccountShell customer={customer} title={`Olá, ${customer.name.split(' ')[0]}`}><Profile customer={customer} /></AccountShell>;
}

function Profile({ customer }: { customer: Customer }) {
  const [f, setF] = useState({ name: customer.name, email: customer.email, phone: customer.phone, businessName: customer.businessName ?? '', nif: customer.nif ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const orders = useOrders().filter((o) => o.customerId === customer.id);
  return (
    <div className="grid gap-6">
      {customer.type === 'revenda' && !customer.wholesaleApproved && (
        <Notice tone="info" title="Conta de revenda em análise">A nossa equipa vai validar a sua conta. Depois de aprovada, os preços de revenda aparecem automaticamente.</Notice>
      )}
      {customer.type === 'revenda' && customer.wholesaleApproved && (
        <Notice tone="success" title="Preços de revenda ativos">Os preços de revenda são aplicados automaticamente no carrinho.</Notice>
      )}
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Encomendas" value={String(orders.length)} />
        <Stat label="Total encomendado" value={formatEuro(orders.filter((o) => o.status !== 'cancelada').reduce((s, o) => s + o.total, 0))} />
        <Stat label="Cliente desde" value={formatDate(customer.createdAt)} />
      </div>
      <form className="card p-6 grid gap-5" noValidate onSubmit={(e) => {
        e.preventDefault();
        const er = validateCustomerInfo({ ...f, type: customer.type });
        setErrors(er);
        if (Object.keys(er).length) return;
        updateCustomer(customer.id, { name: f.name.trim(), phone: f.phone.trim(), businessName: f.businessName || undefined, nif: f.nif || undefined })
          .then(() => toast('Dados atualizados.'))
          .catch((err) => toast(errorText(err), 'error'));
      }}>
        <h2 className="text-xl font-bold">Dados pessoais</h2>
        <Field label="Nome completo" required error={errors.name}>{(p) => <input {...p} className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Email" hint="O email da conta não pode ser alterado aqui.">{(p) => <input {...p} type="email" className="input bg-cream" value={f.email} readOnly />}</Field>
          <Field label="Telefone" required error={errors.phone}>{(p) => <input {...p} type="tel" className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
        </div>
        {customer.type === 'revenda' && (
          <div className="grid sm:grid-cols-2 gap-5">
            <Field label="Empresa">{(p) => <input {...p} className="input" value={f.businessName} onChange={(e) => setF({ ...f, businessName: e.target.value })} />}</Field>
            <Field label="NIF">{(p) => <input {...p} className="input" inputMode="numeric" maxLength={9} value={f.nif} onChange={(e) => setF({ ...f, nif: e.target.value.replace(/\D/g, '') })} />}</Field>
          </div>
        )}
        <button type="submit" className="btn btn-primary w-fit">Guardar alterações</button>
      </form>
      {!customer.isAdmin && <DeleteAccount />}
    </div>
  );
}

function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <section className="panel p-6 grid gap-3 border-danger/30" aria-labelledby="apagar-conta">
      <h2 id="apagar-conta" className="text-lg font-bold">Apagar conta</h2>
      <p className="text-muted text-[0.95rem]">
        A sua conta, moradas e dados de perfil são apagados de forma permanente. As encomendas já feitas são mantidas, sem ligação à conta, porque a lei obriga a guardar os registos de faturação.
      </p>
      <button type="button" className="btn btn-outline text-danger w-fit" onClick={() => { setTyped(''); setOpen(true); }}><LuTrash2 aria-hidden />Apagar a minha conta</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Apagar a sua conta?" footer={
        <div className="flex justify-end gap-3 flex-wrap">
          <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button>
          <button type="button" className="btn btn-danger" disabled={typed.trim().toUpperCase() !== 'APAGAR' || busy} onClick={async () => {
            setBusy(true);
            try {
              await deleteMyAccount();
              toast('A sua conta foi apagada.', 'info');
              navigate('');
            } catch (e) {
              toast(errorText(e), 'error');
            } finally {
              setBusy(false);
            }
          }}>{busy ? 'A apagar…' : 'Apagar definitivamente'}</button>
        </div>
      }>
        <div className="grid gap-3 text-muted">
          <p>Esta ação não pode ser desfeita.</p>
          <Field label="Escreva APAGAR para confirmar" required>{(p) => <input {...p} className="input" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />}</Field>
        </div>
      </Modal>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel p-4">
      <p className="text-[0.85rem] text-muted">{label}</p>
      <p className="num font-display text-2xl font-bold text-brand-900 mt-1">{value}</p>
    </div>
  );
}

function OrdersList({ customer }: { customer: Customer }) {
  const orders = useOrders().filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const products = useProducts();
  if (!orders.length) {
    return (
      <EmptyState icon={<LuPackage />} title="Ainda não fez encomendas" action={<Link to="produtos" className="btn btn-primary">Ver produtos</Link>}>
        Quando fizer a sua primeira encomenda, vai encontrá-la aqui, com o estado e os detalhes da entrega.
      </EmptyState>
    );
  }
  return (
    <ul className="grid gap-3">
      {orders.map((o) => (
        <li key={o.id} className="panel p-4 sm:p-5 flex flex-wrap gap-4 justify-between items-center">
          <div className="min-w-0">
            <p className="font-bold num"><Link to={`conta-encomenda-${o.id}`} className="hover:text-brand-700 underline-offset-4 hover:underline">{o.number}</Link></p>
            <p className="text-[0.88rem] text-muted num">Feita a {formatDate(o.createdAt)} · entrega pedida para {formatDate(o.deliveryDate)}</p>
            <p className="text-[0.88rem] text-muted truncate">{o.lines.map((l) => l.productName).join(', ')}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <StatusBadge status={o.status} />
            <span className="num font-bold">{formatEuro(o.total)}</span>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => reorder(o, products)}><LuRepeat aria-hidden />Repetir</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function OrderDetail({ customer, id }: { customer: Customer; id: string }) {
  const order = useOrders().find((o) => o.id === id && o.customerId === customer.id);
  const products = useProducts();
  if (!order) return <EmptyState icon={<LuPackage />} title="Encomenda não encontrada" action={<Link to="conta-encomendas" className="btn btn-primary">Ver encomendas</Link>} />;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <Link to="conta-encomendas" className="btn btn-ghost btn-sm"><LuChevronLeft aria-hidden />Todas as encomendas</Link>
        <button type="button" className="btn btn-primary" onClick={() => reorder(order, products)}><LuRepeat aria-hidden />Encomendar novamente</button>
      </div>
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap justify-between gap-3 mb-4">
          <h2 className="text-xl font-bold num">{order.number}</h2>
          <span className="flex gap-2"><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} simulated={order.simulated} /></span>
        </div>
        <OrderLinesTable order={order} />
        <div className="mt-4"><OrderTotals order={order} /></div>
      </section>
      <OrderFacts order={order} />
      <section className="panel p-5">
        <h3 className="font-bold mb-3">Histórico</h3>
        <ol className="grid gap-2">
          {order.statusHistory.map((h, i) => (
            <li key={i} className="flex gap-3 items-center"><StatusBadge status={h.status} /><span className="text-muted num text-[0.9rem]">{formatDate(h.at)}</span></li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Addresses({ customer }: { customer: Customer }) {
  const empty = { label: '', street: '', extra: '', postalCode: '', city: '' };
  const [f, setF] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(customer.addresses.length === 0);
  const [toDelete, setToDelete] = useState<Address | null>(null);
  return (
    <div className="grid gap-5">
      {customer.addresses.length === 0 && !adding && <EmptyState icon={<LuMapPin />} title="Ainda não tem moradas guardadas" />}
      <ul className="grid sm:grid-cols-2 gap-4">
        {customer.addresses.map((a) => (
          <li key={a.id} className="panel p-5">
            <div className="flex justify-between gap-2">
              <p className="font-bold">{a.label}</p>
              <button type="button" className="icon-btn !w-9 !h-9 text-muted hover:text-danger" onClick={() => setToDelete(a)} aria-label={`Apagar morada ${a.label}`}><LuTrash2 aria-hidden /></button>
            </div>
            <p className="text-muted">{a.street}{a.extra ? `, ${a.extra}` : ''}</p>
            <p className="text-muted num">{a.postalCode} {a.city}</p>
          </li>
        ))}
      </ul>
      {adding ? (
        <form className="card p-6 grid gap-5" noValidate onSubmit={(e) => {
          e.preventDefault();
          const pc = normalizePostalCode(f.postalCode);
          const er: Record<string, string> = {};
          if (f.street.trim().length < 4) er.street = 'Indique a rua e o número.';
          if (!POSTAL_CODE_RE.test(pc)) er.postalCode = 'Use o formato 0000-000.';
          if (f.city.trim().length < 2) er.city = 'Indique a localidade.';
          setErrors(er);
          if (Object.keys(er).length) return;
          updateCustomer(customer.id, { addresses: [...customer.addresses, { id: uid('a-'), label: f.label.trim() || `Morada ${customer.addresses.length + 1}`, street: f.street.trim(), extra: f.extra.trim(), postalCode: pc, city: f.city.trim() }] })
            .then(() => { setF(empty); setAdding(false); toast('Morada guardada.'); })
            .catch((err) => toast(errorText(err), 'error'));
        }}>
          <h2 className="text-lg font-bold">Nova morada</h2>
          <Field label="Nome da morada" hint="Ex.: Casa, Café, Armazém">{(p) => <input {...p} className="input" value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} />}</Field>
          <Field label="Morada" required error={errors.street}>{(p) => <input {...p} className="input" autoComplete="street-address" value={f.street} onChange={(e) => setF({ ...f, street: e.target.value })} />}</Field>
          <Field label="Informações adicionais">{(p) => <input {...p} className="input" value={f.extra} onChange={(e) => setF({ ...f, extra: e.target.value })} />}</Field>
          <div className="grid sm:grid-cols-[200px_1fr] gap-5">
            <Field label="Código postal" required error={errors.postalCode}>{(p) => <input {...p} className="input num" inputMode="numeric" placeholder="0000-000" value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value })} />}</Field>
            <Field label="Localidade" required error={errors.city}>{(p) => <input {...p} className="input" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />}</Field>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="btn btn-primary">Guardar morada</button>
            {customer.addresses.length > 0 && <button type="button" className="btn btn-ghost" onClick={() => setAdding(false)}>Cancelar</button>}
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-outline w-fit" onClick={() => setAdding(true)}><LuPlus aria-hidden />Adicionar morada</button>
      )}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Apagar esta morada?" message={toDelete ? `${toDelete.label}: ${toDelete.street}` : ''} confirmLabel="Apagar morada"
        onConfirm={() => { if (toDelete) updateCustomer(customer.id, { addresses: customer.addresses.filter((a) => a.id !== toDelete.id) }).catch((err) => toast(errorText(err), 'error')); }} />
    </div>
  );
}
