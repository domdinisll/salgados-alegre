-- =====================================================================
-- Salgados Alegre — atualização 5 (30/10/2026)
-- 1) Administradores podem apagar encomendas, mas APENAS as canceladas.
-- 2) Informação nutricional, ingredientes e alergénios da Coxinha sem Queijo.
-- Correr no Supabase → SQL Editor → New query → Run. Pode ser corrido mais do que uma vez.
-- =====================================================================

drop policy if exists "orders: admin apaga canceladas" on public.orders;
create policy "orders: admin apaga canceladas" on public.orders for delete
  using (public.is_admin() and status = 'cancelada');

update public.products set data = data || '{"nutrition":{"portionGrams":220,"energyKcal":550,"fat":21,"saturates":5,"carbs":66,"fibre":3,"protein":24,"sodiumMg":1100},"ingredientsList":[{"name":"Peito de frango cozido e desfiado","qty":65,"unit":"g"},{"name":"Farinha de trigo","qty":55,"unit":"g","allergen":"gluten"},{"name":"Caldo de frango","qty":35,"unit":"ml"},{"name":"Batata cozida","qty":20,"unit":"g"},{"name":"Pão ralado (trigo)","qty":12,"unit":"g","allergen":"gluten"},{"name":"Óleo vegetal (absorvido na fritura)","qty":10,"unit":"g"},{"name":"Cebola","qty":8,"unit":"g"},{"name":"Ovo","qty":8,"unit":"g","allergen":"ovos"},{"name":"Margarina","qty":5,"unit":"g"},{"name":"Alho","qty":2,"unit":"g"},{"name":"Salsa e cebolinho","qty":2,"unit":"g"},{"name":"Sal","qty":1,"unit":"g"}],"allergenIds":["gluten","ovos"],"ingredients":"Peito de frango, farinha de TRIGO, caldo de frango, batata, pão ralado (TRIGO), óleo vegetal, cebola, OVO, margarina, alho, salsa, cebolinho, sal.","allergens":"Contém glúten (trigo) e ovo."}'::jsonb, updated_at = now()
  where id = 'g-coxinha';
