// Build: esbuild (TypeScript + React) + Tailwind CSS v4 (API de compilação).
// Gera:
//   dist/index.html        – site completo, abrir no navegador ou servir com `npm run serve`
//   dist/standalone.html   – a mesma página com CSS e JS embutidos num só ficheiro
import { build } from 'esbuild';
import { compile } from 'tailwindcss';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
const watch = process.argv.includes('--dev');
fs.mkdirSync(dist, { recursive: true });

// ---------- JS ----------
await build({
  entryPoints: [path.join(root, 'src/main.tsx')],
  bundle: true,
  minify: !watch,
  sourcemap: watch,
  format: 'iife',
  target: ['es2020'],
  jsx: 'automatic',
  outfile: path.join(dist, 'app.js'),
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
  logLevel: 'warning',
});

// ---------- CSS (Tailwind v4) ----------
const require = createRequire(import.meta.url);
const twDir = path.dirname(require.resolve('tailwindcss/package.json'));
const cssEntry = path.join(root, 'src/styles.css');
const compiler = await compile(fs.readFileSync(cssEntry, 'utf8'), {
  base: path.dirname(cssEntry),
  loadStylesheet: async (id, base) => {
    const file = id === 'tailwindcss' ? path.join(twDir, 'index.css') : id.startsWith('tailwindcss/') ? path.join(twDir, id.slice(12)) : path.resolve(base, id);
    return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
  },
});

// Extração simples de candidatos a classes a partir do código-fonte.
const candidates = new Set();
function scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) scan(p);
    else if (/\.(tsx?|html)$/.test(e.name)) {
      for (const tok of fs.readFileSync(p, 'utf8').split(/[\s"'`{}<>;\\]+/)) if (tok && tok.length < 120) candidates.add(tok);
    }
  }
}
scan(path.join(root, 'src'));
const css = compiler.build([...candidates]);
fs.writeFileSync(path.join(dist, 'app.css'), css);

// ---------- HTML ----------
const head = fs.readFileSync(path.join(root, 'src/head.html'), 'utf8');
const js = fs.readFileSync(path.join(dist, 'app.js'), 'utf8').replace(/<\/script/gi, '<\\/script');

fs.writeFileSync(path.join(dist, 'index.html'), `<!doctype html>
<html lang="pt-PT">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${head}
<link rel="stylesheet" href="app.css">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`);

fs.writeFileSync(path.join(dist, 'standalone.html'), `${head}
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`);

const kb = (f) => (fs.statSync(path.join(dist, f)).size / 1024).toFixed(0) + ' KB';
console.log(`Build concluído: app.js ${kb('app.js')}, app.css ${kb('app.css')}, standalone.html ${kb('standalone.html')}`);
