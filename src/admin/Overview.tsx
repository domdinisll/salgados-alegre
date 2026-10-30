import { LuArrowRight } from 'react-icons/lu';
import { useOrders, useProducts } from '../state';
import { formatDate, formatDateLong, formatEuro, parseISODate, toISODate, WEEKDAYS_SHORT } from '../lib/format';
import { Link } from '../router';
import { StatusBadge } from '../components/ui';
import { AdminHeader } from './AdminApp';
import type { OrderStatus } from '../types';

const OPEN: OrderStatus[] = ['recebida', 'em_preparacao', 'pronta_envio', 'em_distribuicao'];

export function Overview() {
  const orders = useOrders();
  const products = useProducts();
  const valid = orders.filter((o) => o.status !== 'cancelada');
  const pending = orders.filter((o) => OPEN.includes(o.status));
  const completed = orders.filter((o) => o.status === 'entregue');
  const sales = valid.reduce((s, o) => s + o.total, 0);
  const recent = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const today = new Date();
  const next7 = Array.from({ length: 7 }, (_, i) => toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + i)));
  const upcoming = next7.map((d) => ({ d, list: pending.filter((o) => o.deliveryDate === d) }));
  const maxDay = Math.max(1, ...upcoming.map((u) => u.list.length));
  const lowStock = products.filter((p) => p.active && (p.availability === 'esgotado' || p.availability === 'stock_limitado'));
  const unitsByPrep = valid.flatMap((o) => o.lines).reduce((acc, l) => ({ ...acc, [l.prep]: (acc[l.prep] ?? 0) + l.units }), {} as Record<string, number>);

  const kpis = [
    { label: 'Total de encomendas', value: String(orders.length), hint: `${orders.filter((o) => o.status === 'cancelada').length} canceladas` },
    { label: 'Encomendas em curso', value: String(pending.length), hint: `${orders.filter((o) => o.status === 'recebida').length} por começar`, attention: orders.some((o) => o.status === 'recebida') },
    { label: 'Encomendas entregues', value: String(completed.length), hint: 'Concluídas' },
    { label: 'Valor encomendado', value: formatEuro(sales), hint: `${formatEuro(valid.filter((o) => o.paymentStatus === 'pago').reduce((s, o) => s + o.total, 0))} já pago` },
  ];

  return (
    <>
      <AdminHeader title="Resumo">{formatDateLong(toISODate(today))}</AdminHeader>
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className={`panel p-5 ${k.attention ? 'ring-2 ring-accent-400' : ''}`}>
            <p className="text-[0.88rem] text-muted">{k.label}</p>
            <p className="num font-display text-3xl font-extrabold text-brand-900 mt-1">{k.value}</p>
            <p className="text-[0.8rem] text-muted mt-1">{k.attention && <span className="badge bg-accent-500 text-brand-900 !py-0 mr-1.5">Atenção</span>}{k.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-[1.6fr_1fr] gap-6">
        <section className="panel min-w-0" aria-labelledby="recentes">
          <div className="flex justify-between items-center p-5 pb-3">
            <h2 id="recentes" className="font-bold text-lg">Encomendas recentes</h2>
            <Link to="admin-encomendas" className="btn btn-ghost btn-sm">Ver todas <LuArrowRight aria-hidden /></Link>
          </div>
          <div className="table-wrap">
            <table className="table num">
              <thead><tr><th>Encomenda</th><th>Cliente</th><th>Entrega</th><th>Total</th><th>Estado</th></tr></thead>
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap"><Link to={`admin-encomenda-${o.id}`} className="font-semibold text-brand-700 hover:underline">{o.number}</Link><span className="block text-[0.78rem] text-muted">{formatDate(o.createdAt)}</span></td>
                    <td className="min-w-40">{o.customer.businessName || o.customer.name}<span className="block text-[0.78rem] text-muted">{o.customer.type === 'revenda' ? 'Revenda' : 'Particular'}</span></td>
                    <td className="whitespace-nowrap">{formatDate(o.deliveryDate)}</td>
                    <td className="whitespace-nowrap font-semibold">{formatEuro(o.total)}</td>
                    <td><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-6 content-start">
          <section className="panel p-5" aria-labelledby="proximas">
            <h2 id="proximas" className="font-bold text-lg mb-4">Entregas nos próximos 7 dias</h2>
            <ul className="grid gap-2.5">
              {upcoming.map(({ d, list }) => {
                const date = parseISODate(d);
                return (
                  <li key={d} className="grid grid-cols-[70px_1fr_auto] items-center gap-3">
                    <span className="text-[0.85rem] whitespace-nowrap"><span className="font-semibold">{WEEKDAYS_SHORT[date.getDay()]}</span> <span className="num text-muted">{formatDate(d).slice(0, 5)}</span></span>
                    <span className="h-2.5 rounded-full bg-cream-2 overflow-hidden" aria-hidden>
                      <span className="block h-full rounded-full bg-brand-600" style={{ width: `${(list.length / maxDay) * 100}%` }} />
                    </span>
                    <span className="num text-[0.88rem] font-semibold w-24 text-right">{list.length === 0 ? '—' : `${list.length} ${list.length === 1 ? 'entrega' : 'entregas'}`}</span>
                  </li>
                );
              })}
            </ul>
            {upcoming.some((u) => u.list.length) && (
              <ul className="mt-4 pt-4 border-t border-line grid gap-2 text-[0.88rem]">
                {upcoming.flatMap((u) => u.list).slice(0, 5).map((o) => (
                  <li key={o.id} className="flex justify-between gap-3">
                    <Link to={`admin-encomenda-${o.id}`} className="font-semibold text-brand-700 hover:underline num">{o.number}</Link>
                    <span className="text-muted truncate">{formatDate(o.deliveryDate).slice(0, 5)} · {o.address.city}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel p-5" aria-labelledby="atencao">
            <h2 id="atencao" className="font-bold text-lg mb-3">Stock a acompanhar</h2>
            {lowStock.length === 0 ? <p className="text-muted text-[0.92rem]">Todos os produtos ativos estão disponíveis.</p> : (
              <ul className="grid gap-2 text-[0.92rem]">
                {lowStock.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <Link to={`admin-produto-${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                    <span className="num text-muted">{p.availability === 'esgotado' ? 'Esgotado' : `${p.stock ?? '—'} un.`}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 pt-4 border-t border-line text-[0.85rem] text-muted num">
              Unidades encomendadas: {(unitsByPrep.frito ?? 0).toLocaleString('pt-PT')} fritas · {(unitsByPrep.congelado ?? 0).toLocaleString('pt-PT')} congeladas · {(unitsByPrep.pronto ?? 0).toLocaleString('pt-PT')} prontas
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
