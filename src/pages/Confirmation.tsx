import { LuCircleCheck, LuSearchX } from 'react-icons/lu';
import { useCurrentCustomer, useOrders } from '../state';
import { EmptyState, Notice } from '../components/ui';
import { OrderFacts, OrderLinesTable, OrderTotals } from '../components/OrderView';
import { PaymentDetails } from '../components/PaymentDetails';
import { lastPlacedOrder } from '../services/orders';
import { formatDateLong } from '../lib/format';
import { Link } from '../router';

export function Confirmation({ id }: { id: string }) {
  const orders = useOrders();
  const customer = useCurrentCustomer();
  const last = lastPlacedOrder();
  const order = orders.find((o) => o.id === id) ?? (last?.id === id ? last : undefined);
  if (!order) {
    return (
      <div className="wrap py-16">
        <EmptyState icon={<LuSearchX />} title="Encomenda não encontrada" action={<Link to={customer ? 'conta-encomendas' : ''} className="btn btn-primary">{customer ? 'Ver as minhas encomendas' : 'Voltar ao início'}</Link>}>
          {customer ? 'Esta encomenda não está associada à sua conta.' : 'Para consultar encomendas anteriores, inicie sessão na sua conta.'}
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="wrap py-10 md:py-14 max-w-4xl">
      <div className="text-center mb-8">
        <span className="mx-auto w-16 h-16 rounded-full bg-ok-bg text-ok text-4xl flex items-center justify-center" aria-hidden><LuCircleCheck /></span>
        <p className="eyebrow mt-5">Encomenda recebida</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold text-brand-900" data-page-title tabIndex={-1}>Obrigado, {order.customer.name.split(' ')[0]}!</h1>
        <p className="mt-3 text-lg text-muted">
          Recebemos a sua encomenda <strong className="num text-ink">{order.number}</strong>, com entrega pedida para {formatDateLong(order.deliveryDate)}.
        </p>
      </div>

      <Notice tone="info" title="Próximos passos" className="mb-6">
        Enviámos para {order.customer.email} um email com o resumo da encomenda e os dados para pagamento. Confirmamos a encomenda e a data de entrega assim que recebermos o pagamento. Guarde o número da encomenda para qualquer contacto.
      </Notice>

      <div className="grid gap-6">
        <PaymentDetails order={order} />
        <section className="card p-5 sm:p-6">
          <h2 className="text-xl font-bold mb-4">Produtos encomendados</h2>
          <OrderLinesTable order={order} />
          <div className="mt-4"><OrderTotals order={order} /></div>
        </section>
        <OrderFacts order={order} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="produtos" className="btn btn-primary">Continuar a comprar</Link>
        {customer ? <Link to={`conta-encomenda-${order.id}`} className="btn btn-outline">Ver na minha conta</Link> : <Link to="registar" className="btn btn-outline">Criar conta para acompanhar encomendas</Link>}
      </div>
    </div>
  );
}
