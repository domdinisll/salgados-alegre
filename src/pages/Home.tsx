import { LuPackage, LuSnowflake, LuZap, LuTruck, LuArrowRight, LuStore, LuCoffee, LuPartyPopper, LuUtensils, LuShoppingBag } from 'react-icons/lu';
import { Link } from '../router';
import { useProducts, useSettings } from '../state';
import { ProductCard } from '../components/ProductCard';
import { ProductArt } from '../components/ProductArt';
import { formatEuro } from '../lib/format';

export function HowSteps({ compact = false }: { compact?: boolean }) {
  const steps = [
    { t: 'Escolha os seus salgados.', d: 'Veja o catálogo, escolha o tamanho do pack e a quantidade de que precisa.' },
    { t: 'Personalize a sua encomenda e selecione a entrega.', d: 'Para cada produto, escolha frito ou congelado para fritar. Depois indique a morada e o dia de entrega.' },
    { t: 'Confirme a encomenda e receba os seus produtos.', d: 'Reveja o total, escolha o método de pagamento e receba tudo na data pedida.' },
  ];
  return (
    <ol className={`grid gap-5 ${compact ? '' : 'md:grid-cols-3'}`}>
      {steps.map((s, i) => (
        <li key={i} className="panel p-6 relative">
          <span className="font-display text-5xl font-extrabold text-accent-500 leading-none" aria-hidden>{i + 1}</span>
          <h3 className="mt-3 text-lg font-bold">{s.t}</h3>
          <p className="mt-2 text-muted">{s.d}</p>
        </li>
      ))}
    </ol>
  );
}

export function Home() {
  const products = useProducts();
  const settings = useSettings();
  const featured = products.filter((p) => p.active && p.featured && !p.wholesaleOnly).slice(0, 6);
  const heroArt = (slug: string) => products.find((p) => p.slug === slug) ?? products[0];

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-cream">
        <div className="wrap grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-14 items-center py-12 md:py-16 lg:py-20">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 rounded-full bg-paper border border-line px-3 py-1.5 text-[0.85rem] font-semibold text-brand-700">
              <LuPackage aria-hidden /> Fritos, congelados ou prontos a servir
            </p>
            <h1 className="mt-5 text-[2.4rem] sm:text-5xl lg:text-[3.6rem] font-extrabold leading-[1.02] text-brand-900" data-page-title tabIndex={-1}>
              Os seus salgados favoritos, <span className="relative whitespace-nowrap text-brand-700">à distância<svg aria-hidden viewBox="0 0 200 12" className="absolute left-0 -bottom-1.5 w-full h-3" preserveAspectRatio="none"><path d="M2 9 Q50 2 100 6 T198 4" stroke="#e99a2c" strokeWidth="5" fill="none" strokeLinecap="round" /></svg></span> de um clique.
            </h1>
            <p className="mt-6 text-lg text-muted max-w-[54ch]">
              Qualidade, sabor e praticidade para a sua casa ou negócio. Faça a sua encomenda e receba os seus salgados prontos a preparar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="produtos" className="btn btn-primary btn-lg">Ver produtos <LuArrowRight aria-hidden /></Link>
              <Link to="grosso" className="btn btn-accent btn-lg">Encomendar para revenda</Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              <div><dt className="text-[0.8rem] text-muted">Entrega grátis</dt><dd className="num font-display text-xl font-bold text-brand-800">desde {formatEuro(settings.delivery.freeThreshold)}</dd></div>
              <div><dt className="text-[0.8rem] text-muted">Antecedência</dt><dd className="font-display text-xl font-bold text-brand-800">{settings.delivery.leadTimeDays} dias</dd></div>
              <div><dt className="text-[0.8rem] text-muted">Variedades</dt><dd className="num font-display text-xl font-bold text-brand-800">{products.filter((p) => p.active).length}</dd></div>
            </dl>
          </div>

          <div className="relative min-w-0" aria-hidden>
            <div className="grid grid-cols-6 grid-rows-6 gap-3 sm:gap-4 aspect-[1/1] max-w-[560px] mx-auto">
              <div className="col-span-4 row-span-4 rounded-[1.75rem] overflow-hidden shadow-[var(--shadow-lift)]"><ProductArt product={heroArt('coxinha-com-queijo')} /></div>
              <div className="col-span-2 row-span-3 rounded-[1.5rem] overflow-hidden shadow-[var(--shadow-card)]"><ProductArt product={heroArt('mini-rissol-de-camarao')} /></div>
              <div className="col-span-2 row-span-3 col-start-5 row-start-4 rounded-[1.5rem] overflow-hidden shadow-[var(--shadow-card)]"><ProductArt product={heroArt('empada')} /></div>
              <div className="col-span-4 row-span-2 rounded-[1.5rem] overflow-hidden shadow-[var(--shadow-card)]"><ProductArt product={heroArt('croquete-de-carne-medio')} /></div>
            </div>
            <div className="absolute -left-2 sm:left-4 bottom-[30%] rotate-[-6deg] rounded-2xl bg-brand-800 text-cream px-4 py-3 shadow-[var(--shadow-lift)]">
              <p className="text-[0.72rem] uppercase tracking-[0.14em] text-accent-400 font-bold">Pack grosso</p>
              <p className="font-display text-2xl font-extrabold leading-none mt-1">100 un.</p>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFÍCIOS */}
      <section aria-labelledby="beneficios" className="bg-paper border-y border-line">
        <h2 id="beneficios" className="sr-only">Porque escolher a Salgados Alegre</h2>
        <div className="wrap grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-10">
          {[
            { icon: <LuPackage />, t: 'Encomendas em quantidade', d: 'Packs pensados para festas, montras e revenda.' },
            { icon: <LuSnowflake />, t: 'Opções fritas e congeladas', d: 'Prontos a servir ou para fritar quando precisar.' },
            { icon: <LuZap />, t: 'Encomendas simples e rápidas', d: 'Encomenda rápida em tabela para clientes habituais.' },
            { icon: <LuTruck />, t: 'Entrega à sua medida', d: 'Escolha o dia e o horário que lhe dá mais jeito.' },
          ].map((b) => (
            <div key={b.t} className="flex gap-4">
              <span className="w-12 h-12 shrink-0 rounded-2xl bg-accent-50 text-accent-600 text-2xl flex items-center justify-center" aria-hidden>{b.icon}</span>
              <div>
                <h3 className="font-bold text-[1.05rem] leading-snug">{b.t}</h3>
                <p className="text-[0.92rem] text-muted mt-1">{b.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* DESTAQUES */}
      <section aria-labelledby="destaques" className="wrap py-16 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className="eyebrow mb-2">Os mais pedidos</p>
            <h2 id="destaques" className="text-3xl md:text-4xl font-extrabold text-brand-900">Produtos em destaque</h2>
          </div>
          <Link to="produtos" className="btn btn-outline">Ver todos os produtos <LuArrowRight aria-hidden /></Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>

      {/* REVENDA */}
      <section aria-labelledby="revenda" className="bg-brand-800 text-cream">
        <div className="wrap py-16 md:py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="eyebrow !text-accent-400 mb-3">Para negócios</p>
            <h2 id="revenda" className="text-3xl md:text-[2.75rem] font-extrabold leading-tight text-cream">O parceiro ideal para o seu negócio.</h2>
            <p className="mt-5 text-lg text-cream/80 max-w-[52ch]">
              Abasteça o seu negócio com salgados deliciosos e encomende as quantidades de que precisa, de forma simples e prática.
            </p>
            <ul className="mt-6 grid gap-2 text-cream/85">
              <li>• Preços por volume e preço de revenda para contas aprovadas</li>
              <li>• Encomenda rápida de vários produtos numa só tabela</li>
              <li>• Repita encomendas anteriores com um clique</li>
            </ul>
            <Link to="grosso" className="btn btn-accent btn-lg mt-8">Descobrir encomendas por grosso <LuArrowRight aria-hidden /></Link>
          </div>
          <ul className="grid grid-cols-2 gap-4">
            {[
              { icon: <LuUtensils />, t: 'Restaurantes' },
              { icon: <LuCoffee />, t: 'Cafés e pastelarias' },
              { icon: <LuShoppingBag />, t: 'Mercearias e lojas' },
              { icon: <LuPartyPopper />, t: 'Eventos e catering' },
            ].map((x) => (
              <li key={x.t} className="rounded-2xl bg-brand-900/50 border border-cream/10 p-5">
                <span className="text-3xl text-accent-400" aria-hidden>{x.icon}</span>
                <p className="mt-3 font-display font-bold text-lg">{x.t}</p>
              </li>
            ))}
            <li className="col-span-2 rounded-2xl bg-accent-500 text-brand-900 p-5 flex items-center gap-4">
              <LuStore className="text-3xl shrink-0" aria-hidden />
              <p className="font-semibold">E qualquer negócio que revenda salgados ao balcão.</p>
            </li>
          </ul>
        </div>
      </section>

      {/* COMO FUNCIONA */}
      <section aria-labelledby="como" className="wrap py-16 md:py-20">
        <div className="max-w-2xl mb-8">
          <p className="eyebrow mb-2">Encomendar e receber</p>
          <h2 id="como" className="text-3xl md:text-4xl font-extrabold text-brand-900">Três passos até à sua mesa</h2>
        </div>
        <HowSteps />
        <p className="mt-6 text-muted text-[0.95rem]">
          Entrega gratuita em encomendas a partir de <strong className="num text-ink">{formatEuro(settings.delivery.freeThreshold)}</strong>. Abaixo desse valor aplica-se a taxa de entrega da sua zona.
        </p>
      </section>
    </>
  );
}
