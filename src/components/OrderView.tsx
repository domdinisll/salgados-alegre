import type { Order } from '../types';
import { formatDateLong, formatDateTime, formatEuro } from '../lib/format';
import { PAYMENT_METHODS } from '../services/payments';
import { PaymentBadge, PrepBadge, StatusBadge } from './ui';
import { PaymentMark } from './PaymentMethodSelector';

export function OrderLinesTable({ order }: { order: Order }) {
  return (
    <div className="table-wrap">
      <table className="table num">
        <caption className="sr-only">Produtos da encomenda {order.number}</caption>
        <thead>
          <tr><th>Produto</th><th>Preparação</th><th>Quantidade</th><th>Preço/un.</th><th className="text-right">Total</th></tr>
        </thead>
        <tbody>
          {order.lines.map((l, i) => (
            <tr key={i}>
              <td className="font-semibold">{l.productName}</td>
              <td><PrepBadge prep={l.prep} /></td>
              <td className="whitespace-nowrap">{l.quantity} × pack de {l.packSize}<span className="block text-[0.8rem] text-muted">{l.units} unidades</span></td>
              <td>{formatEuro(l.unitPrice)}</td>
              <td className="text-right whitespace-nowrap">
                {formatEuro(l.total)}
                {l.discount > 0 && <span className="block text-[0.78rem] text-ok font-semibold">{l.discountLabel}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OrderTotals({ order }: { order: Order }) {
  const row = (k: string, v: string, cls = '') => (
    <div className={`flex justify-between gap-4 py-1 ${cls}`}><dt>{k}</dt><dd className="num">{v}</dd></div>
  );
  return (
    <dl className="text-[0.95rem] max-w-sm ml-auto">
      {row('Subtotal dos produtos', formatEuro(order.merchandiseSubtotal))}
      {order.productDiscounts > 0 && row('Descontos de quantidade', `−${formatEuro(order.productDiscounts)}`, 'text-ok')}
      {order.codeDiscount > 0 && row(`Código ${order.discountCode}`, `−${formatEuro(order.codeDiscount)}`, 'text-ok')}
      {row('Taxa de entrega', order.deliveryFee === 0 ? 'Grátis' : formatEuro(order.deliveryFee))}
      <div className="flex justify-between gap-4 pt-2 mt-1 border-t border-line font-extrabold text-lg"><dt>Total</dt><dd className="num">{formatEuro(order.total)}</dd></div>
    </dl>
  );
}

export function OrderFacts({ order }: { order: Order }) {
  const pm = PAYMENT_METHODS.find((m) => m.id === order.paymentMethod)!;
  return (
    <div className="grid sm:grid-cols-2 gap-5">
      <section className="panel p-5">
        <h3 className="font-bold mb-2">Entrega</h3>
        <p>{order.customer.name}{order.customer.businessName ? ` · ${order.customer.businessName}` : ''}</p>
        <p className="text-muted">{order.address.street}{order.address.extra ? `, ${order.address.extra}` : ''}</p>
        <p className="text-muted num">{order.address.postalCode} {order.address.city}</p>
        <p className="mt-3"><span className="font-semibold">Data pedida:</span> {formatDateLong(order.deliveryDate)}</p>
        {order.timeSlot && <p><span className="font-semibold">Horário:</span> <span className="num">{order.timeSlot}</span></p>}
        {order.instructions && <p className="text-muted mt-1">Instruções: {order.instructions}</p>}
      </section>
      <section className="panel p-5">
        <h3 className="font-bold mb-2">Estado e pagamento</h3>
        <dl className="grid gap-2">
          <div className="flex justify-between gap-3 items-center"><dt className="text-muted">Estado</dt><dd><StatusBadge status={order.status} /></dd></div>
          <div className="flex justify-between gap-3 items-center"><dt className="text-muted">Pagamento</dt><dd><PaymentBadge status={order.paymentStatus} simulated={order.simulated} /></dd></div>
          <div className="flex justify-between gap-3 items-center"><dt className="text-muted">Método</dt><dd className="flex items-center gap-2 font-semibold"><PaymentMark id={order.paymentMethod} />{pm.label}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Data da encomenda</dt><dd className="num">{formatDateTime(order.createdAt)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-muted">Contacto</dt><dd className="text-right">{order.customer.email}<br />{order.customer.phone}</dd></div>
        </dl>
      </section>
    </div>
  );
}
