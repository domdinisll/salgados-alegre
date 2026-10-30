import { useState, type ReactNode } from 'react';
import { LuLayoutDashboard, LuClipboardList, LuPackage, LuUsers, LuTruck, LuPercent, LuSettings, LuStore, LuLogOut, LuShieldAlert, LuRotateCcw } from 'react-icons/lu';
import { Link, param } from '../router';
import { Logo, ConfirmDialog } from '../components/ui';
import { resetDemo, sessionStore, useOrders, useSession } from '../state';
import { Overview } from './Overview';
import { OrdersAdmin, OrderAdminDetail } from './Orders';
import { ProductsAdmin, ProductEditor } from './Products';
import { CustomersAdmin } from './Customers';
import { DeliverySettings, PricingSettings, BusinessSettings } from './Settings';

const NAV = [
  { to: 'admin', label: 'Resumo', icon: LuLayoutDashboard },
  { to: 'admin-encomendas', label: 'Encomendas', icon: LuClipboardList },
  { to: 'admin-produtos', label: 'Produtos', icon: LuPackage },
  { to: 'admin-clientes', label: 'Clientes', icon: LuUsers },
  { to: 'admin-entregas', label: 'Entregas', icon: LuTruck },
  { to: 'admin-precos', label: 'Preços e promoções', icon: LuPercent },
  { to: 'admin-negocio', label: 'Negócio', icon: LuSettings },
];

function activeFor(route: string, to: string) {
  if (to === 'admin') return route === 'admin';
  return route === to || route.startsWith(to.replace(/s$/, '') + '-') || route.startsWith(to + '-');
}

function Gate() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream">
      <div className="card max-w-md w-full p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-extrabold text-brand-900">Painel de gestão</h1>
        <div className="mt-4 rounded-xl bg-warn-bg text-warn p-4 flex gap-3 text-[0.92rem]">
          <LuShieldAlert className="text-xl shrink-0 mt-0.5" aria-hidden />
          <p className="text-ink/85"><strong className="text-warn">Ambiente de demonstração.</strong> Este painel não tem controlo de acesso real. Numa versão de produção, só utilizadores autorizados entram aqui, com autenticação no servidor.</p>
        </div>
        <button type="button" className="btn btn-primary btn-lg w-full mt-6" onClick={() => sessionStore.set((s) => ({ ...s, admin: true }))}>
          Entrar no painel (demonstração)
        </button>
        <Link to="" className="btn btn-ghost w-full mt-2">Voltar à loja</Link>
      </div>
    </div>
  );
}

export function AdminApp({ route }: { route: string }) {
  const { admin } = useSession();
  const orders = useOrders();
  const [confirmReset, setConfirmReset] = useState(false);
  if (!admin) return <Gate />;
  const pending = orders.filter((o) => o.status === 'recebida').length;

  let v: string | null;
  let page: ReactNode;
  if ((v = param(route, 'admin-encomenda-'))) page = <OrderAdminDetail id={v} />;
  else if (route === 'admin-encomendas') page = <OrdersAdmin />;
  else if ((v = param(route, 'admin-produto-'))) page = <ProductEditor id={v} />;
  else if (route === 'admin-produtos') page = <ProductsAdmin />;
  else if (route === 'admin-clientes') page = <CustomersAdmin />;
  else if (route === 'admin-entregas') page = <DeliverySettings />;
  else if (route === 'admin-precos') page = <PricingSettings />;
  else if (route === 'admin-negocio') page = <BusinessSettings />;
  else page = <Overview />;

  return (
    <div className="min-h-screen bg-[#f6f3ec] lg:grid lg:grid-cols-[250px_1fr]">
      <a href="#admin-main" onClick={(e) => { e.preventDefault(); document.getElementById('admin-main')?.focus(); }} className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[90] btn btn-accent">Saltar para o conteúdo</a>
      <aside className="bg-brand-900 text-cream lg:sticky lg:top-0 lg:h-screen flex flex-col pt-[env(safe-area-inset-top)]">
        <div className="px-4 lg:px-5 py-4 flex items-center justify-between gap-3 pl-[max(16px,env(safe-area-inset-left))]">
          <Link to="admin" aria-label="Painel de gestão"><Logo light /></Link>
          <span className="badge bg-accent-500 text-brand-900 lg:hidden">Demo</span>
        </div>
        <nav aria-label="Gestão" className="overflow-x-auto lg:overflow-visible lg:flex-1 border-y border-cream/10 lg:border-0">
          <ul className="flex lg:flex-col gap-1 px-3 py-2 lg:py-3 w-max lg:w-auto pl-[max(12px,env(safe-area-inset-left))]">
            {NAV.map((n) => {
              const active = activeFor(route, n.to);
              const Icon = n.icon;
              return (
                <li key={n.to}>
                  <Link to={n.to} aria-current={active ? 'page' : undefined} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[0.93rem] font-medium whitespace-nowrap ${active ? 'bg-cream text-brand-900' : 'text-cream/80 hover:bg-brand-800 hover:text-cream'}`}>
                    <Icon aria-hidden className="text-lg" />{n.label}
                    {n.to === 'admin-encomendas' && pending > 0 && <span className="num ml-auto badge bg-accent-500 text-brand-900 !py-0">{pending}<span className="sr-only"> novas</span></span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="hidden lg:grid gap-1 p-3 border-t border-cream/10">
          <p className="px-3 py-2 text-[0.78rem] text-cream/60">Ambiente de demonstração. Dados guardados apenas neste navegador.</p>
          <Link to="" className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-cream/80 hover:bg-brand-800"><LuStore aria-hidden />Ver loja</Link>
          <button type="button" onClick={() => setConfirmReset(true)} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-cream/80 hover:bg-brand-800 text-left"><LuRotateCcw aria-hidden />Repor dados de exemplo</button>
          <button type="button" onClick={() => sessionStore.set((s) => ({ ...s, admin: false }))} className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-cream/80 hover:bg-brand-800 text-left"><LuLogOut aria-hidden />Sair do painel</button>
        </div>
      </aside>
      <main id="admin-main" tabIndex={-1} className="min-w-0 outline-none">
        <div className="bg-accent-50 border-b border-accent-100 text-[0.85rem] text-accent-800">
          <div className="px-[max(16px,env(safe-area-inset-left))] lg:px-8 py-2 flex flex-wrap justify-between gap-2">
            <span><strong>Demonstração:</strong> sem controlo de acesso real · pagamentos simulados · dados locais</span>
            <span className="flex gap-4 lg:hidden">
              <Link to="" className="font-semibold underline">Ver loja</Link>
              <button type="button" className="font-semibold underline" onClick={() => sessionStore.set((s) => ({ ...s, admin: false }))}>Sair</button>
            </span>
          </div>
        </div>
        <div className="pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] lg:px-8 py-6 lg:py-8 max-w-[1280px] pb-[calc(2rem+env(safe-area-inset-bottom))]">{page}</div>
      </main>
      <ConfirmDialog open={confirmReset} onClose={() => setConfirmReset(false)} title="Repor os dados de exemplo?" confirmLabel="Repor dados"
        message="Todos os produtos, encomendas, clientes e definições deste navegador voltam aos valores de exemplo. As alterações feitas serão perdidas." onConfirm={resetDemo} />
    </div>
  );
}

export function AdminHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-extrabold text-brand-900">{title}</h1>
        {children && <p className="text-muted mt-1">{children}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}
