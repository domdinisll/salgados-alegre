import type { PrepOptionDef, Settings } from '../types';

/**
 * Definições centrais da loja. Todos os valores abaixo são DADOS DE EXEMPLO
 * e podem ser alterados no painel de administração (Definições, Entregas, Preços).
 */

export const PREP_OPTIONS: PrepOptionDef[] = [
  {
    id: 'frito',
    label: 'Frito',
    short: 'Frito',
    description: 'Entregue já frito, pronto a comer ou servir.',
  },
  {
    id: 'congelado',
    label: 'Congelado para fritar',
    short: 'Congelado',
    description: 'Entregue congelado. Precisa de ser frito antes de consumir.',
  },
  {
    id: 'congelado_forno',
    label: 'Congelado para ir ao forno',
    short: 'Congelado',
    description: 'Entregue congelado. Vai ao forno antes de consumir.',
  },
  {
    id: 'pronto',
    label: 'Pronto a servir',
    short: 'Pronto',
    description: 'Entregue pronto a comer ou servir.',
  },
];

export const ORDER_STATUS_LABELS = {
  recebida: 'Recebida',
  em_preparacao: 'Em preparação',
  pronta_envio: 'Pronta para envio',
  em_distribuicao: 'Em distribuição',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
} as const;

export const PAYMENT_STATUS_LABELS = {
  pendente: 'Pendente',
  pago: 'Pago',
  falhado: 'Falhado',
  reembolsado: 'Reembolsado',
} as const;

export const CATEGORIES = ['Salgados grandes', 'Salgados médios', 'Salgados miniatura', 'Pão de queijo e empadas'];

export const DEFAULT_SETTINGS: Settings = {
  business: {
    name: 'Salgados Alegre',
    tagline: 'Salgados por grosso para casa e negócio',
    email: '',
    phone: '',
    address: '',
    nif: '',
    storeOpen: true,
    closedMessage: 'De momento não estamos a aceitar encomendas. Volte em breve.',
    currency: 'EUR',
    vatRate: 0, // por confirmar com o contabilista
    pricesIncludeVat: true,
  },
  delivery: {
    standardFee: 5,
    freeThreshold: 0, // 0 = sem entrega grátis
    minOrderAmount: 15,
    leadTimeDays: 2,
    cutoffHour: 15,
    weekdays: [1, 2, 3, 4, 5], // segunda a sexta
    blackoutDates: ['2026-12-25', '2027-01-01'],
    timeSlots: ['09:00 – 12:00', '12:00 – 15:00'],
    maxDaysAhead: 60,
    zones: [
      // Bandas de distância (linha reta) a partir de 2845-340 (Amora), por código postal (4 primeiros dígitos).
      { id: 'z20', name: 'Até 20 km', ranges: '1000-1999, 2650-2654, 2675-2679, 2700-2704, 2720-2724, 2730-2734, 2740-2749, 2780-2784, 2790-2799, 2800-2889, 2925-2929, 2950-2959, 2975-2979', fee: 5, enabled: true },
      { id: 'z30', name: '20 a 30 km', ranges: '2620-2629, 2645-2649, 2660-2664, 2670-2674, 2680-2699, 2725-2729, 2735-2739, 2750-2779, 2785-2789, 2890-2924, 2930-2949, 2970-2974', fee: 5, minOrder: 50, enabled: true },
      { id: 'z40', name: '30 a 40 km', ranges: '2600-2619, 2630-2639, 2665-2669, 2705-2719, 2960-2969', fee: 7, minOrder: 50, enabled: true },
      { id: 'z50', name: '40 a 50 km', ranges: '2130-2139, 2640-2644, 2655-2659, 2980-2999', fee: 9, minOrder: 50, enabled: true },
    ],
    restrictionsNote: 'Entregamos num raio de cerca de 50 km de Amora (Seixal), de segunda a sexta-feira.',
  },
  pricing: {
    wholesaleDiscountPct: 0, // sem desconto de revenda definido pelo negócio
    codes: [
      {
        id: 'c1',
        code: 'BEMVINDO10',
        type: 'percent',
        value: 10,
        minSubtotal: 20,
        active: true,
        validUntil: '2027-03-31',
        description: 'Código de exemplo: 10% na primeira encomenda.',
      },
      {
        id: 'c2',
        code: 'FESTA5',
        type: 'fixed',
        value: 5,
        minSubtotal: 50,
        active: true,
        validUntil: '',
        description: 'Código de exemplo: 5 € de desconto acima de 50 €.',
      },
    ],
  },
  sampleData: true,
};
