import type { ReactNode } from 'react';
import { useSettings } from '../state';
import { PageHeader } from '../components/ui';
import { formatEuro, weekdayName } from '../lib/format';
import { LIVE_PAYMENT_METHODS, paymentLabel } from '../services/payments';
import { Link } from '../router';

/**
 * Páginas legais. Os dados da empresa vêm do painel (Negócio), para ficarem sempre atualizados.
 * Base legal considerada: DL 7/2004 (comércio eletrónico), DL 24/2014 (contratos à distância),
 * DL 84/2021 (garantias), Lei 144/2015 (RAL), DL 156/2005 alterado pelo DL 74/2017 (Livro de
 * Reclamações Eletrónico), RGPD e Lei 58/2019 (dados pessoais), Lei 41/2004 (cookies),
 * Regulamento (UE) 1169/2011 (informação alimentar). Texto a validar por um profissional.
 */

const UPDATED = '30/10/2026';

function useCompany() {
  const b = useSettings().business;
  const missing = (label: string) => <span className="text-danger font-semibold">[{label} — preencher no painel, em Negócio]</span>;
  return {
    name: b.name || missing('nome'),
    nif: b.nif || missing('NIF'),
    address: b.address || missing('morada'),
    email: b.email || missing('email'),
    phone: b.phone || missing('telefone'),
    emailText: b.email,
  };
}

function Doc({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="wrap py-10 md:py-14 max-w-3xl">
      <PageHeader eyebrow="Informações legais" title={title}>Última atualização: {UPDATED}</PageHeader>
      <div className="prose-legal">{children}</div>
    </div>
  );
}

function Identification() {
  const c = useCompany();
  return (
    <ul>
      <li><strong className="text-ink">Vendedor:</strong> {c.name}</li>
      <li><strong className="text-ink">NIF:</strong> {c.nif}</li>
      <li><strong className="text-ink">Morada:</strong> {c.address}</li>
      <li><strong className="text-ink">Email:</strong> {c.email}</li>
      <li><strong className="text-ink">Telefone:</strong> {c.phone} (chamada para a rede fixa ou móvel nacional)</li>
    </ul>
  );
}

function Disputes() {
  return (
    <>
      <h2>Reclamações e resolução de litígios</h2>
      <p>
        Pode apresentar reclamação no <a href="https://www.livroreclamacoes.pt" target="_blank" rel="noreferrer" className="underline text-brand-700">Livro de Reclamações Eletrónico</a> ou contactar-nos diretamente pelos contactos indicados acima.
      </p>
      <p>
        Em caso de litígio de consumo, o consumidor pode recorrer a uma entidade de resolução alternativa de litígios de consumo (RAL), nomeadamente o
        Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (CNIACC), <a href="https://www.cniacc.pt" target="_blank" rel="noreferrer" className="underline text-brand-700">www.cniacc.pt</a>.
        Mais informações no Portal do Consumidor, <a href="https://www.consumidor.gov.pt" target="_blank" rel="noreferrer" className="underline text-brand-700">www.consumidor.gov.pt</a>.
      </p>
    </>
  );
}

export function TermsPage() {
  const s = useSettings();
  const d = s.delivery;
  const days = d.weekdays.slice().sort().map(weekdayName).join(', ');
  return (
    <Doc title="Termos e condições">
      <h2>1. Identificação</h2>
      <p>Esta loja online é explorada por:</p>
      <Identification />

      <h2>2. Âmbito</h2>
      <p>
        Estes termos aplicam-se às encomendas feitas neste site, por consumidores e por empresas (revenda, restauração, cafés e outros negócios).
        Os direitos previstos na lei para consumidores aplicam-se apenas a quem compra para uso não profissional.
        Ao fazer uma encomenda, declara ter lido e aceite estes termos e a <Link to="info-privacidade" className="underline text-brand-700">política de privacidade</Link>.
      </p>

      <h2>3. Produtos e informação alimentar</h2>
      <p>
        Os produtos são salgados alimentares, entregues fritos, congelados (para fritar ou para ir ao forno) ou prontos a servir, conforme a opção escolhida em cada produto.
        A descrição, a lista de ingredientes e os alergénios de cada produto estão indicados na respetiva página. Em caso de alergia ou intolerância, contacte-nos antes de encomendar.
      </p>
      <p>
        Os produtos congelados devem ser mantidos a −18 °C ou menos e não devem voltar a ser congelados depois de descongelados.
        Os produtos fritos e prontos a servir destinam-se a consumo no próprio dia da entrega.
      </p>
      <p>As imagens dos produtos são ilustrativas.</p>

      <h2>4. Preços</h2>
      <p>
        Os preços são apresentados em euros e incluem IVA à taxa legal em vigor. A taxa de entrega é apresentada separadamente antes da confirmação da encomenda.
        O total a pagar é sempre indicado antes de confirmar a encomenda.
      </p>

      <h2>5. Encomenda e celebração do contrato</h2>
      <p>
        A encomenda é feita escolhendo os produtos, a quantidade, a preparação, a morada e a data de entrega pretendida, e confirmando no último passo.
        Depois de enviada, recebe o número da encomenda no ecrã. O contrato considera-se celebrado quando confirmarmos a encomenda, a disponibilidade dos produtos e a data de entrega.
        Se não for possível satisfazer a encomenda, informamos o cliente e não é cobrado qualquer valor.
      </p>

      <h2>6. Pagamento</h2>
      <p>
        O pagamento é feito por {LIVE_PAYMENT_METHODS.map(paymentLabel).join(' ou ')}. Os dados de pagamento são mostrados na confirmação da encomenda e enviados ao cliente por email. A encomenda e a data de entrega são confirmadas depois de recebido o pagamento; se não for possível satisfazer a encomenda, o valor pago é devolvido na totalidade.
        A encomenda só é preparada depois de recebido o pagamento, salvo acordo em contrário.
      </p>

      <h2>7. Entrega</h2>
      <p>
        Entregamos nas zonas indicadas na página <Link to="como-funciona" className="underline text-brand-700">Como funciona</Link>, de {days}.
        É necessária uma antecedência mínima de {d.leadTimeDays} dias; encomendas feitas depois das {d.cutoffHour}h contam a partir do dia seguinte.
        A data e o horário escolhidos são um pedido e ficam confirmados quando confirmarmos a encomenda.
      </p>
      <ul>
        {d.zones.filter((z) => z.enabled).map((z) => (
          <li key={z.id}>{z.name}: taxa de entrega de {formatEuro(z.fee)}, encomenda mínima de {formatEuro(z.minOrder ?? d.minOrderAmount)}.</li>
        ))}
      </ul>
      <p>
        O cliente deve garantir que está presente, ou alguém por si, na morada e no horário indicados, e que tem condições para conservar os produtos congelados.
        Se a entrega não for possível por motivo imputável ao cliente, contactamo-lo para combinar uma nova entrega, que pode ter custos adicionais.
      </p>

      <h2>8. Cancelamento e direito de livre resolução</h2>
      <p>
        O cliente pode cancelar a encomenda sem custos enquanto esta não estiver em preparação, contactando-nos pelo email ou telefone indicados.
      </p>
      <p>
        Nos termos do artigo 17.º, n.º 1, alínea d), do Decreto-Lei n.º 24/2014, não existe direito de livre resolução (devolução no prazo de 14 dias) para bens
        suscetíveis de se deteriorarem ou de ficarem rapidamente fora de prazo, como é o caso dos produtos alimentares frescos, fritos ou congelados vendidos nesta loja.
      </p>

      <h2>9. Conformidade dos produtos</h2>
      <p>
        Verifique os produtos no momento da entrega. Se algum produto não estiver conforme a encomenda, estiver danificado ou não tiver sido mantido à temperatura adequada,
        contacte-nos de imediato, de preferência no próprio dia, com o número da encomenda e, se possível, fotografias.
        Nesses casos, substituímos os produtos ou devolvemos o valor correspondente, sem prejuízo dos direitos previstos no Decreto-Lei n.º 84/2021.
      </p>

      <Disputes />

      <h2>Lei aplicável</h2>
      <p>Estes termos regem-se pela lei portuguesa. Sem prejuízo do recurso às entidades de RAL, são competentes os tribunais nos termos da lei.</p>
    </Doc>
  );
}

export function PrivacyPage() {
  const c = useCompany();
  return (
    <Doc title="Política de privacidade">
      <p>
        Esta política explica como tratamos os seus dados pessoais quando utiliza este site, nos termos do Regulamento Geral sobre a Proteção de Dados (RGPD, Regulamento (UE) 2016/679)
        e da Lei n.º 58/2019.
      </p>

      <h2>1. Responsável pelo tratamento</h2>
      <Identification />

      <h2>2. Que dados recolhemos</h2>
      <ul>
        <li>Dados de identificação e contacto: nome, email, telefone.</li>
        <li>Dados de entrega: morada, código postal, localidade, instruções de entrega.</li>
        <li>Dados de empresa (clientes de revenda): nome da empresa, pessoa de contacto e NIF.</li>
        <li>Dados das encomendas: produtos, quantidades, valores, datas e estado.</li>
        <li>Dados da conta: email e palavra-passe (guardada de forma cifrada; nunca temos acesso à palavra-passe).</li>
      </ul>

      <h2>3. Para que usamos os dados e com que fundamento</h2>
      <ul>
        <li>Gerir encomendas, entregas, pagamentos e o contacto consigo — execução do contrato (art. 6.º, n.º 1, al. b) do RGPD).</li>
        <li>Gerir a sua conta de cliente — execução do contrato.</li>
        <li>Emitir faturas e cumprir obrigações fiscais e contabilísticas — obrigação legal (art. 6.º, n.º 1, al. c)).</li>
        <li>Garantir a segurança do site e prevenir fraude — interesse legítimo (art. 6.º, n.º 1, al. f)).</li>
      </ul>
      <p>Não usamos os seus dados para publicidade nem os vendemos a terceiros. Não tomamos decisões automatizadas com efeitos jurídicos.</p>

      <h2>4. Durante quanto tempo guardamos os dados</h2>
      <ul>
        <li>Dados da conta: enquanto a conta existir. Pode pedir para a apagar a qualquer momento.</li>
        <li>Dados de encomendas e faturação: durante o prazo legal de conservação de documentos fiscais e contabilísticos (10 anos).</li>
      </ul>

      <h2>5. Quem trata os dados por nossa conta</h2>
      <p>Recorremos a prestadores de serviços que tratam dados apenas segundo as nossas instruções:</p>
      <ul>
        <li>Supabase — base de dados e autenticação (servidores na União Europeia).</li>
        <li>Vercel — alojamento do site.</li>
        <li>Resend — envio de emails relacionados com encomendas.</li>
        <li>Google Fonts — tipos de letra do site (recebe o endereço IP do visitante para enviar os ficheiros).</li>
      </ul>
      <p>
        Alguns destes prestadores são empresas dos Estados Unidos. As transferências de dados para fora da União Europeia são feitas com as garantias previstas no RGPD,
        como o Quadro de Privacidade de Dados UE-EUA ou cláusulas contratuais-tipo aprovadas pela Comissão Europeia.
      </p>

      <h2>6. Os seus direitos</h2>
      <p>
        Pode pedir acesso, retificação, apagamento, limitação do tratamento, portabilidade dos seus dados e opor-se ao tratamento baseado em interesse legítimo,
        enviando um email para {c.email}. Respondemos no prazo de um mês.
      </p>
      <p>
        Tem também o direito de apresentar reclamação à Comissão Nacional de Proteção de Dados (CNPD), <a href="https://www.cnpd.pt" target="_blank" rel="noreferrer" className="underline text-brand-700">www.cnpd.pt</a>.
      </p>

      <h2>7. Segurança</h2>
      <p>
        Os dados são transmitidos de forma cifrada (HTTPS). O acesso às encomendas está protegido: cada cliente só vê as suas e apenas a equipa autorizada acede ao painel de gestão.
      </p>

      <h2>8. Alterações</h2>
      <p>Podemos atualizar esta política. A data da última atualização está indicada no topo desta página.</p>
    </Doc>
  );
}

export function CookiesPage() {
  return (
    <Doc title="Política de cookies">
      <p>
        Esta política explica que informação este site guarda no seu dispositivo, nos termos da Lei n.º 41/2004 (alterada pela Lei n.º 46/2012) e do RGPD.
      </p>

      <h2>1. O que guardamos</h2>
      <p>
        Este site <strong className="text-ink">não usa cookies de publicidade, de análise estatística nem de redes sociais</strong>. Usa apenas armazenamento local
        estritamente necessário ao funcionamento do site, que dispensa consentimento:
      </p>
      <div className="table-wrap my-4">
        <table className="table">
          <thead><tr><th>Nome</th><th>Finalidade</th><th>Duração</th></tr></thead>
          <tbody>
            <tr><td>salgados-alegre:v2:cart</td><td>Guardar os produtos do carrinho.</td><td>Até esvaziar o carrinho ou limpar os dados do navegador</td></tr>
            <tr><td>salgados-alegre:sessao</td><td>Manter a sessão iniciada na sua conta.</td><td>Até terminar sessão</td></tr>
            <tr><td>salgados-alegre:v2:cookies-ok</td><td>Lembrar que já viu o aviso sobre cookies.</td><td>Até limpar os dados do navegador</td></tr>
            <tr><td>salgados-alegre:ultima-encomenda</td><td>Mostrar a confirmação da encomenda que acabou de fazer.</td><td>Até fechar o separador</td></tr>
          </tbody>
        </table>
      </div>

      <h2>2. Serviços de terceiros</h2>
      <p>
        Os tipos de letra do site são carregados a partir do Google Fonts, que recebe o endereço IP do visitante para enviar os ficheiros.
        Não são colocados cookies do Google por este motivo. Ver a <Link to="info-privacidade" className="underline text-brand-700">política de privacidade</Link>.
      </p>

      <h2>3. Como gerir</h2>
      <p>
        Pode apagar estes dados a qualquer momento nas definições do seu navegador. Se o fizer, o carrinho fica vazio e terá de iniciar sessão novamente.
      </p>

      <h2>4. Alterações</h2>
      <p>Se passarmos a usar cookies que precisem do seu consentimento (por exemplo, de análise ou publicidade), pediremos esse consentimento antes de os ativar.</p>
    </Doc>
  );
}

export function DeliveryPolicyPage() {
  const d = useSettings().delivery;
  return (
    <Doc title="Entregas">
      <p>Entregamos de {d.weekdays.slice().sort().map(weekdayName).join(', ')}, nos horários {d.timeSlots.join(' e ')}.</p>
      <p>É necessária uma antecedência mínima de {d.leadTimeDays} dias. Encomendas feitas depois das {d.cutoffHour}h contam a partir do dia seguinte.</p>
      <h2>Zonas, taxas e mínimos</h2>
      <ul>
        {d.zones.filter((z) => z.enabled).map((z) => (
          <li key={z.id}>{z.name}: taxa de entrega de {formatEuro(z.fee)}, encomenda mínima de {formatEuro(z.minOrder ?? d.minOrderAmount)}.</li>
        ))}
      </ul>
      <p>{d.restrictionsNote} A zona é determinada pelo código postal da morada de entrega.</p>
      <p>Ver também os <Link to="info-termos" className="underline text-brand-700">termos e condições</Link>, secção 7.</p>
    </Doc>
  );
}

export function ReturnsPage() {
  const c = useCompany();
  return (
    <Doc title="Devoluções e reclamações">
      <p>
        Por se tratar de produtos alimentares que se deterioram rapidamente, não existe direito de livre resolução (artigo 17.º, n.º 1, alínea d), do Decreto-Lei n.º 24/2014).
      </p>
      <p>
        Se receber produtos errados, danificados ou não conformes, contacte-nos de imediato, de preferência no dia da entrega, para {c.email} ou {c.phone},
        com o número da encomenda e, se possível, fotografias. Substituímos os produtos ou devolvemos o valor correspondente.
      </p>
      <Disputes />
    </Doc>
  );
}

export function LegalRouter({ slug }: { slug: string }) {
  if (slug === 'privacidade') return <PrivacyPage />;
  if (slug === 'cookies') return <CookiesPage />;
  if (slug === 'entregas') return <DeliveryPolicyPage />;
  if (slug === 'devolucoes') return <ReturnsPage />;
  return <TermsPage />;
}
