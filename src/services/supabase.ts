import { SUPABASE_KEY, SUPABASE_URL } from '../config/backend';

/**
 * Cliente mínimo para o Supabase (Auth + REST), sem dependências.
 * A sessão do utilizador fica guardada no navegador; os dados ficam na base de dados.
 */

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // segundos desde epoch
  user: { id: string; email: string };
}

const SESSION_KEY = 'salgados-alegre:sessao';
/** "Manter sessão iniciada": guardar no localStorage (persiste) ou no sessionStorage (até fechar o navegador). */
let persistent = true;
let session: Session | null = load();
const listeners = new Set<(s: Session | null) => void>();

function load(): Session | null {
  try {
    const local = window.localStorage.getItem(SESSION_KEY);
    if (local) return JSON.parse(local) as Session;
    const temp = window.sessionStorage.getItem(SESSION_KEY);
    if (temp) {
      persistent = false;
      return JSON.parse(temp) as Session;
    }
    return null;
  } catch {
    return null;
  }
}

function save(s: Session | null) {
  session = s;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.sessionStorage.removeItem(SESSION_KEY);
    if (s) (persistent ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* ignorar */
  }
  listeners.forEach((f) => f(s));
}

export function onSessionChange(f: (s: Session | null) => void) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export function currentSession() {
  return session;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou palavra-passe incorretos.',
  'Invalid login credentials': 'Email ou palavra-passe incorretos.',
  user_already_exists: 'Já existe uma conta com este email. Inicie sessão ou recupere a palavra-passe.',
  'User already registered': 'Já existe uma conta com este email. Inicie sessão ou recupere a palavra-passe.',
  email_not_confirmed: 'Confirme o seu email antes de iniciar sessão. Verifique a sua caixa de correio.',
  'Email not confirmed': 'Confirme o seu email antes de iniciar sessão. Verifique a sua caixa de correio.',
  weak_password: 'A palavra-passe é demasiado fraca. Use pelo menos 8 caracteres, com letras e números.',
  over_email_send_rate_limit: 'Foram enviados demasiados emails. Tente novamente daqui a alguns minutos.',
  over_request_rate_limit: 'Demasiadas tentativas. Aguarde um pouco e tente novamente.',
  same_password: 'A nova palavra-passe tem de ser diferente da anterior.',
};

async function parseError(res: Response): Promise<ApiError> {
  let body: Record<string, string> = {};
  try {
    body = await res.json();
  } catch {
    /* sem corpo */
  }
  const key = body.error_code || body.code || body.msg || body.error_description || body.message || '';
  const msg = AUTH_MESSAGES[key] || AUTH_MESSAGES[body.msg] || AUTH_MESSAGES[body.message]
    // Erros das funções da base de dados já vêm em português (código P0001).
    || (body.code === 'P0001' ? body.message : '')
    || (res.status >= 500 ? 'O serviço está temporariamente indisponível. Tente novamente dentro de momentos.' : 'Não foi possível concluir o pedido. Tente novamente.');
  return new ApiError(msg, res.status);
}

async function refresh(): Promise<void> {
  if (!session) return;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    save(null);
    return;
  }
  setSessionFromToken(await res.json());
}

function setSessionFromToken(t: { access_token: string; refresh_token: string; expires_in?: number; expires_at?: number; user?: { id: string; email: string } }) {
  const expires_at = t.expires_at ?? Math.floor(Date.now() / 1000) + (t.expires_in ?? 3600);
  save({ access_token: t.access_token, refresh_token: t.refresh_token, expires_at, user: { id: t.user?.id ?? '', email: t.user?.email ?? '' } });
}

async function authHeaders(): Promise<Record<string, string>> {
  if (session && session.expires_at - 60 < Date.now() / 1000) await refresh();
  const h: Record<string, string> = { apikey: SUPABASE_KEY };
  if (session) h.Authorization = `Bearer ${session.access_token}`;
  return h;
}

/** Pedido à API REST (PostgREST). `path` começa por "/" e é relativo a /rest/v1. */
export async function rest<T>(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { ...(await authHeaders()), 'Content-Type': 'application/json' };
  if (init.prefer) headers.Prefer = init.prefer;
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch {
    throw new ApiError('Sem ligação à internet. Verifique a ligação e tente novamente.', 0);
  }
  if (res.status === 401 && session) {
    await refresh();
  }
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

export function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  return rest<T>(`/rpc/${fn}`, { method: 'POST', body: args });
}

// ---------------- Autenticação ----------------

async function authCall(path: string, body: unknown, method = 'POST', withSession = false) {
  const headers: Record<string, string> = withSession ? await authHeaders() : { apikey: SUPABASE_KEY };
  headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/auth/v1${path}`, { method, headers, body: JSON.stringify(body) });
  } catch {
    throw new ApiError('Sem ligação à internet. Verifique a ligação e tente novamente.', 0);
  }
  if (!res.ok) throw await parseError(res);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export function siteUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

export async function signUp(email: string, password: string, data: Record<string, unknown>): Promise<{ confirmEmail: boolean }> {
  const r = await authCall(`/signup?redirect_to=${encodeURIComponent(siteUrl())}`, { email, password, data });
  if (r?.access_token) {
    setSessionFromToken(r);
    return { confirmEmail: false };
  }
  return { confirmEmail: true };
}

export async function signIn(email: string, password: string, remember = true) {
  persistent = remember;
  const r = await authCall('/token?grant_type=password', { email, password });
  setSessionFromToken(r);
}

export async function signOut() {
  try {
    if (session) await authCall('/logout', {}, 'POST', true);
  } catch {
    /* sair localmente mesmo assim */
  }
  save(null);
}

export async function sendPasswordReset(email: string) {
  await authCall(`/recover?redirect_to=${encodeURIComponent(siteUrl())}`, { email });
}

export async function updatePassword(password: string) {
  await authCall('/user', { password }, 'PUT', true);
}

/**
 * Os links enviados por email (confirmação de conta, recuperação de palavra-passe) voltam ao site
 * com os tokens no endereço (#access_token=…&type=recovery). Lê-os, cria a sessão e limpa o endereço.
 * Devolve o tipo de link ('recovery', 'signup', …) ou null.
 */
export function consumeAuthRedirect(): string | null {
  const h = window.location.hash.replace(/^#/, '');
  if (!h.includes('access_token=') && !h.includes('error_description=')) return null;
  const p = new URLSearchParams(h);
  if (p.get('error_description')) {
    history.replaceState(null, '', window.location.pathname);
    return 'erro';
  }
  setSessionFromToken({
    access_token: p.get('access_token')!,
    refresh_token: p.get('refresh_token') ?? '',
    expires_in: Number(p.get('expires_in') ?? 3600),
    user: { id: '', email: '' },
  });
  const type = p.get('type') ?? 'login';
  history.replaceState(null, '', window.location.pathname);
  return type;
}

export async function fetchUser(): Promise<{ id: string; email: string } | null> {
  if (!session) return null;
  try {
    const u = await authCall('/user', undefined, 'GET', true).catch(async (e: ApiError) => {
      if (e.status === 401) await refresh();
      throw e;
    });
    if (u?.id && session) save({ ...session, user: { id: u.id, email: u.email } });
    return u ? { id: u.id, email: u.email } : null;
  } catch {
    return null;
  }
}

// ---------------- Início de sessão com Google / Apple ----------------

export type OAuthProvider = 'google' | 'apple';

/** Lê no Supabase que fornecedores externos estão ativos (os botões só aparecem se estiverem). */
export async function enabledProviders(): Promise<Record<OAuthProvider, boolean>> {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    const j = await r.json();
    return { google: !!j?.external?.google, apple: !!j?.external?.apple };
  } catch {
    return { google: false, apple: false };
  }
}

/** Redireciona para o fornecedor; ao voltar, a sessão chega no endereço (tratada em consumeAuthRedirect). */
export function signInWithProvider(provider: OAuthProvider) {
  persistent = true;
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(siteUrl())}`;
}
