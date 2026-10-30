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
