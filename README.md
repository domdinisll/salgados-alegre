# Salgados Alegre — protótipo de loja online

Loja online em português de Portugal para salgados fritos e congelados, focada em encomendas por grosso e revenda.
É um **protótipo de demonstração**: o percurso de compra e a gestão funcionam, mas sem servidor, sem pagamentos reais e sem envio de emails.

## Como executar

Requisitos: Node.js 18 ou superior.

```bash
npm install
npm run build     # gera dist/index.html, dist/app.js, dist/app.css e dist/standalone.html
npm run serve     # serve a pasta dist em http://localhost:4173
npm test          # testes das regras de preço, portes, datas e encomendas
npm run typecheck # verificação TypeScript (requer @types/react, incluído nas devDependencies)
```

`dist/standalone.html` é a mesma loja num único ficheiro (CSS e JS embutidos).

Páginas principais (router por hash): `#produtos`, `#produto-coxinhas`, `#carrinho`, `#grosso`, `#finalizar`,
`#entrar`, `#registar`, `#conta`, `#conta-encomendas`, `#admin`, `#admin-encomendas`, `#admin-produtos`,
`#admin-clientes`, `#admin-entregas`, `#admin-precos`, `#admin-negocio`.

## Stack

React 19, TypeScript, Tailwind CSS v4 e esbuild. O ambiente onde o protótipo foi construído não tinha acesso ao
registo de pacotes npm, por isso não foi usado Next.js; foram usados os pacotes já disponíveis. A estrutura está
pronta a migrar para Next.js (App Router): cada nome de rota passa a ser uma pasta em `app/`, e os módulos em
`src/lib` e `src/services` passam para o servidor.

## Estrutura

```
src/
  types.ts              Modelo de dados (produtos, clientes, encomendas, definições)
  config/defaults.ts    Definições centrais: portes, limiar de entrega grátis, zonas, horários, preparações, códigos
  data/                 Produtos, clientes e encomendas DE EXEMPLO
  lib/
    pricing.ts          Motor de preços (puro): escalões, preço revenda, códigos, portes, validações
    delivery.ts         Zonas por código postal e regras de datas de entrega
    orders.ts           Construção de encomendas, sempre recalculadas a partir do catálogo
    format.ts           Euros e datas DD/MM/AAAA (pt-PT)
  services/
    repository.ts       Interface de acesso a dados + implementação local (demonstração)
    auth.ts             Autenticação de demonstração (hash PBKDF2, nunca texto simples)
    payments.ts         Arquitetura de pagamentos modular (PaymentProvider) + fornecedor simulado
    orders.ts           Registo de encomendas, estados e notas
  state/                Stores reativos (carrinho, sessão, catálogo, definições)
  components/           Header, Footer, ProductCard, CartLine, DeliveryCalendar, PaymentMethodSelector, Modal…
  pages/                Loja: início, catálogo, produto, carrinho, checkout, confirmação, conta, revenda, legais
  admin/                Painel: resumo, encomendas, produtos, clientes, entregas, preços, negócio
tests/rules.test.ts     Testes das regras de negócio
```

## O que funciona e o que precisa de backend

| Funcionalidade | Estado no protótipo | Para produção |
|---|---|---|
| Catálogo, pesquisa, filtros, ordenação | Funcional | Ler produtos da base de dados |
| Preparação Frito / Congelado por linha | Funcional, guardada no carrinho e na encomenda | — |
| Carrinho persistente | Funcional (armazenamento local do navegador) | Opcional: carrinho no servidor para clientes com conta |
| Escalões de quantidade, preço revenda, códigos | Funcional | Recalcular no servidor |
| Taxa de entrega por zona e entrega grátis | Funcional (limiar sobre o subtotal após descontos, antes dos portes) | Recalcular no servidor |
| Calendário com datas indisponíveis | Funcional | Validar capacidade de entrega no servidor |
| Checkout em passos e confirmação | Funcional | API de encomendas com transação e reserva de stock |
| Pagamentos (MB WAY, Multibanco, cartão, Apple Pay, Google Pay, PayPal) | **Simulados**. Nada é cobrado nem recolhido | Integrar um fornecedor com suporte para Portugal; marcar «Pago» só por webhook verificado |
| Contas, login, recuperação de palavra-passe | **Demonstração** no navegador | Fornecedor de autenticação ou sessões no servidor; envio de email |
| Painel de gestão | Funcional, **sem controlo de acesso real** | Autenticação e autorização de administradores no servidor |
| Encomendas e clientes | Guardados **apenas neste navegador** | Base de dados (PostgreSQL ou semelhante) |
| Emails de confirmação, faturação certificada | Não implementado | Serviço de email; software de faturação certificado |
| Textos legais | Estrutura por redigir | Redação e validação por profissional |

O armazenamento local do navegador **não é uma base de dados segura**: serve apenas para a demonstração.

## Dados de exemplo a substituir

- Preços, packs, descrições e escalões de desconto (painel → Produtos).
- Ingredientes e alergénios: estão em branco e aparecem como «a confirmar pelo negócio».
- Zonas de entrega, taxas e limiares (painel → Entregas). As zonas incluídas são exemplos.
- Contactos, NIF, morada e redes sociais (painel → Negócio). Nenhum dado real foi inventado.
- Imagens: são ilustrações em SVG. Carregue fotografias em cada produto no painel.

Para voltar aos dados iniciais: painel → Negócio → «Repor dados de exemplo».

## Ligar a um backend

1. Implementar a interface `Repository` (`src/services/repository.ts`) sobre uma API real.
2. Mover `buildOrder` e `computeTotals` para o servidor: nunca confiar em totais enviados pelo navegador.
3. Substituir `SimulatedProvider` por um `PaymentProvider` real criado no servidor; confirmar pagamentos por webhook.
4. Substituir `src/services/auth.ts` por autenticação no servidor.
5. Não colocar chaves secretas no código do frontend.
