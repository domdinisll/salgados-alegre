import { useEffect } from 'react';
import { param, useRoute } from './router';
import { StoreLayout, Toasts } from './components/Layout';
import { Home } from './pages/Home';
import { Catalog } from './pages/Catalog';
import { ProductPage } from './pages/ProductPage';
import { CartPage } from './pages/CartPage';
import { Checkout } from './pages/Checkout';
import { Confirmation } from './pages/Confirmation';
import { ForgotPage, LoginPage, RegisterPage, ResetPage } from './pages/Auth';
import { AccountPage } from './pages/Account';
import { Wholesale } from './pages/Wholesale';
import { Contacts, HowItWorks, LegalPage } from './pages/Info';
import { AdminApp } from './admin/AdminApp';
import { EmptyState } from './components/ui';
import { Link } from './router';
import { LuSearchX, LuRotateCcw } from 'react-icons/lu';
import { authRedirectStore, bootstrap, toast, useApp } from './state';
import { Logo } from './components/ui';
import { navigate } from './router';

const TITLES: [RegExp, string][] = [
  [/^$/, 'Salgados Alegre · Salgados por grosso'],
  [/^produtos$/, 'Produtos'],
  [/^produto-/, 'Produto'],
  [/^carrinho$/, 'Carrinho'],
  [/^grosso$/, 'Encomendas por grosso'],
  [/^como-funciona$/, 'Como funciona'],
  [/^contactos$/, 'Contactos'],
  [/^finalizar$/, 'Finalizar encomenda'],
  [/^confirmacao-/, 'Encomenda recebida'],
  [/^entrar$/, 'Iniciar sessão'],
  [/^registar$/, 'Criar conta'],
  [/^conta/, 'A minha conta'],
  [/^admin/, 'Gestão'],
];

function Storefront({ route }: { route: string }) {
  let v: string | null;
  if (route === '') return <Home />;
  if (route === 'produtos') return <Catalog />;
  if ((v = param(route, 'produto-'))) return <ProductPage slug={v} />;
  if (route === 'carrinho') return <CartPage />;
  if (route === 'grosso') return <Wholesale />;
  if (route === 'como-funciona') return <HowItWorks />;
  if (route === 'contactos') return <Contacts />;
  if (route === 'finalizar') return <Checkout />;
  if ((v = param(route, 'confirmacao-'))) return <Confirmation id={v} />;
  if (route === 'entrar') return <LoginPage />;
  if (route === 'registar') return <RegisterPage />;
  if (route === 'recuperar') return <ForgotPage />;
  if (route === 'redefinir') return <ResetPage />;
  if (route === 'conta') return <AccountPage view="perfil" />;
  if (route === 'conta-encomendas') return <AccountPage view="encomendas" />;
  if ((v = param(route, 'conta-encomenda-'))) return <AccountPage view="encomenda" orderId={v} />;
  if (route === 'conta-moradas') return <AccountPage view="moradas" />;
  if ((v = param(route, 'info-'))) return <LegalPage slug={v} />;
  return (
    <div className="wrap py-16">
      <EmptyState icon={<LuSearchX />} title="Página não encontrada" action={<Link to="" className="btn btn-primary">Voltar ao início</Link>}>
        A página que procura não existe ou mudou de endereço.
      </EmptyState>
    </div>
  );
}

function Loading() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-5 p-6" role="status" aria-live="polite">
      <Logo />
      <span className="w-8 h-8 rounded-full border-[3px] border-brand-100 border-t-brand-600 animate-spin" aria-hidden />
      <span className="sr-only">A carregar a loja…</span>
    </div>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md text-center">
        <Logo />
        <h1 className="mt-6 text-2xl font-extrabold text-brand-900">Não foi possível carregar a loja</h1>
        <p className="mt-2 text-muted">{message}</p>
        <button type="button" className="btn btn-primary mt-6" onClick={() => void bootstrap()}><LuRotateCcw aria-hidden />Tentar novamente</button>
      </div>
    </div>
  );
}

let booted = false;

export function App() {
  const route = useRoute();
  const app = useApp();

  useEffect(() => {
    if (booted) return;
    booted = true;
    void bootstrap().then(() => {
      const kind = authRedirectStore.get();
      if (kind === 'recovery') navigate('redefinir');
      else if (kind === 'signup' || kind === 'magiclink' || kind === 'login') { toast('Email confirmado. Sessão iniciada.'); navigate('conta'); }
      else if (kind === 'erro') { toast('O link do email é inválido ou expirou.', 'error'); navigate('entrar'); }
    });
  }, []);

  useEffect(() => {
    const t = TITLES.find(([re]) => re.test(route))?.[1] ?? 'Salgados Alegre';
    document.title = route === '' ? t : `${t} · Salgados Alegre`;
    window.scrollTo({ top: 0 });
    // Leva o foco para o título da nova página (leitores de ecrã anunciam a mudança).
    requestAnimationFrame(() => {
      if (route !== '' && !route.startsWith('admin')) document.querySelector<HTMLElement>('[data-page-title]')?.focus({ preventScroll: true });
    });
  }, [route]);

  return (
    <>
      {app.state === 'loading' ? <Loading /> : app.state === 'error' ? <LoadError message={app.message} />
        : route.startsWith('admin') ? <AdminApp route={route} /> : <StoreLayout><Storefront route={route} /></StoreLayout>}
      <Toasts />
    </>
  );
}
