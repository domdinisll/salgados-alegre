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
    id: 'pronto',
    label: 'Pronto a servir',
    short: 'Pronto',
    description: 'Preço único. Entregue pronto a servir.',
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
    freeThreshold: 30,
    minOrderAmount: 15,
    leadTimeDays: 2,
    cutoffHour: 16,
    weekdays: [2, 3, 4, 5, 6], // terça a sábado
    blackoutDates: ['2026-12-25', '2027-01-01'],
    timeSlots: ['09:00 – 12:00', '12:00 – 15:00', '15:00 – 19:00'],
    maxDaysAhead: 60,
    zones: [
      { id: 'z1', name: 'Margem Sul (exemplo)', ranges: '2800-2899', fee: 4.5, enabled: true },
      { id: 'z2', name: 'Lisboa (exemplo)', ranges: '1000-1999', fee: 6, enabled: true },
      { id: 'z3', name: 'Setúbal e Palmela (exemplo)', ranges: '2900-2959', fee: 6.5, enabled: true },
    ],
    restrictionsNote: 'Entregas apenas em Portugal Continental, nas zonas configuradas.',
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
