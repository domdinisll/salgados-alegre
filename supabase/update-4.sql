-- =====================================================================
-- Salgados Alegre — atualização 4 (30/10/2026)
-- Permite escolher o email que recebe os alertas de novas encomendas.
-- Depois de correr, guardar o email com:
--   select vault.create_secret('o-seu-email@exemplo.pt', 'order_alert_email');
-- =====================================================================

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
