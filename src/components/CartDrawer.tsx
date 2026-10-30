import { LuShoppingBasket } from 'react-icons/lu';
import { Modal, EmptyState } from './ui';
import { CartLine, FreeDeliveryProgress, TotalsTable } from './CartParts';
import { useCartTotals } from '../state';
import { Link, navigate } from '../router';

export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useCartTotals();
  const empty = t.lines.length === 0;
  return (
    <Modal
      open={open}
      onClose={onClose}
      side
      title={empty ? 'Carrinho' : `Carrinho (${t.itemCount} ${t.itemCount === 1 ? 'pack' : 'packs'})`}
      footer={
        empty ? undefined : (
          <div className="grid gap-3">
            <TotalsTable t={t} />
            <div className="grid grid-cols-2 gap-2">
              <Link to="carrinho" onClick={onClose} className="btn btn-outline">Ver carrinho</Link>
              <button type="button" className="btn btn-primary" disabled={!t.canCheckout} onClick={() => { onClose(); navigate('finalizar'); }}>
                Finalizar encomenda
              </button>
            </div>
            {!t.canCheckout && <p className="text-[0.85rem] text-danger">{t.errors[0]}</p>}
          </div>
        )
      }
    >
      {empty ? (
        <EmptyState icon={<LuShoppingBasket />} title="O seu carrinho está vazio" action={<Link to="produtos" onClick={onClose} className="btn btn-primary">Ver produtos</Link>}>
          Escolha os seus salgados, o tamanho do pack e a preparação.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          <FreeDeliveryProgress t={t} />
          {t.lines.map((l) => <CartLine key={l.item.key} line={l} compact onNavigate={onClose} />)}
        </div>
      )}
    </Modal>
  );
}
