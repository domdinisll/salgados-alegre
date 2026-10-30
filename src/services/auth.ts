import type { Customer, CustomerType } from '../types';
import { customersStore, sessionStore } from '../state';
import { uid } from '../lib/format';

/**
 * AUTENTICAÇÃO DE DEMONSTRAÇÃO.
 * As palavras-passe nunca são guardadas em texto simples: é guardado um hash PBKDF2-SHA256
 * com sal aleatório. Mas tudo acontece no navegador, por isso NÃO é segurança de produção.
 * Em produção, substituir este módulo por um fornecedor de autenticação ou por autenticação
 * no servidor (sessões httpOnly, limitação de tentativas, verificação de email, etc.).
 */

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  if (!globalThis.crypto?.subtle) throw new Error('crypto-indisponivel');
  const salt = saltHex ?? toHex(crypto.getRandomValues(new Uint8Array(16)));
  const saltBytes = new Uint8Array(salt.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: saltBytes, iterations: 120000, hash: 'SHA-256' }, key, 256);
  return { hash: toHex(bits), salt };
}

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

export type AuthResult = { ok: true; customer: Customer } | { ok: false; error: string };

export async function register(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();
  if (customersStore.get().some((c) => c.email.toLowerCase() === email)) {
    return { ok: false, error: 'Já existe uma conta com este email. Inicie sessão ou recupere a palavra-passe.' };
  }
  const { hash, salt } = await hashPassword(input.password);
  const customer: Customer = {
    id: uid('cu-'),
    name: input.name.trim(),
    email,
    phone: input.phone.trim(),
    type: input.type,
    businessName: input.businessName?.trim() || undefined,
    businessContact: input.businessContact?.trim() || undefined,
    nif: input.nif?.trim() || undefined,
    // Contas de revenda ficam pendentes até aprovação no painel de administração.
    wholesaleApproved: false,
    addresses: [],
    createdAt: new Date().toISOString(),
    passwordHash: hash,
    passwordSalt: salt,
  };
  customersStore.set((cs) => [...cs, customer]);
  sessionStore.set((s) => ({ ...s, customerId: customer.id }));
  return { ok: true, customer };
}

export async function login(emailRaw: string, password: string): Promise<AuthResult> {
  const email = emailRaw.trim().toLowerCase();
  const c = customersStore.get().find((x) => x.email.toLowerCase() === email);
  const generic = 'Email ou palavra-passe incorretos.';
  if (!c) return { ok: false, error: generic };
  if (!c.passwordHash || !c.passwordSalt) {
    // Clientes de exemplo não têm palavra-passe: entrada direta apenas no modo demonstração.
    if (c.sampleData) {
      sessionStore.set((s) => ({ ...s, customerId: c.id }));
      return { ok: true, customer: c };
    }
    return { ok: false, error: generic };
  }
  const { hash } = await hashPassword(password, c.passwordSalt);
  if (hash !== c.passwordHash) return { ok: false, error: generic };
  sessionStore.set((s) => ({ ...s, customerId: c.id }));
  return { ok: true, customer: c };
}

export function logout() {
  sessionStore.set((s) => ({ ...s, customerId: null }));
}

// Tokens de recuperação apenas em memória (demonstração). Em produção: token aleatório com
// validade curta, guardado com hash no servidor e enviado por email.
const resetTokens = new Map<string, { email: string; expires: number }>();

export function requestPasswordReset(emailRaw: string): string | null {
  const email = emailRaw.trim().toLowerCase();
  const exists = customersStore.get().some((c) => c.email.toLowerCase() === email && c.passwordHash);
  if (!exists) return null;
  const token = toHex(crypto.getRandomValues(new Uint8Array(12)));
  resetTokens.set(token, { email, expires: Date.now() + 30 * 60e3 });
  return token;
}

export async function resetPassword(token: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const t = resetTokens.get(token);
  if (!t || t.expires < Date.now()) return { ok: false, error: 'Este link de recuperação é inválido ou expirou. Peça um novo.' };
  const { hash, salt } = await hashPassword(password);
  customersStore.set((cs) => cs.map((c) => (c.email.toLowerCase() === t.email ? { ...c, passwordHash: hash, passwordSalt: salt } : c)));
  resetTokens.delete(token);
  return { ok: true };
}

export function updateCustomer(id: string, patch: Partial<Customer>) {
  customersStore.set((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
}
