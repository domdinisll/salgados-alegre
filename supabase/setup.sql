-- Salgados Alegre: configuração completa da base de dados.
-- Colar no Supabase → SQL Editor → New query → Run. Pode ser corrido mais do que uma vez.

-- =====================================================================
-- Salgados Alegre — esquema da base de dados (Supabase / PostgreSQL)
-- Correr UMA vez no SQL Editor do Supabase. É seguro voltar a correr:
-- as tabelas e funções existentes são atualizadas, os dados mantidos.
-- =====================================================================

-- ---------- Tabelas ----------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  data jsonb not null,
  sort int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text not null default '',
  phone text not null default '',
  type text not null default 'particular' check (type in ('particular', 'revenda')),
  business_name text,
  business_contact text,
  nif text,
  wholesale_approved boolean not null default false,
  is_admin boolean not null default false,
  addresses jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create sequence if not exists public.order_seq start 1;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text unique not null,
  created_at timestamptz not null default now(),
  customer_id uuid references auth.users on delete set null,
  status text not null default 'recebida',
  payment_status text not null default 'pendente',
  delivery_date date not null,
  data jsonb not null
);
create index if not exists orders_customer_idx on public.orders (customer_id);
create index if not exists orders_created_idx on public.orders (created_at desc);

-- ---------- Funções auxiliares ----------
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- Cria o perfil quando alguém cria conta (dados vindos do formulário de registo).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, name, phone, type, business_name, business_contact, nif)
  values (
    new.id, lower(new.email),
    left(coalesce(m->>'name', ''), 120),
    left(coalesce(m->>'phone', ''), 30),
    case when m->>'type' = 'revenda' then 'revenda' else 'particular' end,
    nullif(left(coalesce(m->>'businessName', ''), 120), ''),
    nullif(left(coalesce(m->>'businessContact', ''), 120), ''),
    nullif(left(coalesce(m->>'nif', ''), 9), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Um cliente pode editar o seu perfil, mas não se pode tornar administrador nem aprovar-se como revenda.
-- A regra aplica-se apenas a pedidos vindos do site (papéis anon/authenticated);
-- o dono do projeto, no SQL Editor do Supabase, pode alterar tudo.
create or replace function public.protect_profile() returns trigger
language plpgsql set search_path = public as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    new.is_admin := old.is_admin;
    new.wholesale_approved := old.wholesale_approved;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- Segurança (Row Level Security) ----------
alter table public.settings enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.orders enable row level security;

drop policy if exists "settings: leitura pública" on public.settings;
create policy "settings: leitura pública" on public.settings for select using (true);
drop policy if exists "settings: admin edita" on public.settings;
create policy "settings: admin edita" on public.settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "products: leitura pública" on public.products;
create policy "products: leitura pública" on public.products for select using (true);
drop policy if exists "products: admin insere" on public.products;
create policy "products: admin insere" on public.products for insert with check (public.is_admin());
drop policy if exists "products: admin edita" on public.products;
create policy "products: admin edita" on public.products for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists "products: admin apaga" on public.products;
create policy "products: admin apaga" on public.products for delete using (public.is_admin());

drop policy if exists "profiles: próprio ou admin lê" on public.profiles;
create policy "profiles: próprio ou admin lê" on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists "profiles: próprio ou admin edita" on public.profiles;
create policy "profiles: próprio ou admin edita" on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

-- Encomendas: criadas APENAS pela função place_order (não há política de insert).
drop policy if exists "orders: próprio ou admin lê" on public.orders;
create policy "orders: próprio ou admin lê" on public.orders for select using (customer_id = auth.uid() or public.is_admin());
drop policy if exists "orders: admin edita" on public.orders;
create policy "orders: admin edita" on public.orders for update using (public.is_admin()) with check (public.is_admin());

-- ---------- Encomendas: preços e totais SEMPRE calculados no servidor ----------
create or replace function public._fail(msg text) returns void language plpgsql as $$
begin raise exception using message = msg, errcode = 'P0001'; end $$;

create or replace function public.place_order(input jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s jsonb; d jsonb; it jsonb; p record; pd jsonb; prep text; cfg jsonb;
  qty int; pack int; units int; unit_price numeric; gross numeric; pct numeric; disc numeric; label text;
  t jsonb; wholesale boolean := false; wpct numeric;
  lines jsonb := '[]'::jsonb;
  merch numeric := 0; pdisc numeric := 0; after_disc numeric; code_disc numeric := 0; code_txt text := null; c jsonb;
  discounted numeric; fee numeric; free boolean; min_order numeric;
  pc text; digits text; prefix int; zone jsonb := null; z jsonb; r text; a int; b int;
  now_l timestamp := (now() at time zone 'Europe/Lisbon'); today date := (now() at time zone 'Europe/Lisbon')::date;
  earliest date; dd date; lim date;
  cust jsonb := coalesce(input->'customer', '{}'::jsonb);
  addr jsonb := coalesce(input->'address', '{}'::jsonb);
  pay text := input->>'paymentMethod';
  seq bigint; num text; oid uuid := gen_random_uuid(); at text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  data jsonb;
begin
  select settings.data into s from public.settings where id = 1;
  if s is null then perform _fail('A loja ainda não está configurada.'); end if;
  d := s->'delivery';
  if coalesce((s->'business'->>'storeOpen')::boolean, true) = false then
    perform _fail(coalesce(s->'business'->>'closedMessage', 'De momento não estamos a aceitar encomendas.'));
  end if;

  if auth.uid() is not null then
    select (type = 'revenda' and wholesale_approved) into wholesale from public.profiles where id = auth.uid();
    wholesale := coalesce(wholesale, false);
  end if;
  wpct := coalesce((s->'pricing'->>'wholesaleDiscountPct')::numeric, 0);

  if jsonb_typeof(input->'items') <> 'array' or jsonb_array_length(input->'items') = 0 then perform _fail('O carrinho está vazio.'); end if;
  if jsonb_array_length(input->'items') > 60 then perform _fail('Demasiados produtos numa só encomenda.'); end if;

  for it in select * from jsonb_array_elements(input->'items') loop
    select * into p from public.products where id = it->>'productId' for update;
    if not found then perform _fail('Um dos produtos já não está disponível.'); end if;
    pd := p.data;
    if coalesce((pd->>'active')::boolean, false) = false then perform _fail((pd->>'name') || ' já não está disponível.'); end if;
    if pd->>'availability' not in ('disponivel', 'stock_limitado') then perform _fail((pd->>'name') || ' não está disponível para encomenda.'); end if;
    if coalesce((pd->>'wholesaleOnly')::boolean, false) and not wholesale then perform _fail((pd->>'name') || ' está disponível apenas para clientes de revenda.'); end if;
    prep := it->>'prep';
    cfg := pd->'prep'->prep;
    if cfg is null or coalesce((cfg->>'enabled')::boolean, false) = false then perform _fail('A preparação escolhida não está disponível para ' || (pd->>'name') || '.'); end if;
    begin
      qty := (it->>'quantity')::int; pack := (it->>'packSize')::int;
    exception when others then perform _fail('Quantidade inválida.'); end;
    if qty is null or qty < 1 or qty > 999 then perform _fail('Indique uma quantidade válida.'); end if;
    if not (pd->'packSizes' @> to_jsonb(pack)) then perform _fail('O pack escolhido para ' || (pd->>'name') || ' já não está disponível.'); end if;
    units := qty * pack;
    if units < coalesce((pd->>'minOrderUnits')::int, 1) then perform _fail((pd->>'name') || ': a encomenda mínima é de ' || (pd->>'minOrderUnits') || ' unidades.'); end if;
    if jsonb_typeof(pd->'stock') = 'number' and units > (pd->>'stock')::int then perform _fail((pd->>'name') || ': só temos ' || (pd->>'stock') || ' unidades disponíveis.'); end if;

    unit_price := (cfg->>'unitPrice')::numeric;
    gross := round(unit_price * units, 2);
    pct := 0; label := '';
    for t in select * from jsonb_array_elements(coalesce(pd->'tiers', '[]'::jsonb)) order by (value->>'minUnits')::int loop
      if units >= (t->>'minUnits')::int and (t->>'discountPct')::numeric > pct then
        pct := (t->>'discountPct')::numeric; label := (t->>'label') || ' (−' || trim(to_char(pct, 'FM999990.##')) || '%)';
      end if;
    end loop;
    if wholesale and coalesce((pd->>'resale')::boolean, false) and wpct > pct then
      pct := wpct; label := 'Preço revenda (−' || trim(to_char(pct, 'FM999990.##')) || '%)';
    end if;
    disc := round(gross * pct / 100, 2);
    merch := merch + gross; pdisc := pdisc + disc;

    lines := lines || jsonb_build_object(
      'productId', p.id, 'productName', pd->>'name', 'packSize', pack, 'quantity', qty, 'units', units, 'prep', prep,
      'unitPrice', unit_price, 'gross', gross, 'discount', disc, 'discountLabel', label, 'total', gross - disc);

    if jsonb_typeof(pd->'stock') = 'number' then
      pd := jsonb_set(pd, '{stock}', to_jsonb((pd->>'stock')::int - units));
      if (pd->>'stock')::int <= 0 then pd := jsonb_set(pd, '{availability}', '"esgotado"'); end if;
      update public.products set data = pd, updated_at = now() where id = p.id;
    end if;
  end loop;

  after_disc := merch - pdisc;

  -- Código de desconto
  if coalesce(trim(input->>'discountCode'), '') <> '' then
    select value into c from jsonb_array_elements(coalesce(s->'pricing'->'codes', '[]'::jsonb))
      where upper(value->>'code') = upper(trim(input->>'discountCode')) limit 1;
    if c is null or coalesce((c->>'active')::boolean, false) = false then perform _fail('Este código de desconto não é válido.'); end if;
    if coalesce(c->>'validUntil', '') <> '' and today > (c->>'validUntil')::date then perform _fail('Este código de desconto já expirou.'); end if;
    if after_disc < coalesce((c->>'minSubtotal')::numeric, 0) then perform _fail('Este código não se aplica ao valor desta encomenda.'); end if;
    if c->>'type' = 'percent' then code_disc := round(after_disc * (c->>'value')::numeric / 100, 2);
    else code_disc := least((c->>'value')::numeric, after_disc); end if;
    code_txt := c->>'code';
  end if;
  discounted := after_disc - code_disc;

  -- Zona de entrega pelo código postal
  digits := regexp_replace(coalesce(addr->>'postalCode', ''), '\D', '', 'g');
  if length(digits) <> 7 then perform _fail('Indique um código postal válido (formato 0000-000).'); end if;
  pc := substr(digits, 1, 4) || '-' || substr(digits, 5, 3);
  prefix := substr(digits, 1, 4)::int;
  for z in select * from jsonb_array_elements(coalesce(d->'zones', '[]'::jsonb)) loop
    exit when zone is not null;
    if coalesce((z->>'enabled')::boolean, false) then
      foreach r in array string_to_array(coalesce(z->>'ranges', ''), ',') loop
        r := trim(r);
        continue when r = '';
        begin
          a := split_part(r, '-', 1)::int;
          b := coalesce(nullif(split_part(r, '-', 2), '')::int, a);
        exception when others then continue; end;
        if prefix between a and b then zone := z; exit; end if;
      end loop;
    end if;
  end loop;
  if zone is null then perform _fail('Lamentamos, ainda não fazemos entregas neste código postal.'); end if;

  -- Entrega grátis só se houver limiar configurado (> 0).
  free := coalesce((d->>'freeThreshold')::numeric, 0) > 0 and discounted >= (d->>'freeThreshold')::numeric;
  fee := case when free then 0 else round((zone->>'fee')::numeric, 2) end;
  -- Encomenda mínima: a da zona, se existir; senão a geral.
  min_order := coalesce((zone->>'minOrder')::numeric, (d->>'minOrderAmount')::numeric, 0);
  if discounted < min_order then
    perform _fail(case when zone ? 'minOrder' then 'Para entregas na zona ' || (zone->>'name') || ', o' else 'O' end
      || ' valor mínimo de encomenda é ' || replace(to_char(min_order, 'FM999990.00'), '.', ',') || ' €.');
  end if;

  -- Dados do cliente e morada
  if length(trim(coalesce(cust->>'name', ''))) < 3 then perform _fail('Indique o seu nome completo.'); end if;
  if coalesce(cust->>'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then perform _fail('Indique um endereço de email válido.'); end if;
  if coalesce(cust->>'phone', '') !~ '^(\+351\s?)?[29]\d{2}\s?\d{3}\s?\d{3}$' then perform _fail('Indique um número de telefone português válido.'); end if;
  if length(trim(coalesce(addr->>'street', ''))) < 4 then perform _fail('Indique a morada de entrega.'); end if;
  if length(trim(coalesce(addr->>'city', ''))) < 2 then perform _fail('Indique a localidade.'); end if;

  -- Data de entrega
  begin dd := (input->>'deliveryDate')::date; exception when others then perform _fail('Escolha uma data de entrega.'); end;
  if dd is null then perform _fail('Escolha uma data de entrega.'); end if;
  lim := today + coalesce((d->>'maxDaysAhead')::int, 60);
  earliest := today + coalesce((d->>'leadTimeDays')::int, 0) + case when extract(hour from now_l) >= coalesce((d->>'cutoffHour')::int, 24) then 1 else 0 end;
  while earliest <= lim and (not (d->'weekdays' @> to_jsonb(extract(dow from earliest)::int)) or (d->'blackoutDates' @> to_jsonb(earliest::text))) loop
    earliest := earliest + 1;
  end loop;
  if dd < earliest then perform _fail('Esta data é anterior à primeira data de entrega disponível.'); end if;
  if dd > lim then perform _fail('Esta data está demasiado longe. Escolha uma data mais próxima.'); end if;
  if not (d->'weekdays' @> to_jsonb(extract(dow from dd)::int)) then perform _fail('Não fazemos entregas neste dia da semana.'); end if;
  if d->'blackoutDates' @> to_jsonb(dd::text) then perform _fail('Esta data não está disponível para entregas.'); end if;
  if jsonb_array_length(coalesce(d->'timeSlots', '[]'::jsonb)) > 0 and not (d->'timeSlots' @> to_jsonb(coalesce(input->>'timeSlot', ''))) then
    perform _fail('Escolha um horário de entrega.');
  end if;

  -- Métodos de pagamento ativos no lançamento: pagamento após confirmação.
  if pay not in ('mbway', 'transferencia') then perform _fail('Escolha um método de pagamento.'); end if;

  seq := nextval('public.order_seq');
  num := 'SA-' || to_char(today, 'YYYY') || '-' || lpad(seq::text, 5, '0');

  data := jsonb_build_object(
    'id', oid, 'number', num, 'createdAt', at, 'customerId', auth.uid(),
    'customer', jsonb_build_object(
      'name', trim(cust->>'name'), 'email', lower(trim(cust->>'email')), 'phone', trim(cust->>'phone'),
      'type', case when cust->>'type' = 'revenda' then 'revenda' else 'particular' end,
      'businessName', nullif(trim(coalesce(cust->>'businessName', '')), ''), 'nif', nullif(trim(coalesce(cust->>'nif', '')), '')),
    'lines', lines,
    'address', jsonb_build_object('street', trim(addr->>'street'), 'extra', trim(coalesce(addr->>'extra', '')), 'postalCode', pc, 'city', trim(addr->>'city')),
    'zoneName', zone->>'name', 'deliveryDate', dd::text, 'timeSlot', coalesce(input->>'timeSlot', ''),
    'instructions', left(trim(coalesce(input->>'instructions', '')), 500),
    'merchandiseSubtotal', merch, 'productDiscounts', pdisc, 'codeDiscount', code_disc, 'discountCode', code_txt,
    'deliveryFee', fee, 'total', discounted + fee,
    'paymentMethod', pay, 'paymentStatus', 'pendente', 'simulated', false,
    'status', 'recebida', 'statusHistory', jsonb_build_array(jsonb_build_object('status', 'recebida', 'at', at)),
    'notes', '[]'::jsonb);

  insert into public.orders (id, number, customer_id, status, payment_status, delivery_date, data)
  values (oid, num, auth.uid(), 'recebida', 'pendente', dd, data);
  return data;
end $$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Gerado por scripts/gen-seed.mjs. Dados iniciais da loja.
insert into public.settings (id, data) values (1, '{"business":{"name":"Salgados Alegre","tagline":"Salgados por grosso para casa e negócio","email":"","phone":"","address":"","nif":"","storeOpen":true,"closedMessage":"De momento não estamos a aceitar encomendas. Volte em breve.","currency":"EUR","vatRate":0,"pricesIncludeVat":true},"delivery":{"standardFee":5,"freeThreshold":0,"minOrderAmount":15,"leadTimeDays":2,"cutoffHour":15,"weekdays":[1,2,3,4,5],"blackoutDates":["2026-12-25","2027-01-01"],"timeSlots":["09:00 – 12:00","12:00 – 15:00"],"maxDaysAhead":60,"zones":[{"id":"z20","name":"Até 20 km","ranges":"1000-1999, 2650-2654, 2675-2679, 2700-2704, 2720-2724, 2730-2734, 2740-2749, 2780-2784, 2790-2799, 2800-2889, 2925-2929, 2950-2959, 2975-2979","fee":5,"enabled":true},{"id":"z30","name":"20 a 30 km","ranges":"2620-2629, 2645-2649, 2660-2664, 2670-2674, 2680-2699, 2725-2729, 2735-2739, 2750-2779, 2785-2789, 2890-2924, 2930-2949, 2970-2974","fee":5,"minOrder":50,"enabled":true},{"id":"z40","name":"30 a 40 km","ranges":"2600-2619, 2630-2639, 2665-2669, 2705-2719, 2960-2969","fee":7,"minOrder":50,"enabled":true},{"id":"z50","name":"40 a 50 km","ranges":"2130-2139, 2640-2644, 2655-2659, 2980-2999","fee":9,"minOrder":50,"enabled":true}],"restrictionsNote":"Entregamos num raio de cerca de 50 km de Amora (Seixal), de segunda a sexta-feira."},"pricing":{"wholesaleDiscountPct":0,"codes":[]},"sampleData":false}'::jsonb) on conflict (id) do nothing;

insert into public.products (id, data, sort) values ('g-coxinha-queijo', '{"description":"Coxinha grande de frango com queijo.","ingredients":"","allergens":"","packSizes":[50],"minOrderUnits":50,"prep":{"frito":{"enabled":true,"unitPrice":1.4},"congelado":{"enabled":true,"unitPrice":1.3}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"g-coxinha-queijo","slug":"coxinha-com-queijo","name":"Coxinha com Queijo","category":"Salgados grandes","art":"coxinha","shortDescription":"Coxinha grande de frango com queijo."}'::jsonb, 0) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('g-coxinha', '{"description":"Coxinha grande de frango, sem queijo.","ingredients":"","allergens":"","packSizes":[50],"minOrderUnits":50,"prep":{"frito":{"enabled":true,"unitPrice":1.4},"congelado":{"enabled":true,"unitPrice":1.3}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"g-coxinha","slug":"coxinha-sem-queijo","name":"Coxinha sem Queijo","category":"Salgados grandes","art":"coxinha","shortDescription":"Coxinha grande de frango, sem queijo."}'::jsonb, 1) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('g-rissol-frango-milho-queijo', '{"description":"Rissol grande recheado com frango, milho e queijo.","ingredients":"","allergens":"","packSizes":[50],"minOrderUnits":50,"prep":{"frito":{"enabled":true,"unitPrice":1.4},"congelado":{"enabled":true,"unitPrice":1.3}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"g-rissol-frango-milho-queijo","slug":"rissol-de-frango-milho-e-queijo","name":"Rissol de Frango, Milho e Queijo","category":"Salgados grandes","art":"rissol","shortDescription":"Rissol grande recheado com frango, milho e queijo."}'::jsonb, 2) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('g-rolinho-fiambre-queijo', '{"description":"Rolinho grande recheado com fiambre e queijo.","ingredients":"","allergens":"","packSizes":[50],"minOrderUnits":50,"prep":{"frito":{"enabled":true,"unitPrice":1.4},"congelado":{"enabled":true,"unitPrice":1.3}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"g-rolinho-fiambre-queijo","slug":"rolinho-de-fiambre-e-queijo","name":"Rolinho de Fiambre e Queijo","category":"Salgados grandes","art":"croquete","shortDescription":"Rolinho grande recheado com fiambre e queijo."}'::jsonb, 3) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('g-rolinho-salsicha-queijo', '{"description":"Rolinho grande com salsicha e queijo.","ingredients":"","allergens":"","packSizes":[50],"minOrderUnits":50,"prep":{"frito":{"enabled":true,"unitPrice":1.4},"congelado":{"enabled":true,"unitPrice":1.3}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"g-rolinho-salsicha-queijo","slug":"rolinho-de-salsicha-e-queijo","name":"Rolinho de Salsicha e Queijo","category":"Salgados grandes","art":"salsicha","shortDescription":"Rolinho grande com salsicha e queijo."}'::jsonb, 4) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('g-pastel-carne-queijo', '{"description":"Pastel grande recheado com carne e queijo.","ingredients":"","allergens":"","packSizes":[50],"minOrderUnits":50,"prep":{"frito":{"enabled":true,"unitPrice":1.4},"congelado":{"enabled":true,"unitPrice":1.3}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"g-pastel-carne-queijo","slug":"pastel-de-carne-com-queijo","name":"Pastel de Carne com Queijo","category":"Salgados grandes","art":"rissol","shortDescription":"Pastel grande recheado com carne e queijo."}'::jsonb, 5) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('m-camarao', '{"description":"Rissol de camarão de tamanho médio.","ingredients":"","allergens":"","packSizes":[25],"minOrderUnits":25,"prep":{"frito":{"enabled":true,"unitPrice":1},"congelado":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"m-camarao","slug":"rissol-de-camarao-medio","name":"Rissol de Camarão","category":"Salgados médios","art":"rissol","shortDescription":"Rissol de camarão de tamanho médio."}'::jsonb, 6) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('m-croquete-carne', '{"description":"Croquete de carne de tamanho médio.","ingredients":"","allergens":"","packSizes":[25],"minOrderUnits":25,"prep":{"frito":{"enabled":true,"unitPrice":1},"congelado":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"m-croquete-carne","slug":"croquete-de-carne-medio","name":"Croquete de Carne","category":"Salgados médios","art":"croquete","shortDescription":"Croquete de carne de tamanho médio."}'::jsonb, 7) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('m-pastel-bacalhau', '{"description":"Pastel de bacalhau de tamanho médio.","ingredients":"","allergens":"","packSizes":[25],"minOrderUnits":25,"prep":{"frito":{"enabled":true,"unitPrice":1},"congelado":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"m-pastel-bacalhau","slug":"pastel-de-bacalhau-medio","name":"Pastel de Bacalhau","category":"Salgados médios","art":"croquete","shortDescription":"Pastel de bacalhau de tamanho médio."}'::jsonb, 8) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('m-coxinha', '{"description":"Coxinha de tamanho médio.","ingredients":"","allergens":"","packSizes":[25],"minOrderUnits":25,"prep":{"frito":{"enabled":true,"unitPrice":1},"congelado":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"m-coxinha","slug":"coxinha-media","name":"Coxinha","category":"Salgados médios","art":"coxinha","shortDescription":"Coxinha de tamanho médio."}'::jsonb, 9) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('m-salsicha', '{"description":"Salgado médio de salsicha.","ingredients":"","allergens":"","packSizes":[25],"minOrderUnits":25,"prep":{"frito":{"enabled":true,"unitPrice":1},"congelado":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"m-salsicha","slug":"salsicha-media","name":"Salsicha","category":"Salgados médios","art":"salsicha","shortDescription":"Salgado médio de salsicha."}'::jsonb, 10) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('m-fiambre-queijo', '{"description":"Salgado médio de fiambre e queijo.","ingredients":"","allergens":"","packSizes":[25],"minOrderUnits":25,"prep":{"frito":{"enabled":true,"unitPrice":1},"congelado":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"m-fiambre-queijo","slug":"fiambre-e-queijo-medio","name":"Fiambre e Queijo","category":"Salgados médios","art":"croquete","shortDescription":"Salgado médio de fiambre e queijo."}'::jsonb, 11) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('a-pao-queijo', '{"description":"Pão de queijo, à unidade.","ingredients":"","allergens":"","packSizes":[10,25,50,100],"minOrderUnits":10,"prep":{"pronto":{"enabled":true,"unitPrice":0.9},"congelado_forno":{"enabled":true,"unitPrice":0.9}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"a-pao-queijo","slug":"pao-de-queijo","name":"Pão de Queijo","category":"Pão de queijo e empadas","art":"milho","shortDescription":"Pão de queijo, à unidade."}'::jsonb, 12) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('a-empada', '{"description":"Empada, à unidade.","ingredients":"","allergens":"","packSizes":[10,25,50,100],"minOrderUnits":10,"prep":{"pronto":{"enabled":true,"unitPrice":1},"congelado_forno":{"enabled":true,"unitPrice":1}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"a-empada","slug":"empada","name":"Empada","category":"Pão de queijo e empadas","art":"empada","shortDescription":"Empada, à unidade."}'::jsonb, 13) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-coxinha-frango', '{"description":"Coxinhas de frango em miniatura, ideais para festas.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":true,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-coxinha-frango","slug":"mini-coxinha-de-frango","name":"Mini Coxinha de Frango","category":"Salgados miniatura","art":"coxinha","shortDescription":"Coxinhas de frango em miniatura, ideais para festas."}'::jsonb, 14) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-fiambre-queijo', '{"description":"Salgados miniatura de fiambre e queijo.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-fiambre-queijo","slug":"mini-fiambre-e-queijo","name":"Mini Fiambre e Queijo","category":"Salgados miniatura","art":"croquete","shortDescription":"Salgados miniatura de fiambre e queijo."}'::jsonb, 15) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-bolinha-queijo', '{"description":"Bolinhas de queijo em miniatura.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-bolinha-queijo","slug":"mini-bolinha-de-queijo","name":"Mini Bolinha de Queijo","category":"Salgados miniatura","art":"milho","shortDescription":"Bolinhas de queijo em miniatura."}'::jsonb, 16) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-pao-queijo', '{"description":"Pão de queijo em miniatura.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-pao-queijo","slug":"mini-pao-de-queijo","name":"Mini Pão de Queijo","category":"Salgados miniatura","art":"frango","shortDescription":"Pão de queijo em miniatura."}'::jsonb, 17) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-rissol-camarao', '{"description":"Rissóis de camarão em miniatura.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-rissol-camarao","slug":"mini-rissol-de-camarao","name":"Mini Rissol de Camarão","category":"Salgados miniatura","art":"rissol","shortDescription":"Rissóis de camarão em miniatura."}'::jsonb, 18) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-croquete-carne', '{"description":"Croquetes de carne em miniatura.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-croquete-carne","slug":"mini-croquete-de-carne","name":"Mini Croquete de Carne","category":"Salgados miniatura","art":"croquete","shortDescription":"Croquetes de carne em miniatura."}'::jsonb, 19) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-pastel-bacalhau', '{"description":"Pastéis de bacalhau em miniatura.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-pastel-bacalhau","slug":"mini-pastel-de-bacalhau","name":"Mini Pastel de Bacalhau","category":"Salgados miniatura","art":"croquete","shortDescription":"Pastéis de bacalhau em miniatura."}'::jsonb, 20) on conflict (id) do nothing;
insert into public.products (id, data, sort) values ('n-salsicha', '{"description":"Salgados de salsicha em miniatura.","ingredients":"","allergens":"","packSizes":[100],"minOrderUnits":100,"prep":{"frito":{"enabled":true,"unitPrice":0.25},"congelado":{"enabled":true,"unitPrice":0.2}},"tiers":[],"availability":"disponivel","stock":null,"active":true,"featured":false,"resale":true,"wholesaleOnly":false,"sampleData":false,"id":"n-salsicha","slug":"mini-salsicha","name":"Mini Salsicha","category":"Salgados miniatura","art":"salsicha","shortDescription":"Salgados de salsicha em miniatura."}'::jsonb, 21) on conflict (id) do nothing;

-- =====================================================================
-- Salgados Alegre — atualização 2 (30/10/2026)
-- 1) Regras de entrega reais  2) Packs e preparações  3) Email de nova encomenda
-- Correr no Supabase → SQL Editor → New query → Run. Pode ser corrido mais do que uma vez.
-- =====================================================================

-- ---------- 1) Entregas: ~50 km de Amora (2845-340), segunda a sexta, até às 15h, 2 dias de antecedência ----------
update public.settings set data = jsonb_set(data, '{delivery}', (data->'delivery') || jsonb_build_object(
  'weekdays', jsonb_build_array(1, 2, 3, 4, 5),
  'cutoffHour', 15,
  'leadTimeDays', 2,
  'timeSlots', jsonb_build_array('09:00 – 12:00', '12:00 – 15:00'),
  'zones', jsonb_build_array(jsonb_build_object(
    'id', 'z1', 'name', 'Até 50 km de Amora', 'ranges', '1000-1999, 2130-2139, 2600-2999',
    'fee', coalesce((data->'delivery'->>'standardFee')::numeric, 5), 'enabled', true)),
  'restrictionsNote', 'Entregamos num raio de cerca de 50 km de Amora (Seixal), de segunda a sexta-feira.'
)), updated_at = now()
where id = 1;

-- ---------- 2) Produtos ----------
-- Grandes: packs de 50. Médios: packs de 25.
update public.products set data = data || '{"packSizes":[50],"minOrderUnits":50}'::jsonb, updated_at = now()
  where data->>'category' = 'Salgados grandes';
update public.products set data = data || '{"packSizes":[25],"minOrderUnits":25}'::jsonb, updated_at = now()
  where data->>'category' = 'Salgados médios';
-- «Camarão» médio é o rissol de camarão.
update public.products set data = data || jsonb_build_object(
    'name', 'Rissol de Camarão', 'slug', 'rissol-de-camarao-medio',
    'shortDescription', 'Rissol de camarão de tamanho médio.', 'description', 'Rissol de camarão de tamanho médio.'),
  updated_at = now()
  where id = 'm-camarao';
-- Pão de queijo e empada: prontos a servir ou congelados para ir ao forno, ao mesmo preço.
update public.products set data = jsonb_set(data, '{prep}', jsonb_build_object(
    'pronto', jsonb_build_object('enabled', true, 'unitPrice', (data->'prep'->'pronto'->>'unitPrice')::numeric),
    'congelado_forno', jsonb_build_object('enabled', true, 'unitPrice', (data->'prep'->'pronto'->>'unitPrice')::numeric))),
  updated_at = now()
  where id in ('a-pao-queijo', 'a-empada') and data->'prep'->'pronto' is not null;

-- ---------- 3) Email para os administradores a cada nova encomenda (Resend) ----------
-- A chave da API do Resend fica guardada no cofre do Supabase (Vault), nunca no código do site.
create extension if not exists pg_net;

create or replace function public._esc(t text) returns text language sql immutable as $$
  select replace(replace(replace(replace(coalesce(t, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;');
$$;

create or replace function public._eur(n numeric) returns text language sql immutable as $$
  select replace(to_char(coalesce(n, 0), 'FM999999990.00'), '.', ',') || ' €';
$$;

create or replace function public._prep_label(p text) returns text language sql immutable as $$
  select case p when 'frito' then 'Frito' when 'congelado' then 'Congelado para fritar'
    when 'congelado_forno' then 'Congelado para ir ao forno' when 'pronto' then 'Pronto a servir' else coalesce(p, '') end;
$$;

-- Envia o email de uma encomenda. Devolve o id do pedido HTTP, ou null se o email não estiver configurado.
create or replace function public.email_order(order_id uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  key text; recipients text[]; d jsonb; l jsonb; rows text := ''; html text; td text;
  pay text; req bigint;
begin
  select data into d from public.orders where id = order_id;
  if d is null then return null; end if;
  begin
    select decrypted_secret into key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  exception when others then key := null;
  end;
  if coalesce(key, '') = '' then return null; end if;
  -- Destinatário dos alertas: o email guardado no cofre como 'order_alert_email' (por exemplo, o email
  -- da conta Resend, obrigatório no plano gratuito sem domínio próprio). Se não existir, os administradores.
  begin
    select array[trim(decrypted_secret)] into recipients from vault.decrypted_secrets where name = 'order_alert_email' and trim(decrypted_secret) <> '' limit 1;
  exception when others then recipients := null;
  end;
  if recipients is null then
    select array_agg(email) into recipients from public.profiles where is_admin and coalesce(email, '') <> '';
  end if;
  if recipients is null then return null; end if;

  td := 'padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top';
  for l in select * from jsonb_array_elements(d->'lines') loop
    rows := rows || format('<tr><td style="%s"><b>%s</b><br><span style="color:#666">%s</span></td><td style="%s">%s × pack de %s<br><span style="color:#666">%s unidades</span></td><td style="%s;text-align:right;white-space:nowrap">%s</td></tr>',
      td, _esc(l->>'productName'), _prep_label(l->>'prep'), td, l->>'quantity', l->>'packSize', l->>'units', td, _eur((l->>'total')::numeric));
  end loop;
  pay := case d->>'paymentMethod' when 'mbway' then 'MB WAY' when 'transferencia' then 'Transferência bancária' else d->>'paymentMethod' end;

  html := format($h$
<div style="font-family:Arial,sans-serif;color:#23262a;max-width:620px">
  <h2 style="color:#1d5034;margin:0 0 4px">Nova encomenda %s</h2>
  <p style="margin:0 0 16px;color:#555">Total <b>%s</b> · pagamento: %s (por confirmar)</p>
  <table style="width:100%%;border-collapse:collapse;font-size:14px">%s
    <tr><td colspan="2" style="padding:8px 10px;text-align:right">Taxa de entrega</td><td style="padding:8px 10px;text-align:right">%s</td></tr>
    <tr><td colspan="2" style="padding:8px 10px;text-align:right"><b>Total</b></td><td style="padding:8px 10px;text-align:right"><b>%s</b></td></tr>
  </table>
  <h3 style="color:#1d5034;margin:20px 0 6px">Cliente</h3>
  <p style="margin:0">%s%s<br>%s · %s</p>
  <h3 style="color:#1d5034;margin:20px 0 6px">Entrega</h3>
  <p style="margin:0">%s%s<br>%s %s<br><b>Data pedida:</b> %s %s</p>
  %s
  <p style="margin:24px 0 0;color:#777;font-size:13px">Abra o painel de gestão para confirmar a encomenda e marcar o pagamento.</p>
</div>$h$,
    _esc(d->>'number'), _eur((d->>'total')::numeric), _esc(pay), rows,
    case when (d->>'deliveryFee')::numeric = 0 then 'Grátis' else _eur((d->>'deliveryFee')::numeric) end,
    _eur((d->>'total')::numeric),
    _esc(d->'customer'->>'name'),
    case when coalesce(d->'customer'->>'businessName', '') <> '' then ' · ' || _esc(d->'customer'->>'businessName') else '' end,
    _esc(d->'customer'->>'phone'), _esc(d->'customer'->>'email'),
    _esc(d->'address'->>'street'),
    case when coalesce(d->'address'->>'extra', '') <> '' then ', ' || _esc(d->'address'->>'extra') else '' end,
    _esc(d->'address'->>'postalCode'), _esc(d->'address'->>'city'),
    to_char((d->>'deliveryDate')::date, 'DD/MM/YYYY'), _esc(d->>'timeSlot'),
    case when coalesce(d->>'instructions', '') <> '' then '<p style="margin:8px 0 0"><b>Instruções:</b> ' || _esc(d->>'instructions') || '</p>' else '' end);

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := jsonb_build_object(
      'from', 'Salgados Alegre <onboarding@resend.dev>',
      'to', to_jsonb(recipients),
      'reply_to', d->'customer'->>'email',
      'subject', 'Nova encomenda ' || (d->>'number') || ' · ' || _eur((d->>'total')::numeric),
      'html', html)
  ) into req;
  return req;
end $$;

revoke all on function public.email_order(uuid) from public, anon, authenticated;

create or replace function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.email_order(new.id);
  return new;
exception when others then
  return new; -- um problema no email nunca impede a encomenda
end $$;

drop trigger if exists notify_new_order on public.orders;
create trigger notify_new_order after insert on public.orders
  for each row execute function public.notify_new_order();

-- =====================================================================
-- Salgados Alegre — atualização 3 (30/10/2026)
-- Taxas de entrega por distância a Amora (2845-340), mínimo de 50 € acima de 20 km, sem entrega grátis.
-- Correr no Supabase → SQL Editor → New query → Run. Pode ser corrido mais do que uma vez.
-- =====================================================================

create or replace function public.place_order(input jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  s jsonb; d jsonb; it jsonb; p record; pd jsonb; prep text; cfg jsonb;
  qty int; pack int; units int; unit_price numeric; gross numeric; pct numeric; disc numeric; label text;
  t jsonb; wholesale boolean := false; wpct numeric;
  lines jsonb := '[]'::jsonb;
  merch numeric := 0; pdisc numeric := 0; after_disc numeric; code_disc numeric := 0; code_txt text := null; c jsonb;
  discounted numeric; fee numeric; free boolean; min_order numeric;
  pc text; digits text; prefix int; zone jsonb := null; z jsonb; r text; a int; b int;
  now_l timestamp := (now() at time zone 'Europe/Lisbon'); today date := (now() at time zone 'Europe/Lisbon')::date;
  earliest date; dd date; lim date;
  cust jsonb := coalesce(input->'customer', '{}'::jsonb);
  addr jsonb := coalesce(input->'address', '{}'::jsonb);
  pay text := input->>'paymentMethod';
  seq bigint; num text; oid uuid := gen_random_uuid(); at text := to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  data jsonb;
begin
  select settings.data into s from public.settings where id = 1;
  if s is null then perform _fail('A loja ainda não está configurada.'); end if;
  d := s->'delivery';
  if coalesce((s->'business'->>'storeOpen')::boolean, true) = false then
    perform _fail(coalesce(s->'business'->>'closedMessage', 'De momento não estamos a aceitar encomendas.'));
  end if;

  if auth.uid() is not null then
    select (type = 'revenda' and wholesale_approved) into wholesale from public.profiles where id = auth.uid();
    wholesale := coalesce(wholesale, false);
  end if;
  wpct := coalesce((s->'pricing'->>'wholesaleDiscountPct')::numeric, 0);

  if jsonb_typeof(input->'items') <> 'array' or jsonb_array_length(input->'items') = 0 then perform _fail('O carrinho está vazio.'); end if;
  if jsonb_array_length(input->'items') > 60 then perform _fail('Demasiados produtos numa só encomenda.'); end if;

  for it in select * from jsonb_array_elements(input->'items') loop
    select * into p from public.products where id = it->>'productId' for update;
    if not found then perform _fail('Um dos produtos já não está disponível.'); end if;
    pd := p.data;
    if coalesce((pd->>'active')::boolean, false) = false then perform _fail((pd->>'name') || ' já não está disponível.'); end if;
    if pd->>'availability' not in ('disponivel', 'stock_limitado') then perform _fail((pd->>'name') || ' não está disponível para encomenda.'); end if;
    if coalesce((pd->>'wholesaleOnly')::boolean, false) and not wholesale then perform _fail((pd->>'name') || ' está disponível apenas para clientes de revenda.'); end if;
    prep := it->>'prep';
    cfg := pd->'prep'->prep;
    if cfg is null or coalesce((cfg->>'enabled')::boolean, false) = false then perform _fail('A preparação escolhida não está disponível para ' || (pd->>'name') || '.'); end if;
    begin
      qty := (it->>'quantity')::int; pack := (it->>'packSize')::int;
    exception when others then perform _fail('Quantidade inválida.'); end;
    if qty is null or qty < 1 or qty > 999 then perform _fail('Indique uma quantidade válida.'); end if;
    if not (pd->'packSizes' @> to_jsonb(pack)) then perform _fail('O pack escolhido para ' || (pd->>'name') || ' já não está disponível.'); end if;
    units := qty * pack;
    if units < coalesce((pd->>'minOrderUnits')::int, 1) then perform _fail((pd->>'name') || ': a encomenda mínima é de ' || (pd->>'minOrderUnits') || ' unidades.'); end if;
    if jsonb_typeof(pd->'stock') = 'number' and units > (pd->>'stock')::int then perform _fail((pd->>'name') || ': só temos ' || (pd->>'stock') || ' unidades disponíveis.'); end if;

    unit_price := (cfg->>'unitPrice')::numeric;
    gross := round(unit_price * units, 2);
    pct := 0; label := '';
    for t in select * from jsonb_array_elements(coalesce(pd->'tiers', '[]'::jsonb)) order by (value->>'minUnits')::int loop
      if units >= (t->>'minUnits')::int and (t->>'discountPct')::numeric > pct then
        pct := (t->>'discountPct')::numeric; label := (t->>'label') || ' (−' || trim(to_char(pct, 'FM999990.##')) || '%)';
      end if;
    end loop;
    if wholesale and coalesce((pd->>'resale')::boolean, false) and wpct > pct then
      pct := wpct; label := 'Preço revenda (−' || trim(to_char(pct, 'FM999990.##')) || '%)';
    end if;
    disc := round(gross * pct / 100, 2);
    merch := merch + gross; pdisc := pdisc + disc;

    lines := lines || jsonb_build_object(
      'productId', p.id, 'productName', pd->>'name', 'packSize', pack, 'quantity', qty, 'units', units, 'prep', prep,
      'unitPrice', unit_price, 'gross', gross, 'discount', disc, 'discountLabel', label, 'total', gross - disc);

    if jsonb_typeof(pd->'stock') = 'number' then
      pd := jsonb_set(pd, '{stock}', to_jsonb((pd->>'stock')::int - units));
      if (pd->>'stock')::int <= 0 then pd := jsonb_set(pd, '{availability}', '"esgotado"'); end if;
      update public.products set data = pd, updated_at = now() where id = p.id;
    end if;
  end loop;

  after_disc := merch - pdisc;

  -- Código de desconto
  if coalesce(trim(input->>'discountCode'), '') <> '' then
    select value into c from jsonb_array_elements(coalesce(s->'pricing'->'codes', '[]'::jsonb))
      where upper(value->>'code') = upper(trim(input->>'discountCode')) limit 1;
    if c is null or coalesce((c->>'active')::boolean, false) = false then perform _fail('Este código de desconto não é válido.'); end if;
    if coalesce(c->>'validUntil', '') <> '' and today > (c->>'validUntil')::date then perform _fail('Este código de desconto já expirou.'); end if;
    if after_disc < coalesce((c->>'minSubtotal')::numeric, 0) then perform _fail('Este código não se aplica ao valor desta encomenda.'); end if;
    if c->>'type' = 'percent' then code_disc := round(after_disc * (c->>'value')::numeric / 100, 2);
    else code_disc := least((c->>'value')::numeric, after_disc); end if;
    code_txt := c->>'code';
  end if;
  discounted := after_disc - code_disc;

  -- Zona de entrega pelo código postal
  digits := regexp_replace(coalesce(addr->>'postalCode', ''), '\D', '', 'g');
  if length(digits) <> 7 then perform _fail('Indique um código postal válido (formato 0000-000).'); end if;
  pc := substr(digits, 1, 4) || '-' || substr(digits, 5, 3);
  prefix := substr(digits, 1, 4)::int;
  for z in select * from jsonb_array_elements(coalesce(d->'zones', '[]'::jsonb)) loop
    exit when zone is not null;
    if coalesce((z->>'enabled')::boolean, false) then
      foreach r in array string_to_array(coalesce(z->>'ranges', ''), ',') loop
        r := trim(r);
        continue when r = '';
        begin
          a := split_part(r, '-', 1)::int;
          b := coalesce(nullif(split_part(r, '-', 2), '')::int, a);
        exception when others then continue; end;
        if prefix between a and b then zone := z; exit; end if;
      end loop;
    end if;
  end loop;
  if zone is null then perform _fail('Lamentamos, ainda não fazemos entregas neste código postal.'); end if;

  -- Entrega grátis só se houver limiar configurado (> 0).
  free := coalesce((d->>'freeThreshold')::numeric, 0) > 0 and discounted >= (d->>'freeThreshold')::numeric;
  fee := case when free then 0 else round((zone->>'fee')::numeric, 2) end;
  -- Encomenda mínima: a da zona, se existir; senão a geral.
  min_order := coalesce((zone->>'minOrder')::numeric, (d->>'minOrderAmount')::numeric, 0);
  if discounted < min_order then
    perform _fail(case when zone ? 'minOrder' then 'Para entregas na zona ' || (zone->>'name') || ', o' else 'O' end
      || ' valor mínimo de encomenda é ' || replace(to_char(min_order, 'FM999990.00'), '.', ',') || ' €.');
  end if;

  -- Dados do cliente e morada
  if length(trim(coalesce(cust->>'name', ''))) < 3 then perform _fail('Indique o seu nome completo.'); end if;
  if coalesce(cust->>'email', '') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then perform _fail('Indique um endereço de email válido.'); end if;
  if coalesce(cust->>'phone', '') !~ '^(\+351\s?)?[29]\d{2}\s?\d{3}\s?\d{3}$' then perform _fail('Indique um número de telefone português válido.'); end if;
  if length(trim(coalesce(addr->>'street', ''))) < 4 then perform _fail('Indique a morada de entrega.'); end if;
  if length(trim(coalesce(addr->>'city', ''))) < 2 then perform _fail('Indique a localidade.'); end if;

  -- Data de entrega
  begin dd := (input->>'deliveryDate')::date; exception when others then perform _fail('Escolha uma data de entrega.'); end;
  if dd is null then perform _fail('Escolha uma data de entrega.'); end if;
  lim := today + coalesce((d->>'maxDaysAhead')::int, 60);
  earliest := today + coalesce((d->>'leadTimeDays')::int, 0) + case when extract(hour from now_l) >= coalesce((d->>'cutoffHour')::int, 24) then 1 else 0 end;
  while earliest <= lim and (not (d->'weekdays' @> to_jsonb(extract(dow from earliest)::int)) or (d->'blackoutDates' @> to_jsonb(earliest::text))) loop
    earliest := earliest + 1;
  end loop;
  if dd < earliest then perform _fail('Esta data é anterior à primeira data de entrega disponível.'); end if;
  if dd > lim then perform _fail('Esta data está demasiado longe. Escolha uma data mais próxima.'); end if;
  if not (d->'weekdays' @> to_jsonb(extract(dow from dd)::int)) then perform _fail('Não fazemos entregas neste dia da semana.'); end if;
  if d->'blackoutDates' @> to_jsonb(dd::text) then perform _fail('Esta data não está disponível para entregas.'); end if;
  if jsonb_array_length(coalesce(d->'timeSlots', '[]'::jsonb)) > 0 and not (d->'timeSlots' @> to_jsonb(coalesce(input->>'timeSlot', ''))) then
    perform _fail('Escolha um horário de entrega.');
  end if;

  -- Métodos de pagamento ativos no lançamento: pagamento após confirmação.
  if pay not in ('mbway', 'transferencia') then perform _fail('Escolha um método de pagamento.'); end if;

  seq := nextval('public.order_seq');
  num := 'SA-' || to_char(today, 'YYYY') || '-' || lpad(seq::text, 5, '0');

  data := jsonb_build_object(
    'id', oid, 'number', num, 'createdAt', at, 'customerId', auth.uid(),
    'customer', jsonb_build_object(
      'name', trim(cust->>'name'), 'email', lower(trim(cust->>'email')), 'phone', trim(cust->>'phone'),
      'type', case when cust->>'type' = 'revenda' then 'revenda' else 'particular' end,
      'businessName', nullif(trim(coalesce(cust->>'businessName', '')), ''), 'nif', nullif(trim(coalesce(cust->>'nif', '')), '')),
    'lines', lines,
    'address', jsonb_build_object('street', trim(addr->>'street'), 'extra', trim(coalesce(addr->>'extra', '')), 'postalCode', pc, 'city', trim(addr->>'city')),
    'zoneName', zone->>'name', 'deliveryDate', dd::text, 'timeSlot', coalesce(input->>'timeSlot', ''),
    'instructions', left(trim(coalesce(input->>'instructions', '')), 500),
    'merchandiseSubtotal', merch, 'productDiscounts', pdisc, 'codeDiscount', code_disc, 'discountCode', code_txt,
    'deliveryFee', fee, 'total', discounted + fee,
    'paymentMethod', pay, 'paymentStatus', 'pendente', 'simulated', false,
    'status', 'recebida', 'statusHistory', jsonb_build_array(jsonb_build_object('status', 'recebida', 'at', at)),
    'notes', '[]'::jsonb);

  insert into public.orders (id, number, customer_id, status, payment_status, delivery_date, data)
  values (oid, num, auth.uid(), 'recebida', 'pendente', dd, data);
  return data;
end $$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

update public.settings set data = jsonb_set(data, '{delivery}', (data->'delivery') || jsonb_build_object(
  'freeThreshold', 0,
  'minOrderAmount', 15,
  'standardFee', 5,
  'zones', '[
    {"id":"z20","name":"Até 20 km","ranges":"1000-1999, 2650-2654, 2675-2679, 2700-2704, 2720-2724, 2730-2734, 2740-2749, 2780-2784, 2790-2799, 2800-2889, 2925-2929, 2950-2959, 2975-2979","fee":5,"enabled":true},
    {"id":"z30","name":"20 a 30 km","ranges":"2620-2629, 2645-2649, 2660-2664, 2670-2674, 2680-2699, 2725-2729, 2735-2739, 2750-2779, 2785-2789, 2890-2924, 2930-2949, 2970-2974","fee":5,"minOrder":50,"enabled":true},
    {"id":"z40","name":"30 a 40 km","ranges":"2600-2619, 2630-2639, 2665-2669, 2705-2719, 2960-2969","fee":7,"minOrder":50,"enabled":true},
    {"id":"z50","name":"40 a 50 km","ranges":"2130-2139, 2640-2644, 2655-2659, 2980-2999","fee":9,"minOrder":50,"enabled":true}
  ]'::jsonb
)), updated_at = now()
where id = 1;
