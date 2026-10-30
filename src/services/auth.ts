import type { Customer, CustomerType } from '../types';
import { customersStore, loadUserData, profileStore } from '../state';
import { api } from './repository';
import { sendPasswordReset, signIn, signOut, signUp, updatePassword } from './supabase';

/**
 * Autenticação real com o Supabase Auth. As palavras-passe nunca passam pelo nosso código
 * para além do envio direto ao Supabase, que as guarda com hash.
 */

export function passwordProblems(pw: string): string | null {
  if (pw.length < 8) return 'A palavra-passe deve ter pelo menos 8 caracteres.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Use letras e números na palavra-passe.';
  return null;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  type: CustomerType;
  businessName?: string;
  businessContact?: string;
  nif?: string;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : 'Não foi possível concluir o pedido.');

export async function register(input: RegisterInput): Promise<{ ok: true; confirmEmail: boolean } | { ok: false; error: string }> {
  try {
    const r = await signUp(input.email.trim().toLowerCase(), input.password, {
      name: input.name.trim(),
      phone: input.phone.trim(),
      type: input.type,
      businessName: input.businessName?.trim() || undefined,
      businessContact: input.businessContact?.trim() || undefined,
      nif: input.nif?.trim() || undefined,
    });
    if (!r.confirmEmail) await loadUserData();
    return { ok: true, confirmEmail: r.confirmEmail };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function login(email: string, password: string): Promise<{ ok: true; customer: Customer | null } | { ok: false; error: string }> {
  try {
    await signIn(email.trim().toLowerCase(), password);
    await loadUserData();
    return { ok: true, customer: profileStore.get() };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function logout() {
  await signOut();
  await loadUserData();
}

export async function requestPasswordReset(email: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await sendPasswordReset(email.trim().toLowerCase());
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

export async function resetPassword(password: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await updatePassword(password);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: msg(e) };
  }
}

/** Atualiza um perfil (o próprio, ou qualquer um se for administrador). */
export async function updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer> {
  const updated = await api.updateProfile(id, patch);
  if (profileStore.get()?.id === id) profileStore.set(updated);
  customersStore.set((cs) => cs.map((c) => (c.id === id ? updated : c)));
  return updated;
}
