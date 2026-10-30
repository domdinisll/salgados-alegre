import { useId, type ReactNode } from 'react';
import type { Product } from '../types';

/**
 * Ilustrações de substituição para os produtos, desenhadas em SVG.
 * Para usar fotografias reais, basta carregar uma imagem no painel de administração
 * (campo "Imagem"): a fotografia passa a ser mostrada no lugar da ilustração.
 */

const BG: Record<string, string> = {
  coxinha: '#f6e7c9', empada: '#e7efe2', croquete: '#f3e2cf', frango: '#f6ead2',
  milho: '#f7efc8', salsicha: '#f3e0d6', mistos: '#e5eee6', rissol: '#f5e4d2',
};

function Snack({ id, children }: { id: string; children: ReactNode }) {
  return (
    <g>
      {children}
      <rect width="400" height="300" fill={`url(#${id}-crumb)`} style={{ mixBlendMode: 'multiply' }} clipPath={`url(#${id}-clip)`} />
    </g>
  );
}

export function ProductArt({ product, className = '' }: { product: Pick<Product, 'art' | 'name' | 'imageUrl'>; className?: string }) {
  const id = useId().replace(/:/g, '');
  if (product.imageUrl) {
    return <img src={product.imageUrl} alt={product.name} className={`w-full h-full object-cover ${className}`} loading="lazy" />;
  }
  const g = `${id}-g`;
  const shapes = SHAPES[product.art] ?? SHAPES.mistos;
  return (
    <svg viewBox="0 0 400 300" className={`w-full h-full block ${className}`} role="img" aria-label={`Ilustração: ${product.name}`} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={g} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f6c56c" />
          <stop offset=".55" stopColor="#dc9139" />
          <stop offset="1" stopColor="#a85a17" />
        </radialGradient>
        <radialGradient id={`${id}-g2`} cx="40%" cy="30%" r="80%">
          <stop offset="0" stopColor="#f8d58c" />
          <stop offset=".6" stopColor="#e3a24f" />
          <stop offset="1" stopColor="#b8702a" />
        </radialGradient>
        <pattern id={`${id}-crumb`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="4" r="1.3" fill="#9a5413" opacity=".35" />
          <circle cx="10" cy="9" r="1" fill="#7a3f0c" opacity=".3" />
          <circle cx="6" cy="12" r=".8" fill="#fff3d0" opacity=".5" />
        </pattern>
        <clipPath id={`${id}-clip`}>{shapes(`url(#${g})`, `url(#${id}-g2)`, true)}</clipPath>
      </defs>
      <rect width="400" height="300" fill={BG[product.art] ?? '#efe7d6'} />
      <circle cx="330" cy="40" r="90" fill="#ffffff" opacity=".35" />
      <ellipse cx="200" cy="232" rx="165" ry="38" fill="#000" opacity=".07" />
      <ellipse cx="200" cy="218" rx="160" ry="42" fill="#fffdf8" />
      <ellipse cx="200" cy="218" rx="140" ry="32" fill="none" stroke="#e9e1d1" strokeWidth="2" />
      <Snack id={id}>{shapes(`url(#${g})`, `url(#${id}-g2)`, false)}</Snack>
    </svg>
  );
}

type ShapeFn = (fill: string, fill2: string, clip: boolean) => ReactNode;

const drop = (x: number, y: number, s: number, r: number, fill: string) => (
  <path
    key={`${x}${y}`}
    transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}
    d="M0,-70 C14,-52 46,-18 46,14 C46,44 24,60 0,60 C-24,60 -46,44 -46,14 C-46,-18 -14,-52 0,-70 Z"
    fill={fill}
  />
);
const capsule = (x: number, y: number, w: number, h: number, r: number, fill: string) => (
  <rect key={`${x}${y}`} x={-w / 2} y={-h / 2} width={w} height={h} rx={h / 2} transform={`translate(${x} ${y}) rotate(${r})`} fill={fill} />
);
const moon = (x: number, y: number, s: number, r: number, fill: string) => (
  <path key={`${x}${y}`} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`} d="M-70,10 A70,62 0 0 1 70,10 Q70,22 58,22 L-58,22 Q-70,22 -70,10 Z" fill={fill} />
);
const ball = (x: number, y: number, r: number, fill: string) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill={fill} />;

const SHAPES: Record<string, ShapeFn> = {
  coxinha: (f, f2) => [drop(140, 170, 0.95, -14, f), drop(262, 166, 0.95, 12, f2), drop(200, 192, 1.05, 0, f)],
  croquete: (f, f2) => [capsule(160, 178, 150, 52, -18, f2), capsule(240, 186, 150, 52, 14, f), capsule(200, 206, 160, 56, -3, f)],
  frango: (f, f2) => [ball(140, 196, 36, f2), ball(200, 176, 38, f), ball(262, 198, 36, f), ball(176, 214, 34, f), ball(232, 218, 34, f2)],
  milho: (f, f2, clip) => [
    ball(146, 196, 38, f2), ball(256, 196, 38, f), ball(200, 184, 42, f),
    ...(clip ? [] : [
      <circle key="mi" cx="200" cy="184" r="26" fill="#fbe7a1" />,
      ...[[-10, -8], [6, -12], [14, 2], [-4, 6], [-14, 6], [6, 14]].map(([dx, dy], i) => (
        <ellipse key={`k${i}`} cx={200 + dx} cy={184 + dy} rx="5" ry="6" fill="#f2c230" />
      )),
    ]),
  ],
  salsicha: (f, f2, clip) => [
    ...(clip ? [] : [
      <rect key="s1" x="-92" y="-14" width="184" height="28" rx="14" transform="translate(170 176) rotate(-10)" fill="#b4573a" />,
      <rect key="s2" x="-92" y="-14" width="184" height="28" rx="14" transform="translate(236 204) rotate(6)" fill="#b4573a" />,
    ]),
    capsule(170, 176, 140, 50, -10, f2), capsule(236, 204, 140, 50, 6, f),
  ],
  rissol: (f, f2, clip) => [
    moon(150, 190, 0.95, -10, f2), moon(250, 192, 0.95, 10, f), moon(200, 206, 1.05, 0, f),
    ...(clip ? [] : Array.from({ length: 12 }, (_, i) => (
      <circle key={`c${i}`} cx={132 + i * 12.5} cy={228} r="4.2" fill="#c27a2c" />
    ))),
  ],
  empada: (_f, f2, clip) => {
    const tart = (cx: number, cy: number, r: number, key: string) => (
      <g key={key}>
        {!clip && Array.from({ length: 18 }, (_, i) => {
          const a = (i / 18) * Math.PI * 2;
          return <circle key={i} cx={cx + Math.cos(a) * r} cy={cy + Math.sin(a) * r * 0.62} r={r * 0.17} fill="#d9a35a" />;
        })}
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 0.62} fill={f2} />
        {!clip && <ellipse cx={cx} cy={cy - 4} rx={r * 0.62} ry={r * 0.36} fill="#f7d48c" opacity=".7" />}
      </g>
    );
    return [tart(150, 196, 54, 'a'), tart(256, 198, 54, 'b'), tart(204, 176, 50, 'c')];
  },
  mistos: (f, f2) => [
    drop(130, 186, 0.7, -12, f), capsule(214, 206, 120, 44, -6, f2), moon(286, 196, 0.62, 12, f),
    ball(176, 168, 28, f2), ball(256, 170, 26, f),
  ],
};
