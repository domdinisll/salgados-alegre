import type { PaymentMethodId } from '../types';

/**
 * Métodos de pagamento.
 * No lançamento a loja usa PAGAMENTO APÓS CONFIRMAÇÃO: o cliente faz a encomenda, a loja confirma
 * e envia os dados para pagamento por MB WAY ou transferência. O estado «Pago» é marcado no painel
 * pela loja, depois de verificar o pagamento.
 *
 * Para ativar pagamentos online (Multibanco, MB WAY automático, cartões, carteiras digitais):
 * contratar um fornecedor de pagamentos, criar o pagamento NO SERVIDOR e marcar «Pago» apenas
 * por webhook verificado. Depois, acrescentar o método a LIVE_PAYMENT_METHODS e à função
 * place_order (supabase/schema.sql).
 */

export interface PaymentMethodInfo {
  id: PaymentMethodId;
  label: string;
  description: string;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { id: 'mbway', label: 'MB WAY', description: 'Recebe por email o número MB WAY para pagar.' },
  { id: 'transferencia', label: 'Transferência bancária', description: 'Recebe por email o IBAN para transferência.' },
  { id: 'multibanco', label: 'Multibanco', description: 'Pagamento por referência Multibanco.' },
  { id: 'cartao', label: 'Cartão de crédito ou débito', description: 'Pagamento com cartão.' },
  { id: 'applepay', label: 'Apple Pay', description: 'Pagamento com Apple Pay.' },
  { id: 'googlepay', label: 'Google Pay', description: 'Pagamento com Google Pay.' },
  { id: 'paypal', label: 'PayPal', description: 'Pagamento com PayPal.' },
];

/** Métodos disponíveis na loja neste momento (têm de coincidir com place_order no servidor). */
export const LIVE_PAYMENT_METHODS: PaymentMethodId[] = ['mbway', 'transferencia'];

export function paymentLabel(id: PaymentMethodId): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? id;
}

export function paymentNextStep(id: PaymentMethodId): string {
  if (id === 'mbway') return 'Depois de encomendar, recebe por email o número MB WAY e o valor a pagar. Confirmamos a encomenda e a data de entrega assim que recebermos o pagamento.';
  if (id === 'transferencia') return 'Depois de encomendar, recebe por email o IBAN e o valor a pagar. Confirmamos a encomenda e a data de entrega assim que recebermos o pagamento.';
  return 'Vamos confirmar a sua encomenda e indicar-lhe como pagar.';
}
