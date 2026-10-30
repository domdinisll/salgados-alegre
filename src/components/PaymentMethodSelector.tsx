import { LuCreditCard, LuSmartphone, LuLandmark, LuWallet } from 'react-icons/lu';
import type { ReactNode } from 'react';
import type { PaymentMethodId } from '../types';
import { LIVE_PAYMENT_METHODS, PAYMENT_METHODS } from '../services/payments';

// Marcas textuais neutras (os logótipos oficiais seguem as regras de cada marca).
const MARK: Record<PaymentMethodId, ReactNode> = {
  mbway: <span className="font-black tracking-tight text-[0.8rem]">MB<span className="text-danger">WAY</span></span>,
  transferencia: <LuLandmark aria-hidden className="text-xl" />,
  multibanco: <LuLandmark aria-hidden className="text-xl" />,
  cartao: <LuCreditCard aria-hidden className="text-xl" />,
  applepay: <LuSmartphone aria-hidden className="text-xl" />,
  googlepay: <LuWallet aria-hidden className="text-xl" />,
  paypal: <span className="font-black italic text-[0.85rem] text-info">PayPal</span>,
};

export function PaymentMark({ id }: { id: PaymentMethodId }) {
  return <span className="w-14 h-10 shrink-0 rounded-lg border border-line bg-paper inline-flex items-center justify-center text-ink">{MARK[id]}</span>;
}

export function PaymentMethodSelector({ value, onChange, error }: { value: PaymentMethodId | ''; onChange: (m: PaymentMethodId) => void; error?: string }) {
  const methods = PAYMENT_METHODS.filter((m) => LIVE_PAYMENT_METHODS.includes(m.id));
  return (
    <fieldset aria-describedby={error ? 'pm-erro' : undefined}>
      <legend className="field-label !text-base mb-3">Como prefere pagar?</legend>
      <div className="grid sm:grid-cols-2 gap-3">
        {methods.map((m) => (
          <label key={m.id} className={`flex gap-3 items-start rounded-2xl border-2 p-4 cursor-pointer transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${value === m.id ? 'border-brand-600 bg-brand-50' : 'border-line bg-paper hover:border-brand-200'}`}>
            <input type="radio" name="metodo-pagamento" value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} className="sr-only" />
            <PaymentMark id={m.id} />
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-bold">
                {m.label}
                {value === m.id && <span className="badge bg-brand-700 text-white !text-[0.7rem]">Selecionado</span>}
              </span>
              <span className="block text-[0.85rem] text-muted mt-0.5">{m.description}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p id="pm-erro" className="field-error" role="alert">{error}</p>}
    </fieldset>
  );
}
