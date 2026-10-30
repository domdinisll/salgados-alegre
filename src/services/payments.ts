import type { Order, PaymentMethodId } from '../types';

/**
 * Arquitetura de pagamentos modular.
 * Cada método é servido por um `PaymentProvider`. Na demonstração, todos usam o
 * `SimulatedProvider`, que NÃO processa pagamentos nem recolhe dados de cartão.
 *
 * Para produção:
 *  - escolher um fornecedor com suporte para Portugal (Multibanco, MB WAY, cartões e carteiras digitais);
 *  - criar o pagamento NO SERVIDOR, com o total recalculado pelo servidor;
 *  - recolher dados de cartão apenas nos campos/página alojados pelo fornecedor;
 *  - marcar a encomenda como "Pago" só após um webhook assinado e verificado.
 */

export interface PaymentMethodInfo {
  id: PaymentMethodId;
  label: string;
  short: string;
  description: string;
  /** Nota sobre requisitos técnicos de disponibilidade. */
  availabilityNote?: string;
}

export const PAYMENT_METHODS: PaymentMethodInfo[] = [
  { id: 'mbway', label: 'MB WAY', short: 'MB WAY', description: 'Confirme o pagamento na app MB WAY com o seu número de telemóvel.' },
  { id: 'multibanco', label: 'Multibanco', short: 'MB', description: 'Receba uma entidade e referência para pagar no multibanco ou homebanking.' },
  { id: 'cartao', label: 'Cartão de crédito ou débito', short: 'Cartão', description: 'Visa, Mastercard e outros cartões, numa página segura do fornecedor de pagamentos.' },
  { id: 'applepay', label: 'Apple Pay', short: 'Apple Pay', description: 'Pagamento rápido em dispositivos Apple compatíveis.', availabilityNote: 'Disponível apenas no Safari e em dispositivos Apple compatíveis, depois de configurado com o fornecedor de pagamentos.' },
  { id: 'googlepay', label: 'Google Pay', short: 'Google Pay', description: 'Pagamento rápido com a sua conta Google.', availabilityNote: 'Disponível apenas em navegadores e dispositivos compatíveis, depois de configurado com o fornecedor de pagamentos.' },
  { id: 'paypal', label: 'PayPal', short: 'PayPal', description: 'Pague com a sua conta PayPal.' },
];

export interface PaymentStartResult {
  kind: 'simulated';
  /** Texto a mostrar ao cliente sobre o que aconteceria num pagamento real. */
  realWorldNote: string;
}

export interface PaymentProvider {
  id: string;
  supports(method: PaymentMethodId): boolean;
  /** Em produção: chamada ao servidor que cria a intenção de pagamento. */
  start(order: Order): Promise<PaymentStartResult>;
}

const REAL_WORLD_NOTES: Record<PaymentMethodId, string> = {
  mbway: 'Num pagamento real, receberia um pedido de pagamento na app MB WAY para aprovar.',
  multibanco: 'Num pagamento real, seriam geradas uma entidade e uma referência Multibanco para pagar.',
  cartao: 'Num pagamento real, seria redirecionado para a página segura do fornecedor de pagamentos para introduzir os dados do cartão.',
  applepay: 'Num pagamento real, seria aberta a folha de pagamento Apple Pay do seu dispositivo.',
  googlepay: 'Num pagamento real, seria aberta a janela de pagamento Google Pay.',
  paypal: 'Num pagamento real, seria redirecionado para o PayPal para concluir o pagamento.',
};

export const SimulatedProvider: PaymentProvider = {
  id: 'simulado',
  supports: () => true,
  async start(order) {
    await new Promise((r) => setTimeout(r, 900));
    return { kind: 'simulated', realWorldNote: REAL_WORLD_NOTES[order.paymentMethod] };
  },
};

export function providerFor(method: PaymentMethodId): PaymentProvider {
  // Ponto único para ligar fornecedores reais por método.
  return [SimulatedProvider].find((p) => p.supports(method))!;
}

export function realWorldNote(method: PaymentMethodId): string {
  return REAL_WORLD_NOTES[method];
}
