import { useMemo, useState } from 'react';
import { LuChevronLeft, LuSearch, LuClipboardList } from 'react-icons/lu';
import type { OrderStatus } from '../types';
import { ORDER_STATUS_LABELS } from '../config/defaults';
import { toast, useOrders } from '../state';
import { addOrderNote, updateOrderStatus } from '../services/orders';
import { formatDate, formatDateTime, formatEuro, normalize } from '../lib/format';
import { Link } from '../router';
import { EmptyState, Notice, PaymentBadge, StatusBadge, ConfirmDialog } from '../components/ui';
import { OrderFacts, OrderLinesTable, OrderTotals } from '../components/OrderView';
import { AdminHeader } from './AdminApp';

const STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export function OrdersAdmin() {
  const orders = useOrders();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'todos' | OrderStatus>('todos');
  const [type, setType] = useState<'todos' | 'particular' | 'revenda'>('todos');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [dateField, setDateField] = useState<'deliveryDate' | 'createdAt'>('deliveryDate');

  const list = useMemo(() => {
    const nq = normalize(q);
    return orders
      .filter((o) => {
        const d = dateField === 'createdAt' ? o.createdAt.slice(0, 10) : o.deliveryDate;
        return (status === 'todos' || o.status === status) &&
          (type === 'todos' || o.customer.type === type) &&
          (!from || d >= from) && (!to || d <= to) &&
          (!nq || normalize(`${o.number} ${o.customer.name} ${o.customer.email} ${o.customer.businessName ?? ''} ${o.address.city}`).includes(nq));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [orders, q, status, type, from, to, dateField]);

  const counts = Object.fromEntries(STATUSES.map((s) => [s, orders.filter((o) => o.status === s).length]));
  const clear = () => { setQ(''); setStatus('todos'); setType('todos'); setFrom(''); setTo(''); };

  return (
    <>
      <AdminHeader title="Encomendas">{orders.length} encomendas no total</AdminHeader>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" role="group" aria-label="Filtrar por estado">
        {(['todos', ...STATUSES] as const).map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[0.86rem] font-semibold border-[1.5px] ${status === s ? 'bg-brand-700 border-brand-700 text-white' : 'bg-paper border-line hover:border-brand-200'}`}>
            {s === 'todos' ? 'Todas' : ORDER_STATUS_LABELS[s]} <span className="num opacity-70">({s === 'todos' ? orders.length : counts[s]})</span>
          </button>
        ))}
      </div>
      <div className="panel p-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] mb-5 items-end">
        <div className="relative">
          <label htmlFor="ao-q" className="field-label">Pesquisar</label>
          <LuSearch className="absolute left-3 bottom-3.5 text-muted" aria-hidden />
          <input id="ao-q" type="search" className="input !pl-9" placeholder="N.º, cliente, email, localidade" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ao-tipo" className="field-label">Cliente</label>
          <select id="ao-tipo" className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="todos">Todos</option><option value="particular">Particulares</option><option value="revenda">Revenda</option>
          </select>
        </div>
        <div>
          <label htmlFor="ao-campo" className="field-label">Filtrar data de</label>
          <select id="ao-campo" className="input" value={dateField} onChange={(e) => setDateField(e.target.value as typeof dateField)}>
            <option value="deliveryDate">Entrega pedida</option><option value="createdAt">Criação</option>
          </select>
        </div>
        <div>
          <label htmlFor="ao-de" className="field-label">De</label>
          <input id="ao-de" type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ao-ate" className="field-label">Até</label>
          <input id="ao-ate" type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<LuClipboardList />} title="Nenhuma encomenda com estes filtros" action={<button type="button" className="btn btn-primary" onClick={clear}>Limpar filtros</button>} />
      ) : (
        <div className="panel table-wrap">
          <table className="table num">
            <caption className="sr-only">Lista de encomendas</caption>
            <thead><tr><th>Encomenda</th><th>Cliente</th><th>Entrega pedida</th><th>Morada</th><th>Total</th><th>Estado</th><th>Pagamento</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td className="whitespace-nowrap"><Link to={`admin-encomenda-${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.number}</Link><span className="block text-[0.78rem] text-muted">{formatDateTime(o.createdAt)}</span></td>
                  <td className="min-w-44">{o.customer.businessName || o.customer.name}<span className="block text-[0.78rem] text-muted">{o.customer.type === 'revenda' ? 'Revenda' : 'Particular'} · {o.customer.email}</span></td>
                  <td className="whitespace-nowrap">{formatDate(o.deliveryDate)}<span className="block text-[0.78rem] text-muted">{o.timeSlot}</span></td>
                  <td className="min-w-40">{o.address.city}<span className="block text-[0.78rem] text-muted">{o.address.postalCode}</span></td>
                  <td className="whitespace-nowrap font-semibold">{formatEuro(o.total)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><PaymentBadge status={o.paymentStatus} simulated={o.simulated} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function OrderAdminDetail({ id }: { id: string }) {
  const order = useOrders().find((o) => o.id === id);
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [note, setNote] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  if (!order) return <EmptyState icon={<LuClipboardList />} title="Encomenda não encontrada" action={<Link to="admin-encomendas" className="btn btn-primary">Ver encomendas</Link>} />;
  const selected = status || order.status;
  const apply = () => { updateOrderStatus(order.id, selected as OrderStatus); setStatus(''); toast(`Estado alterado para «${ORDER_STATUS_LABELS[selected as OrderStatus]}».`); };

  return (
    <>
      <Link to="admin-encomendas" className="btn btn-ghost btn-sm mb-3 -ml-2"><LuChevronLeft aria-hidden />Encomendas</Link>
      <AdminHeader title={`Encomenda ${order.number}`} actions={<><StatusBadge status={order.status} /><PaymentBadge status={order.paymentStatus} simulated={order.simulated} /></>}>
        Criada a {formatDateTime(order.createdAt)} · {order.customer.type === 'revenda' ? 'Cliente de revenda' : 'Cliente particular'}
      </AdminHeader>
      <div className="grid xl:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="grid gap-6 min-w-0">
          <section className="panel p-5">
            <h2 className="font-bold text-lg mb-3">Produtos</h2>
            <OrderLinesTable order={order} />
            <div className="mt-4"><OrderTotals order={order} /></div>
          </section>
          <OrderFacts order={order} />
          {order.simulated && <Notice tone="warn">Pagamento simulado. O estado do pagamento só deve mudar para «Pago» com confirmação verificada do fornecedor de pagamentos, por isso não é editável aqui.</Notice>}
        </div>
        <div className="grid gap-6">
          <section className="panel p-5 grid gap-3">
            <h2 className="font-bold text-lg">Atualizar estado</h2>
            <label htmlFor="estado" className="sr-only">Novo estado</label>
            <select id="estado" className="input" value={selected} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
              {STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
            </select>
            <button type="button" className="btn btn-primary" disabled={selected === order.status} onClick={() => (selected === 'cancelada' ? setConfirmCancel(true) : apply())}>Guardar estado</button>
            <ol className="grid gap-2 mt-2 pt-3 border-t border-line">
              {order.statusHistory.map((h, i) => (
                <li key={i} className="flex justify-between gap-2 items-center"><StatusBadge status={h.status} /><span className="text-[0.82rem] text-muted num">{formatDateTime(h.at)}</span></li>
              ))}
            </ol>
          </section>
          <section className="panel p-5 grid gap-3">
            <h2 className="font-bold text-lg">Notas internas</h2>
            <p className="text-[0.82rem] text-muted -mt-2">Visíveis apenas para a equipa.</p>
            {order.notes.length === 0 ? <p className="text-muted text-[0.92rem]">Sem notas.</p> : (
              <ul className="grid gap-2">
                {order.notes.map((n, i) => <li key={i} className="rounded-xl bg-cream p-3 text-[0.92rem]">{n.text}<span className="block text-[0.75rem] text-muted mt-1 num">{formatDateTime(n.at)}</span></li>)}
              </ul>
            )}
            <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; addOrderNote(order.id, note.trim()); setNote(''); toast('Nota adicionada.'); }}>
              <label htmlFor="nota" className="sr-only">Nova nota</label>
              <textarea id="nota" className="input" rows={3} placeholder="Escreva uma nota para a equipa" value={note} onChange={(e) => setNote(e.target.value)} />
              <button type="submit" className="btn btn-outline" disabled={!note.trim()}>Adicionar nota</button>
            </form>
          </section>
        </div>
      </div>
      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancelar esta encomenda?" confirmLabel="Cancelar encomenda"
        message={`A encomenda ${order.number} passa para o estado «Cancelada». O cliente deve ser informado. Num sistema real, um eventual reembolso seria tratado no fornecedor de pagamentos.`} onConfirm={apply} />
    </>
  );
}
