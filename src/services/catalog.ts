import type { Product, Settings } from '../types';
import { productsStore, settingsStore } from '../state';
import { api } from './repository';

export async function saveProduct(p: Product) {
  const list = productsStore.get();
  const idx = list.findIndex((x) => x.id === p.id);
  const sort = idx >= 0 ? idx : list.length;
  await api.saveProduct(p, sort);
  productsStore.set((ps) => (idx >= 0 ? ps.map((x) => (x.id === p.id ? p : x)) : [...ps, p]));
}

export async function deleteProduct(id: string) {
  await api.deleteProduct(id);
  productsStore.set((ps) => ps.filter((p) => p.id !== id));
}

export async function saveSettings(s: Settings) {
  await api.saveSettings(s);
  settingsStore.set(s);
}
