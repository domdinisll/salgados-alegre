-- Salgados Alegre — atualização 6 (30/10/2026). Inclui a atualização 5. Correr no SQL Editor → New query → Run.
-- =====================================================================
-- Salgados Alegre — atualização 5 (incluída na 6)
-- 1) Administradores podem apagar encomendas, mas APENAS as canceladas.
-- 2) Informação nutricional, ingredientes e alergénios da Coxinha sem Queijo.
-- Correr no Supabase → SQL Editor → New query → Run. Pode ser corrido mais do que uma vez.
-- =====================================================================

drop policy if exists "orders: admin apaga canceladas" on public.orders;
create policy "orders: admin apaga canceladas" on public.orders for delete
  using (public.is_admin() and status = 'cancelada');

update public.products set data = data || '{"nutrition":{"portionGrams":220,"energyKcal":550,"fat":21,"saturates":5,"carbs":66,"fibre":3,"protein":24,"sodiumMg":1100},"ingredientsList":[{"name":"Peito de frango cozido e desfiado","qty":65,"unit":"g"},{"name":"Farinha de trigo","qty":55,"unit":"g","allergen":"gluten"},{"name":"Caldo de frango","qty":35,"unit":"ml"},{"name":"Batata cozida","qty":20,"unit":"g"},{"name":"Pão ralado (trigo)","qty":12,"unit":"g","allergen":"gluten"},{"name":"Óleo vegetal (absorvido na fritura)","qty":10,"unit":"g"},{"name":"Cebola","qty":8,"unit":"g"},{"name":"Ovo","qty":8,"unit":"g","allergen":"ovos"},{"name":"Margarina","qty":5,"unit":"g"},{"name":"Alho","qty":2,"unit":"g"},{"name":"Salsa e cebolinho","qty":2,"unit":"g"},{"name":"Sal","qty":1,"unit":"g"}],"allergenIds":["gluten","ovos"],"ingredients":"Peito de frango, farinha de TRIGO, caldo de frango, batata, pão ralado (TRIGO), óleo vegetal, cebola, OVO, margarina, alho, salsa, cebolinho, sal.","allergens":"Contém glúten (trigo) e ovo."}'::jsonb, updated_at = now()
  where id = 'g-coxinha';

-- =====================================================================
-- Atualização 6: apagar contas (pelo próprio cliente ou pelo administrador).
-- =====================================================================
-- ---------- Apagar contas ----------
-- As encomendas não são apagadas: ficam guardadas sem ligação à conta (obrigação fiscal de 10 anos).

-- O cliente apaga a própria conta.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then perform _fail('Inicie sessão para apagar a sua conta.'); end if;
  if exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    perform _fail('Contas de administrador não podem ser apagadas a partir do site.');
  end if;
  delete from auth.users where id = auth.uid();
end $$;

-- O administrador apaga a conta de um cliente.
create or replace function public.admin_delete_customer(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then perform _fail('Sem permissão.'); end if;
  if exists (select 1 from public.profiles where id = target and is_admin) then
    perform _fail('Não é possível apagar uma conta de administrador.');
  end if;
  delete from auth.users where id = target;
end $$;

revoke all on function public.delete_my_account() from public, anon;
revoke all on function public.admin_delete_customer(uuid) from public, anon;
grant execute on function public.delete_my_account() to authenticated;
grant execute on function public.admin_delete_customer(uuid) to authenticated;
