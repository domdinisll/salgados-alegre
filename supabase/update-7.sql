-- =====================================================================
-- Salgados Alegre — atualização 7 (30/10/2026)
-- Email ao CLIENTE em cada encomenda: resumo da encomenda + dados para pagamento
-- (MB WAY ou IBAN, definidos no painel em Negócio → Dados de pagamento).
--
-- O email ao cliente só é enviado depois de existir um remetente com domínio
-- verificado na Resend. Quando o domínio estiver verificado, guardar com:
--   select vault.create_secret('Salgados Alegre <encomendas@o-seu-dominio.pt>', 'email_from');
-- Sem esse segredo, o cliente não recebe email (o alerta para a loja continua igual).
-- =====================================================================

create or replace function public.email_order_customer(order_id uuid) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  key text; sender text; d jsonb; s jsonb; l jsonb; rows text := ''; html text; td text;
  pay text; paybox text := ''; req bigint; reply text; th text := 'padding:6px 12px 6px 0;color:#666;text-align:left;font-weight:normal';
begin
  select data into d from public.orders where id = order_id;
  if d is null or coalesce(d->'customer'->>'email', '') = '' then return null; end if;
  begin
    select decrypted_secret into key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
    select trim(decrypted_secret) into sender from vault.decrypted_secrets where name = 'email_from' limit 1;
  exception when others then key := null;
  end;
  if coalesce(key, '') = '' or coalesce(sender, '') = '' then return null; end if;
  select data into s from public.settings where id = 1;
  reply := nullif(trim(coalesce(s->'business'->>'email', '')), '');
  if reply is null then
    begin
      select nullif(trim(decrypted_secret), '') into reply from vault.decrypted_secrets where name = 'order_alert_email' limit 1;
    exception when others then reply := null;
    end;
  end if;

  td := 'padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top';
  for l in select * from jsonb_array_elements(d->'lines') loop
    rows := rows || format('<tr><td style="%s"><b>%s</b><br><span style="color:#666">%s</span></td><td style="%s">%s × pack de %s<br><span style="color:#666">%s unidades</span></td><td style="%s;text-align:right;white-space:nowrap">%s</td></tr>',
      td, _esc(l->>'productName'), _prep_label(l->>'prep'), td, l->>'quantity', l->>'packSize', l->>'units', td, _eur((l->>'total')::numeric));
  end loop;
  pay := case d->>'paymentMethod' when 'mbway' then 'MB WAY' when 'transferencia' then 'Transferência bancária' else d->>'paymentMethod' end;

  if d->>'paymentMethod' = 'mbway' and coalesce(s->'payment'->>'mbwayPhone', '') <> '' then
    paybox := format('<tr><th style="%s">MB WAY para</th><td><b>%s</b></td></tr>', th, _esc(s->'payment'->>'mbwayPhone'));
  elsif d->>'paymentMethod' = 'transferencia' and coalesce(s->'payment'->>'iban', '') <> '' then
    paybox := format('<tr><th style="%s">IBAN</th><td><b>%s</b></td></tr>', th, _esc(s->'payment'->>'iban'))
      || case when coalesce(s->'payment'->>'accountHolder', '') <> '' then format('<tr><th style="%s">Titular</th><td>%s</td></tr>', th, _esc(s->'payment'->>'accountHolder')) else '' end;
  end if;
  if paybox <> '' then
    paybox := format($p$
  <div style="background:#f3f8f4;border:1px solid #cfe3d5;border-radius:10px;padding:14px 16px;margin:0 0 20px">
    <h3 style="color:#1d5034;margin:0 0 8px">Como pagar (%s)</h3>
    <table style="border-collapse:collapse;font-size:15px">
      <tr><th style="%s">Valor</th><td><b>%s</b></td></tr>%s
      <tr><th style="%s">Referência</th><td><b>%s</b></td></tr>
    </table>
    %s
  </div>$p$, _esc(pay), th, _eur((d->>'total')::numeric), paybox, th, _esc(d->>'number'),
      case when coalesce(s->'payment'->>'note', '') <> '' then '<p style="margin:10px 0 0;color:#555;font-size:14px">' || _esc(s->'payment'->>'note') || '</p>' else '' end);
  else
    paybox := format('<p style="margin:0 0 20px">Pagamento por <b>%s</b>. Vamos enviar-lhe os dados para pagamento em breve.</p>', _esc(pay));
  end if;

  html := format($h$
<div style="font-family:Arial,sans-serif;color:#23262a;max-width:620px">
  <h2 style="color:#1d5034;margin:0 0 4px">Obrigado pela sua encomenda, %s!</h2>
  <p style="margin:0 0 16px;color:#555">Recebemos a encomenda <b>%s</b>. Confirmamos a encomenda e a data de entrega assim que recebermos o pagamento.</p>
  %s
  <table style="width:100%%;border-collapse:collapse;font-size:14px">%s
    <tr><td colspan="2" style="padding:8px 10px;text-align:right">Taxa de entrega</td><td style="padding:8px 10px;text-align:right">%s</td></tr>
    <tr><td colspan="2" style="padding:8px 10px;text-align:right"><b>Total</b></td><td style="padding:8px 10px;text-align:right"><b>%s</b></td></tr>
  </table>
  <h3 style="color:#1d5034;margin:20px 0 6px">Entrega</h3>
  <p style="margin:0">%s%s<br>%s %s<br><b>Data pedida:</b> %s %s</p>
  %s
  <p style="margin:24px 0 0;color:#777;font-size:13px">Dúvidas? Responda a este email%s.<br>%s · salgados-alegre.vercel.app</p>
</div>$h$,
    _esc(split_part(d->'customer'->>'name', ' ', 1)), _esc(d->>'number'), paybox, rows,
    case when (d->>'deliveryFee')::numeric = 0 then 'Grátis' else _eur((d->>'deliveryFee')::numeric) end,
    _eur((d->>'total')::numeric),
    _esc(d->'address'->>'street'),
    case when coalesce(d->'address'->>'extra', '') <> '' then ', ' || _esc(d->'address'->>'extra') else '' end,
    _esc(d->'address'->>'postalCode'), _esc(d->'address'->>'city'),
    to_char((d->>'deliveryDate')::date, 'DD/MM/YYYY'), _esc(d->>'timeSlot'),
    case when coalesce(d->>'instructions', '') <> '' then '<p style="margin:8px 0 0"><b>Instruções:</b> ' || _esc(d->>'instructions') || '</p>' else '' end,
    case when coalesce(s->'business'->>'phone', '') <> '' then ' ou ligue ' || _esc(s->'business'->>'phone') else '' end,
    _esc(coalesce(s->'business'->>'name', 'Salgados Alegre')));

  select net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || key),
    body := jsonb_strip_nulls(jsonb_build_object(
      'from', sender,
      'to', jsonb_build_array(d->'customer'->>'email'),
      'reply_to', reply,
      'subject', 'Encomenda ' || (d->>'number') || ' recebida · ' || _eur((d->>'total')::numeric),
      'html', html))
  ) into req;
  return req;
end $$;

revoke all on function public.email_order_customer(uuid) from public, anon, authenticated;

create or replace function public.notify_new_order() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin perform public.email_order(new.id); exception when others then null; end;
  begin perform public.email_order_customer(new.id); exception when others then null; end;
  return new; -- um problema no email nunca impede a encomenda
end $$;
