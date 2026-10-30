import type { Customer, Order, OrderStatus, PaymentStatus, Product, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../config/defaults';
import type { OrderInput } from '../lib/orders';
import { rest, rpc } from './supabase';

/**
 * Acesso a dados (Supabase). A segurança é garantida na base de dados (Row Level Security):
 * clientes só leem as suas encomendas; só administradores alteram produtos, definições e encomendas;
 * as encomendas só são criadas pela função place_order, que recalcula todos os preços no servidor.
 */

interface ProductRow { id: string; data: Product; sort: number }
interface ProfileRow {
  id: string; email: string | null; name: string; phone: string; type: 'particular' | 'revenda';
  business_name: string | null; business_contact: string | null; nif: string | null;
  wholesale_approved: boolean; is_admin: boolean; addresses: Customer['addresses']; created_at: string;
}
interface OrderRow { data: Order; status: OrderStatus; payment_status: PaymentStatus }

const enc = encodeURIComponent;

function toCustomer(r: ProfileRow): Customer {
  return {
    id: r.id, email: r.email ?? '', name: r.name, phone: r.phone, type: r.type,
    businessName: r.business_name ?? undefined, businessContact: r.business_contact ?? undefined, nif: r.nif ?? undefined,
    wholesaleApproved: r.wholesale_approved, isAdmin: r.is_admin, addresses: r.addresses ?? [], createdAt: r.created_at,
  };
}

function toProfilePatch(p: Partial<Customer>): Partial<ProfileRow> {
  const out: Partial<ProfileRow> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.phone !== undefined) out.phone = p.phone;
  if (p.businessName !== undefined) out.business_name = p.businessName || null;
  if (p.businessContact !== undefined) out.business_contact = p.businessContact || null;
  if (p.nif !== undefined) out.nif = p.nif || null;
  if (p.addresses !== undefined) out.addresses = p.addresses;
  if (p.wholesaleApproved !== undefined) out.wholesale_approved = p.wholesaleApproved;
  return out;
}

function mergeSettings(s: Partial<Settings>): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    business: { ...DEFAULT_SETTINGS.business, ...(s.business ?? {}) },
    delivery: { ...DEFAULT_SETTINGS.delivery, ...(s.delivery ?? {}) },
    pricing: { ...DEFAULT_SETTINGS.pricing, ...(s.pricing ?? {}) },
  };
}

export const api = {
  async loadProducts(): Promise<Product[]> {
    const rows = await rest<ProductRow[]>('/products?select=id,data,sort&order=sort.asc');
    return rows.map((r) => ({ ...r.data, id: r.id }));
  },
  async saveProduct(p: Product, sort: number): Promise<void> {
    await rest('/products?on_conflict=id', { method: 'POST', body: { id: p.id, data: p, sort, updated_at: new Date().toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' });
  },
  async deleteProduct(id: string): Promise<void> {
    await rest(`/products?id=eq.${enc(id)}`, { method: 'DELETE', prefer: 'return=minimal' });
  },
  async loadSettings(): Promise<Settings> {
    const rows = await rest<{ data: Settings }[]>('/settings?select=data&id=eq.1');
    return mergeSettings(rows[0]?.data ?? {});
  },
  async saveSettings(s: Settings): Promise<void> {
    const rows = await rest<unknown[]>('/settings?id=eq.1', { method: 'PATCH', body: { data: s, updated_at: new Date().toISOString() }, prefer: 'return=representation' });
    if (!rows?.length) throw new Error('Sem permissão para alterar as definições.');
  },
  async loadProfile(id: string): Promise<Customer | null> {
    const rows = await rest<ProfileRow[]>(`/profiles?select=*&id=eq.${enc(id)}`);
    return rows[0] ? toCustomer(rows[0]) : null;
  },
  async loadProfiles(): Promise<Customer[]> {
    const rows = await rest<ProfileRow[]>('/profiles?select=*&order=created_at.desc');
    return rows.map(toCustomer);
  },
  async updateProfile(id: string, patch: Partial<Customer>): Promise<Customer> {
    const rows = await rest<ProfileRow[]>(`/profiles?id=eq.${enc(id)}`, { method: 'PATCH', body: toProfilePatch(patch), prefer: 'return=representation' });
    if (!rows?.length) throw new Error('Não foi possível guardar as alterações.');
    return toCustomer(rows[0]);
  },
  async loadOrders(): Promise<Order[]> {
    const rows = await rest<OrderRow[]>('/orders?select=data,status,payment_status&order=created_at.desc&limit=1000');
    return rows.map((r) => ({ ...r.data, status: r.status, paymentStatus: r.payment_status }));
  },
  async updateOrder(o: Order): Promise<void> {
    const rows = await rest<unknown[]>(`/orders?id=eq.${enc(o.id)}`, { method: 'PATCH', body: { status: o.status, payment_status: o.paymentStatus, data: o }, prefer: 'return=representation' });
    if (!rows?.length) throw new Error('Sem permissão para alterar esta encomenda.');
  },
  async placeOrder(input: OrderInput): Promise<Order> {
    return rpc<Order>('place_order', {
      input: {
        items: input.items.map(({ productId, packSize, quantity, prep }) => ({ productId, packSize, quantity, prep })),
        discountCode: input.discountCode,
        customer: input.customer,
        address: input.address,
        deliveryDate: input.deliveryDate,
        timeSlot: input.timeSlot,
        instructions: input.instructions,
        paymentMethod: input.paymentMethod,
      },
    });
  },
};
