import type { Order } from '../types';
import { useSettings } from '../state';
import { formatEuro } from '../lib/format';

/** Dados para pagar a encomenda (MB WAY ou transferência), conforme definidos no painel. */
export function PaymentDetails({ order }: { order: Order }) {
  const pay = useSettings().payment;
  const mbway = order.paymentMethod === 'mbway' && pay.mbwayPhone.trim();
  const transfer = order.paymentMethod === 'transferencia' && pay.iban.trim();
  if (!mbway && !transfer) return null;
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="pd-h">
      <h2 id="pd-h" className="text-xl font-bold mb-4">Como pagar</h2>
      <dl className="grid sm:grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[0.95rem] num">
        <dt className="text-muted">Valor</dt><dd className="font-bold">{formatEuro(order.total)}</dd>
        {mbway ? (
          <><dt className="text-muted">MB WAY para</dt><dd className="font-semibold select-all">{pay.mbwayPhone}</dd></>
        ) : (
          <>
            <dt className="text-muted">IBAN</dt><dd className="font-semibold select-all break-all">{pay.iban}</dd>
            {pay.accountHolder && <><dt className="text-muted">Titular</dt><dd>{pay.accountHolder}</dd></>}
          </>
        )}
        <dt className="text-muted">Referência</dt><dd className="font-semibold select-all">{order.number}</dd>
      </dl>
      {pay.note && <p className="mt-3 text-[0.9rem] text-muted">{pay.note}</p>}
    </section>
  );
}
