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
