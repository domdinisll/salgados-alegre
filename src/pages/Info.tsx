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
            <li className="flex gap-3"><LuTruck className="mt-1 shrink-0 text-accent-600" aria-hidden />{s.freeThreshold > 0 ? <>Entrega gratuita a partir de <strong className="text-ink num">{formatEuro(s.freeThreshold)}</strong>. Abaixo disso, aplica-se a taxa da sua zona.</> : <>A taxa de entrega depende da distância a Amora e é calculada pelo seu código postal.</>}</li>
            <li className="flex gap-3"><LuClock className="mt-1 shrink-0 text-accent-600" aria-hidden />Pedimos {s.leadTimeDays} dias de antecedência. Encomendas feitas depois das {s.cutoffHour}h contam a partir do dia seguinte.</li>
            <li className="flex gap-3"><LuCalendarDays className="mt-1 shrink-0 text-accent-600" aria-hidden />Entregamos de {s.weekdays.map(weekdayName).join(', ')}.</li>
          </ul>
          <div className="table-wrap mt-4">
            <table className="table num">
              <thead><tr><th>Distância</th><th>Taxa de entrega</th><th>Encomenda mínima</th></tr></thead>
              <tbody>{s.zones.filter((z) => z.enabled).map((z) => <tr key={z.id}><td>{z.name}</td><td>{formatEuro(z.fee)}</td><td>{formatEuro(z.minOrder ?? s.minOrderAmount)}</td></tr>)}</tbody>
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
