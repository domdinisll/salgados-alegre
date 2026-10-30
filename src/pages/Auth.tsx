import { useState, type FormEvent, type ReactNode } from 'react';
import { LuEye, LuEyeOff } from 'react-icons/lu';
import type { CustomerType } from '../types';
import { Field, Notice } from '../components/ui';
import { login, passwordProblems, register, requestPasswordReset, resetPassword } from '../services/auth';
import { validateCustomerInfo, validateNif } from '../lib/orders';
import { toast, useCustomers } from '../state';
import { Link, navigate } from '../router';

function AuthShell({ title, intro, children, footer }: { title: string; intro?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="wrap py-12 md:py-16">
      <div className="max-w-lg mx-auto">
        <h1 className="text-3xl md:text-4xl font-extrabold text-brand-900" data-page-title tabIndex={-1}>{title}</h1>
        {intro && <p className="mt-2 text-muted">{intro}</p>}
        <Notice tone="warn" className="mt-5" title="Modo de demonstração">
          As contas ficam guardadas apenas neste navegador. A palavra-passe é guardada como hash, mas isto não é autenticação segura de produção.
        </Notice>
        <div className="card p-6 sm:p-8 mt-6">{children}</div>
        {footer && <div className="mt-6 text-center text-muted">{footer}</div>}
      </div>
    </div>
  );
}

function PasswordInput(props: { id: string; value: string; onChange: (v: string) => void; autoComplete: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={props.id} type={show ? 'text' : 'password'} className="input !pr-12" value={props.value} onChange={(e) => props.onChange(e.target.value)} autoComplete={props.autoComplete} aria-invalid={props['aria-invalid']} aria-describedby={props['aria-describedby']} />
      <button type="button" className="icon-btn absolute right-0.5 top-1/2 -translate-y-1/2 !w-10 !h-10 text-muted" onClick={() => setShow((s) => !s)} aria-label={show ? 'Esconder palavra-passe' : 'Mostrar palavra-passe'} aria-pressed={show}>
        {show ? <LuEyeOff aria-hidden /> : <LuEye aria-hidden />}
      </button>
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const sample = useCustomers().filter((c) => c.sampleData);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await login(email, pw).catch(() => ({ ok: false as const, error: 'O seu navegador não suporta a autenticação de demonstração.' }));
    setBusy(false);
    if (!r.ok) return setError(r.error);
    toast(`Sessão iniciada. Olá, ${r.customer.name.split(' ')[0]}!`);
    navigate('conta');
  }

  return (
    <AuthShell title="Iniciar sessão" intro="Aceda às suas encomendas, moradas e preços de revenda." footer={<>Ainda não tem conta? <Link to="registar" className="font-semibold text-brand-700 underline underline-offset-4">Criar conta</Link></>}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Email" required>{(p) => <input {...p} type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label="Palavra-passe" required>{(p) => <PasswordInput {...p} value={pw} onChange={setPw} autoComplete="current-password" />}</Field>
        <div className="flex justify-between items-center gap-3 flex-wrap">
          <Link to="recuperar" className="text-[0.92rem] font-semibold text-brand-700 underline underline-offset-4">Esqueceu-se da palavra-passe?</Link>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'A entrar…' : 'Iniciar sessão'}</button>
        </div>
      </form>
      {sample.length > 0 && (
        <div className="mt-8 pt-6 border-t border-line">
          <p className="font-semibold mb-1">Experimentar com uma conta de exemplo</p>
          <p className="text-[0.85rem] text-muted mb-3">Apenas na demonstração: entra sem palavra-passe.</p>
          <div className="grid gap-2">
            {sample.map((c) => (
              <button key={c.id} type="button" className="btn btn-outline justify-between" onClick={async () => { await login(c.email, ''); toast(`Sessão de exemplo: ${c.name}`); navigate('conta'); }}>
                <span className="truncate">{c.name}</span>
                <span className="badge bg-cream-2 text-ink">{c.type === 'revenda' ? (c.wholesaleApproved ? 'Revenda aprovada' : 'Revenda pendente') : 'Particular'}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthShell>
  );
}

export function RegisterPage() {
  const [f, setF] = useState({ name: '', email: '', phone: '', password: '', confirm: '', type: 'particular' as CustomerType, businessName: '', businessContact: '', nif: '', privacy: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = { ...validateCustomerInfo(f) };
    const pp = passwordProblems(f.password);
    if (pp) er.password = pp;
    if (f.password !== f.confirm) er.confirm = 'As palavras-passe não coincidem.';
    if (f.type === 'revenda' && f.nif && !validateNif(f.nif)) er.nif = 'O NIF indicado não é válido.';
    if (!f.privacy) er.privacy = 'Para criar conta, aceite a política de privacidade.';
    setErrors(er);
    if (Object.keys(er).length) {
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    const r = await register(f).catch(() => ({ ok: false as const, error: 'O seu navegador não suporta a autenticação de demonstração.' }));
    setBusy(false);
    if (!r.ok) return setFormError(r.error);
    toast('Conta criada com sucesso.');
    navigate('conta');
  }

  return (
    <AuthShell title="Criar conta" intro="Guarde moradas, consulte encomendas e repita pedidos com facilidade." footer={<>Já tem conta? <Link to="entrar" className="font-semibold text-brand-700 underline underline-offset-4">Iniciar sessão</Link></>}>
      <form onSubmit={submit} noValidate className="grid gap-5">
        {formError && <Notice tone="error">{formError}</Notice>}
        <fieldset>
          <legend className="field-label">Que tipo de cliente é?</legend>
          <div className="grid grid-cols-2 gap-2">
            {(['particular', 'revenda'] as const).map((t) => (
              <label key={t} className={`rounded-xl border-2 px-4 py-3 cursor-pointer has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500 ${f.type === t ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
                <input type="radio" name="tipo-cliente" className="sr-only" checked={f.type === t} onChange={() => set('type', t)} />
                <span className="block font-semibold">{t === 'particular' ? 'Particular' : 'Empresa / revenda'}</span>
                <span className="block text-[0.82rem] text-muted">{t === 'particular' ? 'Para casa e festas' : 'Cafés, restaurantes, lojas'}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Nome completo" required error={errors.name}>{(p) => <input {...p} className="input" autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} />}</Field>
        <Field label="Email" required error={errors.email}>{(p) => <input {...p} type="email" className="input" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} />}</Field>
        <Field label="Telefone" required error={errors.phone}>{(p) => <input {...p} type="tel" className="input" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} />}</Field>
        {f.type === 'revenda' && (
          <div className="grid gap-5 rounded-2xl bg-brand-50 p-4">
            <p className="text-[0.9rem] text-brand-800">Contas de revenda são revistas pela nossa equipa. Depois de aprovadas, passam a ver os preços de revenda.</p>
            <Field label="Nome da empresa">{(p) => <input {...p} className="input" autoComplete="organization" value={f.businessName} onChange={(e) => set('businessName', e.target.value)} />}</Field>
            <Field label="Pessoa de contacto da empresa">{(p) => <input {...p} className="input" value={f.businessContact} onChange={(e) => set('businessContact', e.target.value)} />}</Field>
            <Field label="NIF" error={errors.nif}>{(p) => <input {...p} className="input" inputMode="numeric" maxLength={9} value={f.nif} onChange={(e) => set('nif', e.target.value.replace(/\D/g, ''))} />}</Field>
          </div>
        )}
        <Field label="Palavra-passe" required error={errors.password} hint="Pelo menos 8 caracteres, com letras e números.">{(p) => <PasswordInput {...p} value={f.password} onChange={(v) => set('password', v)} autoComplete="new-password" />}</Field>
        <Field label="Confirmar palavra-passe" required error={errors.confirm}>{(p) => <PasswordInput {...p} value={f.confirm} onChange={(v) => set('confirm', v)} autoComplete="new-password" />}</Field>
        <div>
          <label className="inline-flex items-start gap-2.5 text-[0.95rem]">
            <input type="checkbox" className="w-5 h-5 mt-0.5 accent-brand-700 shrink-0" checked={f.privacy} onChange={(e) => set('privacy', e.target.checked)} aria-invalid={!!errors.privacy} />
            <span>Li a <Link to="info-privacidade" className="font-semibold underline underline-offset-2">política de privacidade</Link> e aceito o tratamento dos meus dados para gerir a conta e as encomendas.</span>
          </label>
          {errors.privacy && <p className="field-error">{errors.privacy}</p>}
        </div>
        <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>{busy ? 'A criar conta…' : 'Criar conta'}</button>
      </form>
    </AuthShell>
  );
}

export function ForgotPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<null | { token: string | null }>(null);
  return (
    <AuthShell title="Recuperar palavra-passe" intro="Indique o email da sua conta. Enviaremos um link para definir uma nova palavra-passe.">
      {done ? (
        <div className="grid gap-4">
          <Notice tone="success">Se existir uma conta com o email indicado, receberá um link para definir uma nova palavra-passe.</Notice>
          {done.token && (
            <Notice tone="info" title="Apenas na demonstração">
              O envio de emails ainda não está ligado. Use este link para continuar: <Link to={`redefinir-${done.token}`} className="font-semibold underline underline-offset-2">definir nova palavra-passe</Link>.
            </Notice>
          )}
          <Link to="entrar" className="btn btn-outline w-fit">Voltar a iniciar sessão</Link>
        </div>
      ) : (
        <form noValidate className="grid gap-5" onSubmit={(e) => { e.preventDefault(); setDone({ token: requestPasswordReset(email) }); }}>
          <Field label="Email" required>{(p) => <input {...p} type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <button type="submit" className="btn btn-primary">Enviar link de recuperação</button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPage({ token }: { token: string }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  return (
    <AuthShell title="Definir nova palavra-passe">
      <form noValidate className="grid gap-5" onSubmit={async (e) => {
        e.preventDefault();
        const pp = passwordProblems(pw);
        if (pp) return setError(pp);
        if (pw !== confirm) return setError('As palavras-passe não coincidem.');
        const r = await resetPassword(token, pw);
        if (!r.ok) return setError(r.error!);
        toast('Palavra-passe alterada. Já pode iniciar sessão.');
        navigate('entrar');
      }}>
        {error && <Notice tone="error">{error}</Notice>}
        <Field label="Nova palavra-passe" required hint="Pelo menos 8 caracteres, com letras e números.">{(p) => <PasswordInput {...p} value={pw} onChange={setPw} autoComplete="new-password" />}</Field>
        <Field label="Confirmar nova palavra-passe" required>{(p) => <PasswordInput {...p} value={confirm} onChange={setConfirm} autoComplete="new-password" />}</Field>
        <button type="submit" className="btn btn-primary">Guardar palavra-passe</button>
      </form>
    </AuthShell>
  );
}
