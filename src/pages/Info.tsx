import { useState } from 'react';
import { LuMail, LuPhone, LuMapPin, LuTruck, LuClock, LuCalendarDays } from 'react-icons/lu';
import { useSettings, toast } from '../state';
import { Field, Notice, PageHeader } from '../components/ui';
import { HowSteps } from './Home';
import { formatDate, formatEuro, weekdayName } from '../lib/format';
import { validateCustomerInfo } from '../lib/orders';
import { Link } from '../router';

export function HowItWorks() {
  const s = useSettings().delivery;
  return (
    <div className="wrap py-10 md:py-14">
      <PageHeader eyebrow="Como funciona" title="Encomendar é simples">Escolha, personalize e receba. Pode misturar salgados fritos e congelados na mesma encomenda.</PageHeader>
      <HowSteps />
      <div className="grid md:grid-cols-2 gap-6 mt-10">
        <section className="panel p-6">
          <h2 className="text-xl font-bold mb-3">Frito ou congelado?</h2>
          <dl className="grid gap-4">
            <div><dt className="font-semibold">Frito</dt><dd className="text-muted">Entregue já frito, pronto a comer ou servir. Ideal para festas e eventos no próprio dia.</dd></div>
            <div><dt className="font-semibold">Congelado para fritar</dt><dd className="text-muted">Entregue congelado. Precisa de ser frito antes de consumir. Ideal para ter stock e fritar à medida.</dd></div>
          </dl>
        </section>
        <section className="panel p-6">
          <h2 className="text-xl font-bold mb-3">Entregas</h2>
          <ul className="grid gap-3 text-muted">
            <li className="flex gap-3"><LuTruck className="mt-1 shrink-0 text-accent-600" aria-hidden />Entrega gratuita a partir de <strong className="text-ink num">{formatEuro(s.freeThreshold)}</strong>. Abaixo disso, aplica-se a taxa da sua zona.</li>
            <li className="flex gap-3"><LuClock className="mt-1 shrink-0 text-accent-600" aria-hidden />Pedimos {s.leadTimeDays} dias de antecedência. Encomendas feitas depois das {s.cutoffHour}h contam a partir do dia seguinte.</li>
            <li className="flex gap-3"><LuCalendarDays className="mt-1 shrink-0 text-accent-600" aria-hidden />Entregamos de {s.weekdays.map(weekdayName).join(', ')}.</li>
          </ul>
          <div className="table-wrap mt-4">
            <table className="table num">
              <thead><tr><th>Zona</th><th>Códigos postais</th><th>Taxa</th></tr></thead>
              <tbody>{s.zones.filter((z) => z.enabled).map((z) => <tr key={z.id}><td>{z.name}</td><td>{z.ranges}</td><td>{formatEuro(z.fee)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

export function Contacts() {
  const b = useSettings().business;
  const [f, setF] = useState({ name: '', email: '', phone: '', message: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const show = (v: string) => v || <span className="italic text-muted">A definir pelo negócio</span>;
  return (
    <div className="wrap py-10 md:py-14">
      <PageHeader eyebrow="Fale connosco" title="Contactos">Tem dúvidas sobre produtos, quantidades ou entregas? Estamos aqui para ajudar.</PageHeader>
      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-8 items-start">
        <ul className="grid gap-4">
          <li className="panel p-5 flex gap-4"><LuMail className="text-2xl text-accent-600 shrink-0" aria-hidden /><div><p className="font-semibold">Email</p><p className="select-all">{show(b.email)}</p></div></li>
          <li className="panel p-5 flex gap-4"><LuPhone className="text-2xl text-accent-600 shrink-0" aria-hidden /><div><p className="font-semibold">Telefone</p><p className="select-all">{show(b.phone)}</p></div></li>
          <li className="panel p-5 flex gap-4"><LuMapPin className="text-2xl text-accent-600 shrink-0" aria-hidden /><div><p className="font-semibold">Morada</p><p>{show(b.address)}</p></div></li>
        </ul>
        <div className="card p-6 grid gap-4">
          <h2 className="text-xl font-bold">Encomendas e pedidos especiais</h2>
          <p className="text-muted">Para encomendar, use a <Link to="produtos" className="font-semibold text-brand-700 underline underline-offset-2">loja</Link> ou a <Link to="grosso" className="font-semibold text-brand-700 underline underline-offset-2">encomenda rápida</Link>. Depois de cada encomenda, entramos em contacto para confirmar a entrega e o pagamento.</p>
          <p className="text-muted">Para quantidades maiores, eventos ou revenda regular, contacte-nos pelo email ou telefone indicados.</p>
        </div>
      </div>
    </div>
  );
}

const LEGAL: Record<string, { title: string; sections: { h: string; p: string[] }[] }> = {
  termos: { title: 'Termos e condições', sections: [
    { h: 'Identificação do vendedor', p: ['Denominação social, NIF, morada da sede e contactos: a preencher pelo negócio.'] },
    { h: 'Encomendas', p: ['Condições de aceitação das encomendas, quantidades mínimas e confirmação: a redigir.'] },
    { h: 'Preços e pagamento', p: ['Preços com IVA incluído à taxa legal em vigor. Métodos de pagamento aceites e prazos: a redigir.'] },
    { h: 'Entrega', p: ['Zonas, prazos, datas pedidas e confirmação da entrega: a redigir.'] },
    { h: 'Resolução de litígios', p: ['Informação sobre entidades de resolução alternativa de litígios de consumo e Livro de Reclamações: a completar.'] },
  ] },
  privacidade: { title: 'Política de privacidade', sections: [
    { h: 'Responsável pelo tratamento', p: ['Identificação e contactos do responsável: a preencher.'] },
    { h: 'Dados recolhidos e finalidades', p: ['Nome, email, telefone, morada, NIF (opcional) e histórico de encomendas, para gerir encomendas, entregas, faturação e a conta de cliente.'] },
    { h: 'Direitos dos titulares', p: ['Acesso, retificação, apagamento, limitação, portabilidade e oposição, nos termos do RGPD. Forma de exercer os direitos: a definir.'] },
    { h: 'Conservação e subcontratantes', p: ['Prazos de conservação, alojamento, fornecedor de pagamentos e de email: a definir com o negócio.'] },
  ] },
  cookies: { title: 'Política de cookies', sections: [
    { h: 'O que usamos', p: ['Nesta versão, o site usa apenas armazenamento local essencial do navegador para guardar o carrinho, a sessão da conta e esta preferência. Não usamos cookies de publicidade nem de análise.'] },
    { h: 'Alterações', p: ['Se forem adicionadas ferramentas de análise ou marketing, será pedido consentimento prévio.'] },
  ] },
  entregas: { title: 'Política de entregas', sections: [
    { h: 'Zonas e taxas', p: ['As zonas de entrega e respetivas taxas são as indicadas no checkout. Lista definitiva a confirmar pelo negócio.'] },
    { h: 'Datas', p: ['A data escolhida no checkout é um pedido e só fica confirmada após validação da encomenda.'] },
    { h: 'Produtos congelados', p: ['Condições de transporte e conservação da cadeia de frio: a redigir.'] },
  ] },
  devolucoes: { title: 'Devoluções e reclamações', sections: [
    { h: 'Produtos alimentares', p: ['Regras aplicáveis a devoluções de produtos perecíveis e congelados: a redigir com aconselhamento jurídico.'] },
    { h: 'Reclamações', p: ['Contactos para reclamações e acesso ao Livro de Reclamações Eletrónico: a completar.'] },
  ] },
};

export function LegalPage({ slug }: { slug: string }) {
  const doc = LEGAL[slug] ?? LEGAL.termos;
  return (
    <div className="wrap py-10 md:py-14 max-w-3xl">
      <PageHeader eyebrow="Informações" title={doc.title} />
      <Notice tone="warn" title="Documento por redigir">
        Este texto é apenas uma estrutura de exemplo. Tem de ser redigido e validado por um profissional antes do lançamento. Não constitui aconselhamento jurídico nem garante conformidade legal.
      </Notice>
      <div className="prose-legal mt-4">
        {doc.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((p) => <p key={p}>{p}</p>)}
          </section>
        ))}
        <p className="mt-8 text-[0.85rem]">Última atualização: {formatDate(new Date())} (estrutura de exemplo)</p>
      </div>
    </div>
  );
}
