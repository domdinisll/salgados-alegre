import type { Customer, Order, Product, Settings } from '../types';
import { DEFAULT_SETTINGS } from '../config/defaults';
import { SAMPLE_PRODUCTS } from '../data/products';
import { SAMPLE_CUSTOMERS, buildSampleOrders } from '../data/seed';
import { readJSON, removeAll, writeJSON } from './storage';

/**
 * Camada de acesso a dados. A interface `Repository` é o contrato que um backend real
 * (API REST, Supabase, Prisma + PostgreSQL, etc.) deve implementar. A implementação abaixo
 * usa o armazenamento local do navegador apenas para demonstração.
 */
export interface Repository {
  loadProducts(): Product[];
  saveProducts(p: Product[]): void;
  loadSettings(): Settings;
  saveSettings(s: Settings): void;
  loadCustomers(): Customer[];
  saveCustomers(c: Customer[]): void;
  loadOrders(): Order[];
  saveOrders(o: Order[]): void;
  nextOrderSeq(): number;
  reset(): void;
}

class LocalDemoRepository implements Repository {
  loadProducts() {
    return readJSON<Product[] | null>('products', null) ?? structuredClone(SAMPLE_PRODUCTS);
  }
  saveProducts(p: Product[]) {
    writeJSON('products', p);
  }
  loadSettings() {
    const s = readJSON<Settings | null>('settings', null);
    return s ? { ...DEFAULT_SETTINGS, ...s } : structuredClone(DEFAULT_SETTINGS);
  }
  saveSettings(s: Settings) {
    writeJSON('settings', s);
  }
  loadCustomers() {
    return readJSON<Customer[] | null>('customers', null) ?? structuredClone(SAMPLE_CUSTOMERS);
  }
  saveCustomers(c: Customer[]) {
    writeJSON('customers', c);
  }
  loadOrders() {
    const o = readJSON<Order[] | null>('orders', null);
    if (o) return o;
    const seeded = buildSampleOrders(this.loadProducts(), this.loadSettings(), this.loadCustomers(), new Date());
    writeJSON('orders', seeded);
    return seeded;
  }
  saveOrders(o: Order[]) {
    writeJSON('orders', o);
  }
  nextOrderSeq() {
    const n = readJSON<number>('orderSeq', 1041) + 1;
    writeJSON('orderSeq', n);
    return n;
  }
  reset() {
    removeAll();
  }
}

export const repository: Repository = new LocalDemoRepository();
