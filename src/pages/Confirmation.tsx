import { LuCircleCheck, LuSearchX } from 'react-icons/lu';
import { useCurrentCustomer, useOrders } from '../state';
import { EmptyState, Notice } from '../components/ui';
import { OrderFacts, OrderLinesTable, OrderTotals } from '../components/OrderView';
import { realWorldNote } from '../services/payments';
import { formatDateLong } from '../lib/format';
import { Link } from '../router';

export function Confirmation({ id }: { id: string }) {
  const order = useOrders().find((o) => o.id === id);
  const customer = useCurrentCustomer();
  if (!order) {
    return (
      <div className="wrap py-16">
        <EmptyState icon={<LuSearchX />} title="Encomenda não encontrada" action={<Link to="" className="btn btn-primary">Voltar ao início</Link>}>
          Não encontrámos esta encomenda neste navegador.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="wrap py-10 md:py-14 max-w-4xl">
      <div className="text-center mb-8">
        <span className="mx-auto w-16 h-16 rounded-full bg-ok-bg text-ok text-4xl flex items-center justify-center" aria-hidden><LuCircleCheck /></span>
        <p className="eyebrow mt-5">Encomenda confirmada · simulação</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-extrabold text-brand-900" data-page-title tabIndex={-1}>Obrigado, {order.customer.name.split(' ')[0]}!</h1>
        <p className="mt-3 text-lg text-muted">
          Registámos a sua encomenda <strong className="num text-ink">{order.number}</strong> com entrega pedida para {formatDateLong(order.deliveryDate)}.
        </p>
      </div>

      <Notice tone="warn" title="Demonstração: nenhum pagamento foi efetuado" className="mb-6">
        Esta encomenda foi criada num ambiente de demonstração. O pagamento está «Pendente» e é apenas simulado. {realWorldNote(order.paymentMethod)} A data de entrega é um pedido e seria confirmada pela equipa.
      </Notice>

      <div className="grid gap-6">
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
