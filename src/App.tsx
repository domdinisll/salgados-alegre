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
import { LuSearchX } from 'react-icons/lu';

const TITLES: [RegExp, string][] = [
  [/^$/, 'Salgados Alegre · Salgados por grosso'],
  [/^produtos$/, 'Produtos'],
  [/^produto-/, 'Produto'],
  [/^carrinho$/, 'Carrinho'],
  [/^grosso$/, 'Encomendas por grosso'],
  [/^como-funciona$/, 'Como funciona'],
  [/^contactos$/, 'Contactos'],
  [/^finalizar$/, 'Finalizar encomenda'],
  [/^confirmacao-/, 'Encomenda confirmada'],
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
  if ((v = param(route, 'redefinir-'))) return <ResetPage token={v} />;
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

export function App() {
  const route = useRoute();

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
      {route.startsWith('admin') ? <AdminApp route={route} /> : <StoreLayout><Storefront route={route} /></StoreLayout>}
      <Toasts />
    </>
  );
}
