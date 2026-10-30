import { useState, type ReactNode } from 'react';
import { LuMenu, LuShoppingBasket, LuUser, LuInfo, LuMail, LuPhone, LuMapPin, LuInstagram, LuFacebook, LuLayoutDashboard } from 'react-icons/lu';
import { Link, useRoute } from '../router';
import { Logo, Modal } from './ui';
import { useCart, useCurrentCustomer, useSettings, toastStore } from '../state';
import { useStore } from '../lib/store';
import { CartDrawer } from './CartDrawer';
import { readJSON, writeJSON } from '../services/storage';

const NAV = [
  { to: '', label: 'Início' },
  { to: 'produtos', label: 'Produtos' },
  { to: 'grosso', label: 'Encomendas por grosso' },
  { to: 'como-funciona', label: 'Como funciona' },
  { to: 'contactos', label: 'Contactos' },
];

function isActive(route: string, to: string) {
  if (to === '') return route === '';
  if (to === 'produtos') return route === 'produtos' || route.startsWith('produto-');
  return route === to;
}

export function DemoBar() {
  return (
    <div className="bg-brand-900 text-cream/90 text-[0.82rem]">
      <div className="wrap flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2">
        <p className="flex items-center gap-2">
          <LuInfo className="shrink-0 text-accent-400" aria-hidden />
          <span><strong className="text-cream">Versão de demonstração.</strong> Pagamentos simulados. Nenhuma encomenda é real.</span>
        </p>
        <Link to="admin" className="inline-flex items-center gap-1.5 font-semibold text-accent-400 hover:text-accent-100 underline-offset-4 hover:underline">
          <LuLayoutDashboard aria-hidden /> Painel de gestão (demo)
        </Link>
      </div>
    </div>
  );
}

export function Header() {
  const route = useRoute();
  const { items } = useCart();
  const customer = useCurrentCustomer();
  const [menu, setMenu] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <header className="sticky top-[env(safe-area-inset-top,0px)] z-50 bg-paper/95 backdrop-blur border-b border-line">
      <div className="wrap flex items-center gap-3 h-[72px]">
        <button type="button" className="icon-btn lg:hidden -ml-2" onClick={() => setMenu(true)} aria-label="Abrir menu" aria-expanded={menu}>
          <LuMenu className="text-2xl" aria-hidden />
        </button>
        <Link to="" aria-label="Salgados Alegre, página inicial" className="shrink-0 rounded-lg">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="hidden lg:flex items-center gap-1 ml-8">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              aria-current={isActive(route, n.to) ? 'page' : undefined}
              className={`px-3 py-2 rounded-full text-[0.95rem] font-medium transition-colors ${isActive(route, n.to) ? 'bg-brand-50 text-brand-800 font-semibold' : 'text-ink/80 hover:text-brand-800 hover:bg-brand-50'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <Link to={customer ? 'conta' : 'entrar'} className="icon-btn sm:w-auto sm:px-3 sm:gap-2 font-medium" aria-label={customer ? `A minha conta (${customer.name})` : 'Iniciar sessão'}>
            <LuUser className="text-xl" aria-hidden />
            <span className="hidden sm:inline text-[0.92rem]">{customer ? 'A minha conta' : 'Entrar'}</span>
          </Link>
          <button type="button" className="relative btn btn-primary btn-sm !min-h-[44px] !px-4" onClick={() => setCartOpen(true)} aria-label={`Carrinho, ${count} ${count === 1 ? 'pack' : 'packs'}`}>
            <LuShoppingBasket className="text-lg" aria-hidden />
            <span className="hidden sm:inline">Carrinho</span>
            <span className="num min-w-6 h-6 px-1.5 rounded-full bg-accent-500 text-brand-900 text-[0.8rem] font-bold inline-flex items-center justify-center" aria-hidden>{count}</span>
          </button>
        </div>
      </div>

      <Modal open={menu} onClose={() => setMenu(false)} title="Menu" side>
        <nav aria-label="Menu principal (telemóvel)">
          <ul className="grid gap-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} onClick={() => setMenu(false)} aria-current={isActive(route, n.to) ? 'page' : undefined} className={`block px-4 py-3 rounded-xl text-lg font-medium ${isActive(route, n.to) ? 'bg-brand-50 text-brand-800' : 'hover:bg-paper'}`}>
                  {n.label}
                </Link>
              </li>
            ))}
            <li className="mt-3 border-t border-line pt-3">
              <Link to={customer ? 'conta' : 'entrar'} onClick={() => setMenu(false)} className="block px-4 py-3 rounded-xl text-lg font-medium hover:bg-paper">
                {customer ? 'A minha conta' : 'Iniciar sessão'}
              </Link>
            </li>
          </ul>
        </nav>
      </Modal>
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </header>
  );
}

export function Footer() {
  const s = useSettings().business;
  const year = new Date().getFullYear();
  const contact = (v: string, fallback: string) => v || <span className="italic text-cream/60">{fallback}</span>;
  return (
    <footer className="bg-brand-900 text-cream/85 mt-20">
      <div className="wrap pt-14 pb-10 grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div className="max-w-sm">
          <Logo light />
          <p className="mt-4 text-[0.95rem] text-cream/75">
            Salgados fritos e congelados para encomendar em quantidade. Para a sua casa, para eventos e para quem revende.
          </p>
          <div className="mt-5 flex gap-2" aria-label="Redes sociais (a configurar)">
            {[LuInstagram, LuFacebook].map((Icon, i) => (
              <span key={i} className="w-10 h-10 rounded-full border border-cream/20 inline-flex items-center justify-center text-cream/60" title="Rede social a configurar">
                <Icon aria-hidden />
                <span className="sr-only">{i === 0 ? 'Instagram' : 'Facebook'} (a configurar)</span>
              </span>
            ))}
          </div>
        </div>
        <nav aria-label="Rodapé: loja">
          <h2 className="font-display text-cream font-bold mb-3">Loja</h2>
          <ul className="grid gap-2 text-[0.95rem]">
            {NAV.slice(1).map((n) => <li key={n.to}><Link className="hover:text-accent-400" to={n.to}>{n.label}</Link></li>)}
            <li><Link className="hover:text-accent-400" to="entrar">A minha conta</Link></li>
          </ul>
        </nav>
        <nav aria-label="Rodapé: informações legais">
          <h2 className="font-display text-cream font-bold mb-3">Informações</h2>
          <ul className="grid gap-2 text-[0.95rem]">
            <li><Link className="hover:text-accent-400" to="info-termos">Termos e condições</Link></li>
            <li><Link className="hover:text-accent-400" to="info-privacidade">Política de privacidade</Link></li>
            <li><Link className="hover:text-accent-400" to="info-cookies">Política de cookies</Link></li>
            <li><Link className="hover:text-accent-400" to="info-entregas">Entregas</Link></li>
            <li><Link className="hover:text-accent-400" to="info-devolucoes">Devoluções e reclamações</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="font-display text-cream font-bold mb-3">Apoio ao cliente</h2>
          <ul className="grid gap-2.5 text-[0.95rem]">
            <li className="flex gap-2.5"><LuMail className="mt-1 shrink-0 text-accent-400" aria-hidden /><span><span className="sr-only">Email: </span>{contact(s.email, 'Email a definir')}</span></li>
            <li className="flex gap-2.5"><LuPhone className="mt-1 shrink-0 text-accent-400" aria-hidden /><span><span className="sr-only">Telefone: </span>{contact(s.phone, 'Telefone a definir')}</span></li>
            <li className="flex gap-2.5"><LuMapPin className="mt-1 shrink-0 text-accent-400" aria-hidden /><span><span className="sr-only">Morada: </span>{contact(s.address, 'Morada a definir')}</span></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-cream/10">
        <div className="wrap py-5 flex flex-wrap justify-between gap-3 text-[0.85rem] text-cream/60">
          <p>© {year} {s.name}. Todos os direitos reservados.</p>
          <p>Livro de Reclamações e dados legais da empresa: a completar antes do lançamento.</p>
        </div>
      </div>
    </footer>
  );
}

export function Toasts() {
  const toasts = useStore(toastStore);
  return (
    <div className="fixed z-[80] bottom-[calc(16px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 w-[calc(100%-32px)] max-w-md grid gap-2" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className={`anim-toast rounded-xl px-4 py-3 shadow-lg text-[0.95rem] font-medium ${t.tone === 'error' ? 'bg-danger text-white' : t.tone === 'info' ? 'bg-ink text-white' : 'bg-brand-800 text-white'}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

export function CookieNotice() {
  const [seen, setSeen] = useState(() => readJSON('cookies-ok', false));
  if (seen) return null;
  const close = (v: string) => { writeJSON('cookies-ok', v); setSeen(true); };
  return (
    <div className="fixed z-[65] left-0 right-0 bottom-0 pb-[env(safe-area-inset-bottom,0px)] bg-paper border-t border-line shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.2)]" role="region" aria-label="Aviso de cookies">
      <div className="wrap py-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
        <p className="text-[0.92rem] text-muted flex-1">
          Este site usa apenas armazenamento local essencial para guardar o seu carrinho e a sua sessão. Não usamos cookies de publicidade nem de análise.{' '}
          <Link to="info-cookies" className="text-brand-700 font-semibold underline underline-offset-2">Política de cookies</Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => close('essenciais')}>Apenas essenciais</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => close('ok')}>Compreendi</button>
        </div>
      </div>
    </div>
  );
}

export function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#conteudo" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] btn btn-accent">
        Saltar para o conteúdo
      </a>
      <DemoBar />
      <Header />
      <main id="conteudo" tabIndex={-1} className="outline-none">{children}</main>
      <Footer />
      <CookieNotice />
    </>
  );
}
