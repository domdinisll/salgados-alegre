// Gera supabase/seed.sql a partir do catálogo e das definições do código.
// Usa "on conflict do nothing": voltar a correr não apaga alterações feitas no painel.
import { build } from 'esbuild';
import fs from 'node:fs';
const out = await build({
  stdin: { contents: "export { SAMPLE_PRODUCTS } from './src/data/products'; export { DEFAULT_SETTINGS } from './src/config/defaults';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'node',
});
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'));
const settings = structuredClone(mod.DEFAULT_SETTINGS);
settings.pricing.codes = [];          // sem códigos de desconto de exemplo na loja real
settings.sampleData = false;
const q = (v) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
let sql = `-- Gerado por scripts/gen-seed.mjs. Dados iniciais da loja.\n`;
sql += `insert into public.settings (id, data) values (1, ${q(settings)}) on conflict (id) do nothing;\n\n`;
mod.SAMPLE_PRODUCTS.forEach((p, i) => {
  sql += `insert into public.products (id, data, sort) values ('${p.id}', ${q(p)}, ${i}) on conflict (id) do nothing;\n`;
});
fs.writeFileSync('supabase/seed.sql', sql);
console.log(`seed.sql: ${mod.SAMPLE_PRODUCTS.length} produtos`);
