// Modelo de dados partilhado. Pensado para mapear 1:1 para tabelas numa base de dados real
// (products, customers, orders, order_items, settings, discount_codes, delivery_zones).

export type PrepOptionId = 'frito' | 'congelado' | 'pronto';

export interface PrepOptionDef {
  id: PrepOptionId;
  label: string;
  /** Rótulo curto para botões compactos. */
  short: string;
  description: string;
}

export interface ProductPrepConfig {
  enabled: boolean;
  /** Preço por unidade (salgado individual) para esta preparação, em euros. */
  unitPrice: number;
}

export interface PriceTier {
  /** Número mínimo de unidades (salgados) na linha para aplicar o desconto. */
  minUnits: number;
  discountPct: number;
  label: string;
}

export type Availability = 'disponivel' | 'stock_limitado' | 'esgotado' | 'brevemente';

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  /** Ingredientes / alergénios. Vazio = por confirmar pelo negócio. */
  ingredients: string;
  allergens: string;
  /** Tamanhos de pack disponíveis (unidades por pack). */
  packSizes: number[];
  /** Quantidade mínima de unidades por linha de encomenda. */
  minOrderUnits: number;
  prep: Record<PrepOptionId, ProductPrepConfig>;
  tiers: PriceTier[];
  availability: Availability;
  /** Stock em unidades. null = não controlado. */
  stock: number | null;
  active: boolean;
  featured: boolean;
  resale: boolean;
  wholesaleOnly: boolean;
  /** Ilustração de demonstração usada quando não existe imagem. */
  art: string;
  imageUrl?: string;
  sampleData: boolean;
}

export interface CartItem {
  key: string;
  productId: string;
  packSize: number;
  /** Número de packs. */
  quantity: number;
  prep: PrepOptionId;
}

export type CustomerType = 'particular' | 'revenda';

export interface Address {
  id: string;
  label: string;
  street: string;
  extra: string;
  postalCode: string;
  city: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: CustomerType;
  businessName?: string;
  businessContact?: string;
  nif?: string;
  wholesaleApproved: boolean;
  isAdmin?: boolean;
  addresses: Address[];
  createdAt: string;
  /** Hash PBKDF2 (demonstração). Nunca guardamos palavras-passe em texto simples. */
  passwordHash?: string;
  passwordSalt?: string;
  sampleData?: boolean;
}

export type OrderStatus =
  | 'recebida'
  | 'em_preparacao'
  | 'pronta_envio'
  | 'em_distribuicao'
  | 'entregue'
  | 'cancelada';

export type PaymentStatus = 'pendente' | 'pago' | 'falhado' | 'reembolsado';

export type PaymentMethodId = 'transferencia' | 'multibanco' | 'mbway' | 'cartao' | 'applepay' | 'googlepay' | 'paypal';

export interface OrderLine {
  productId: string;
  productName: string;
  packSize: number;
  quantity: number;
  units: number;
  prep: PrepOptionId;
  unitPrice: number;
  gross: number;
  discount: number;
  discountLabel: string;
  total: number;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  customerId: string | null;
  customer: { name: string; email: string; phone: string; type: CustomerType; businessName?: string; nif?: string };
  lines: OrderLine[];
  address: Omit<Address, 'id' | 'label'>;
  zoneName: string;
  deliveryDate: string; // AAAA-MM-DD
  timeSlot: string;
  instructions: string;
  merchandiseSubtotal: number;
  productDiscounts: number;
  codeDiscount: number;
  discountCode: string | null;
  deliveryFee: number;
  total: number;
  paymentMethod: PaymentMethodId;
  paymentStatus: PaymentStatus;
  /** true quando o pagamento é apenas uma simulação de demonstração. */
  simulated: boolean;
  status: OrderStatus;
  statusHistory: { status: OrderStatus; at: string }[];
  notes: { text: string; at: string }[];
  sampleData?: boolean;
}

export interface DeliveryZone {
  id: string;
  name: string;
  /** Intervalos de códigos postais (4 primeiros dígitos), ex.: "2800-2899". */
  ranges: string;
  fee: number;
  enabled: boolean;
}

export interface DiscountCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotal: number;
  active: boolean;
  validUntil: string; // AAAA-MM-DD ou ''
  description: string;
}

export interface Settings {
  business: {
    name: string;
    tagline: string;
    email: string;
    phone: string;
    address: string;
    nif: string;
    storeOpen: boolean;
    closedMessage: string;
    currency: 'EUR';
    vatRate: number;
    pricesIncludeVat: boolean;
  };
  delivery: {
    standardFee: number;
    freeThreshold: number;
    minOrderAmount: number;
    leadTimeDays: number;
    cutoffHour: number;
    weekdays: number[]; // 0 = domingo
    blackoutDates: string[];
    timeSlots: string[];
    maxDaysAhead: number;
    zones: DeliveryZone[];
    restrictionsNote: string;
  };
  pricing: {
    wholesaleDiscountPct: number;
    codes: DiscountCode[];
  };
  sampleData: boolean;
}
