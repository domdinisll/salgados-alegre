import { Fragment, useState } from 'react';
import { LuSearch, LuUsers, LuChevronDown } from 'react-icons/lu';
import { errorText, toast, useCustomers, useOrders } from '../state';
import { updateCustomer } from '../services/auth';
import { formatDate, formatEuro, normalize } from '../lib/format';
import { EmptyState, StatusBadge } from '../components/ui';
import { Link } from '../router';
import { AdminHeader } from './AdminApp';

export function CustomersAdmin() {
  const customers = useCustomers();
  const orders = useOrders();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'todos' | 'particular' | 'revenda' | 'pendentes'>('todos');
  const [open, setOpen] = useState<string | null>(null);
  const list = customers
    .filter((c) => (type === 'todos' || (type === 'pendentes' ? c.type === 'revenda' && !c.wholesaleApproved : c.type === type)) &&
      (!q || normalize(`${c.name} ${c.email} ${c.businessName ?? ''} ${c.nif ?? ''}`).includes(normalize(q))))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const pending = customers.filter((c) => c.type === 'revenda' && !c.wholesaleApproved).length;

  return (
    <>
      <AdminHeader title="Clientes">{customers.length} clientes registados · {pending} contas de revenda por aprovar</AdminHeader>
      <div className="panel p-4 mb-5 grid sm:grid-cols-[1fr_220px] gap-3 items-end">
        <div className="relative">
          <label htmlFor="ac-q" className="field-label">Pesquisar</label>
          <LuSearch className="absolute left-3 bottom-3.5 text-muted" aria-hidden />
          <input id="ac-q" type="search" className="input !pl-9" placeholder="Nome, email, empresa, NIF" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div>
          <label htmlFor="ac-t" className="field-label">Tipo</label>
          <select id="ac-t" className="input" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="todos">Todos</option><option value="particular">Particulares</option><option value="revenda">Revenda</option><option value="pendentes">Revenda por aprovar</option>
          </select>
        </div>
      </div>
      {list.length === 0 ? <EmptyState icon={<LuUsers />} title="Nenhum cliente encontrado" /> : (
        <div className="panel table-wrap">
          <table className="table num">
            <caption className="sr-only">Clientes</caption>
            <thead><tr><th>Cliente</th><th>Tipo</th><th>Encomendas</th><th>Total</th><th>Preço revenda</th><th><span className="sr-only">Detalhe</span></th></tr></thead>
            <tbody>
              {list.map((c) => {
                const os = orders.filter((o) => o.customerId === c.id);
                const isOpen = open === c.id;
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td className="min-w-56"><span className="font-semibold">{c.businessName || c.name}</span><span className="block text-[0.78rem] text-muted">{c.businessName ? `${c.name} · ` : ''}{c.email} · {c.phone}</span></td>
                      <td>{c.type === 'revenda' ? <span className="badge bg-brand-50 text-brand-700 ring-1 ring-brand-100">Revenda</span> : <span className="badge bg-cream-2 text-ink">Particular</span>}</td>
                      <td>{os.length}</td>
                      <td className="whitespace-nowrap">{formatEuro(os.filter((o) => o.status !== 'cancelada').reduce((s, o) => s + o.total, 0))}</td>
                      <td>
                        {c.type === 'revenda' ? (
                          <label className="inline-flex items-center gap-2 cursor-pointer whitespace-nowrap">
                            <input type="checkbox" role="switch" className="w-5 h-5 accent-brand-700" checked={c.wholesaleApproved}
                              onChange={(e) => { const on = e.target.checked; updateCustomer(c.id, { wholesaleApproved: on }).then(() => toast(on ? `Preço revenda ativado para ${c.businessName || c.name}.` : `Preço revenda desativado para ${c.businessName || c.name}.`)).catch((err) => toast(errorText(err), 'error')); }}
                              aria-label={`Preço revenda para ${c.businessName || c.name}`} />
                            <span className="text-[0.85rem]">{c.wholesaleApproved ? 'Aprovado' : 'Por aprovar'}</span>
                          </label>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td className="text-right">
                        <button type="button" className="btn btn-ghost btn-sm" aria-expanded={isOpen} aria-controls={`cl-${c.id}`} onClick={() => setOpen(isOpen ? null : c.id)}>
                          Histórico <LuChevronDown className={isOpen ? 'rotate-180' : ''} aria-hidden />
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr id={`cl-${c.id}`}>
                        <td colSpan={6} className="bg-cream">
                          <div className="grid md:grid-cols-[1fr_2fr] gap-4 py-2">
                            <dl className="text-[0.88rem] grid gap-1">
                              <div><dt className="inline text-muted">Cliente desde: </dt><dd className="inline">{formatDate(c.createdAt)}</dd></div>
                              {c.nif && <div><dt className="inline text-muted">NIF: </dt><dd className="inline">{c.nif}</dd></div>}
                              {c.addresses.map((a) => <div key={a.id}><dt className="inline text-muted">{a.label}: </dt><dd className="inline">{a.street}, {a.postalCode} {a.city}</dd></div>)}
                            </dl>
                            {os.length === 0 ? <p className="text-muted text-[0.9rem]">Sem encomendas.</p> : (
                              <ul className="grid gap-1.5 text-[0.9rem]">
                                {os.map((o) => (
                                  <li key={o.id} className="flex flex-wrap items-center gap-3">
                                    <Link to={`admin-encomenda-${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.number}</Link>
                                    <span className="text-muted">{formatDate(o.createdAt)}</span>
                                    <span>{formatEuro(o.total)}</span>
                                    <StatusBadge status={o.status} />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
