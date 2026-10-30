import type { Product } from '../types';

// Catálogo e preços indicados pelo negócio (30/10/2026).
// Grandes em packs de 50, médios em packs de 25, miniatura em packs de 100.
// A confirmar: descrições, ingredientes e alergénios.

type Base = Pick<Product, 'id' | 'slug' | 'name' | 'category' | 'shortDescription' | 'art'> & Partial<Product>;

const GRANDE = 'Salgados grandes';
const MEDIO = 'Salgados médios';
const MINI = 'Salgados miniatura';
const AVULSO = 'Pão de queijo e empadas';

function make(b: Base, prep: Product['prep'], packSizes: number[], minOrderUnits: number): Product {
  return {
    description: b.shortDescription,
    ingredients: '',
    allergens: '',
    packSizes,
    minOrderUnits,
    prep,
    tiers: [],
    availability: 'disponivel',
    stock: null,
    active: true,
    featured: false,
    resale: true,
    wholesaleOnly: false,
    sampleData: false,
    ...b,
  };
}

const fritoCongelado = (frito: number, congelado: number): Product['prep'] => ({
  frito: { enabled: true, unitPrice: frito },
  congelado: { enabled: true, unitPrice: congelado },
});
// Pão de queijo e empada: prontos a servir ou congelados para ir ao forno, ao mesmo preço.
const prontoOuForno = (preco: number): Product['prep'] => ({
  pronto: { enabled: true, unitPrice: preco },
  congelado_forno: { enabled: true, unitPrice: preco },
});

// Grandes: 1,40 € frito / 1,30 € congelado (por unidade)
const grande = (b: Base) => make({ ...b, category: GRANDE }, fritoCongelado(1.4, 1.3), [50], 50);
// Médios: 1,00 € frito / 0,90 € congelado (por unidade)
const medio = (b: Base) => make({ ...b, category: MEDIO }, fritoCongelado(1.0, 0.9), [25], 25);
// Miniaturas: 100 unidades = 25,00 € frito / 20,00 € congelado
const mini = (b: Base) => make({ ...b, category: MINI }, fritoCongelado(0.25, 0.2), [100], 100);

export const SAMPLE_PRODUCTS: Product[] = [
  // ----- Salgados grandes -----
  grande({ id: 'g-coxinha-queijo', slug: 'coxinha-com-queijo', name: 'Coxinha com Queijo', category: GRANDE, art: 'coxinha', featured: true,
    shortDescription: 'Coxinha grande de frango com queijo.' }),
  grande({ id: 'g-coxinha', slug: 'coxinha-sem-queijo', name: 'Coxinha sem Queijo', category: GRANDE, art: 'coxinha',
    shortDescription: 'Coxinha grande de frango, sem queijo.' }),
  grande({ id: 'g-rissol-frango-milho-queijo', slug: 'rissol-de-frango-milho-e-queijo', name: 'Rissol de Frango, Milho e Queijo', category: GRANDE, art: 'rissol', featured: true,
    shortDescription: 'Rissol grande recheado com frango, milho e queijo.' }),
  grande({ id: 'g-rolinho-fiambre-queijo', slug: 'rolinho-de-fiambre-e-queijo', name: 'Rolinho de Fiambre e Queijo', category: GRANDE, art: 'croquete',
    shortDescription: 'Rolinho grande recheado com fiambre e queijo.' }),
  grande({ id: 'g-rolinho-salsicha-queijo', slug: 'rolinho-de-salsicha-e-queijo', name: 'Rolinho de Salsicha e Queijo', category: GRANDE, art: 'salsicha',
    shortDescription: 'Rolinho grande com salsicha e queijo.' }),
  grande({ id: 'g-pastel-carne-queijo', slug: 'pastel-de-carne-com-queijo', name: 'Pastel de Carne com Queijo', category: GRANDE, art: 'rissol',
    shortDescription: 'Pastel grande recheado com carne e queijo.' }),

  // ----- Salgados médios -----
  medio({ id: 'm-camarao', slug: 'rissol-de-camarao-medio', name: 'Rissol de Camarão', category: MEDIO, art: 'rissol', featured: true,
    shortDescription: 'Rissol de camarão de tamanho médio.' }),
  medio({ id: 'm-croquete-carne', slug: 'croquete-de-carne-medio', name: 'Croquete de Carne', category: MEDIO, art: 'croquete', featured: true,
    shortDescription: 'Croquete de carne de tamanho médio.' }),
  medio({ id: 'm-pastel-bacalhau', slug: 'pastel-de-bacalhau-medio', name: 'Pastel de Bacalhau', category: MEDIO, art: 'croquete',
    shortDescription: 'Pastel de bacalhau de tamanho médio.' }),
  medio({ id: 'm-coxinha', slug: 'coxinha-media', name: 'Coxinha', category: MEDIO, art: 'coxinha',
    shortDescription: 'Coxinha de tamanho médio.' }),
  medio({ id: 'm-salsicha', slug: 'salsicha-media', name: 'Salsicha', category: MEDIO, art: 'salsicha',
    shortDescription: 'Salgado médio de salsicha.' }),
  medio({ id: 'm-fiambre-queijo', slug: 'fiambre-e-queijo-medio', name: 'Fiambre e Queijo', category: MEDIO, art: 'croquete',
    shortDescription: 'Salgado médio de fiambre e queijo.' }),

  // ----- Pão de queijo e empadas -----
  make({ id: 'a-pao-queijo', slug: 'pao-de-queijo', name: 'Pão de Queijo', category: AVULSO, art: 'milho', featured: true,
    shortDescription: 'Pão de queijo, à unidade.' }, prontoOuForno(0.9), [10, 25, 50, 100], 10),
  make({ id: 'a-empada', slug: 'empada', name: 'Empada', category: AVULSO, art: 'empada', featured: true,
    shortDescription: 'Empada, à unidade.' }, prontoOuForno(1.0), [10, 25, 50, 100], 10),

  // ----- Salgados miniatura (vendidos em packs de 100) -----
  mini({ id: 'n-coxinha-frango', slug: 'mini-coxinha-de-frango', name: 'Mini Coxinha de Frango', category: MINI, art: 'coxinha', featured: true,
    shortDescription: 'Coxinhas de frango em miniatura, ideais para festas.' }),
  mini({ id: 'n-fiambre-queijo', slug: 'mini-fiambre-e-queijo', name: 'Mini Fiambre e Queijo', category: MINI, art: 'croquete',
    shortDescription: 'Salgados miniatura de fiambre e queijo.' }),
  mini({ id: 'n-bolinha-queijo', slug: 'mini-bolinha-de-queijo', name: 'Mini Bolinha de Queijo', category: MINI, art: 'milho',
    shortDescription: 'Bolinhas de queijo em miniatura.' }),
  mini({ id: 'n-pao-queijo', slug: 'mini-pao-de-queijo', name: 'Mini Pão de Queijo', category: MINI, art: 'frango',
    shortDescription: 'Pão de queijo em miniatura.' }),
  mini({ id: 'n-rissol-camarao', slug: 'mini-rissol-de-camarao', name: 'Mini Rissol de Camarão', category: MINI, art: 'rissol',
    shortDescription: 'Rissóis de camarão em miniatura.' }),
  mini({ id: 'n-croquete-carne', slug: 'mini-croquete-de-carne', name: 'Mini Croquete de Carne', category: MINI, art: 'croquete',
    shortDescription: 'Croquetes de carne em miniatura.' }),
  mini({ id: 'n-pastel-bacalhau', slug: 'mini-pastel-de-bacalhau', name: 'Mini Pastel de Bacalhau', category: MINI, art: 'croquete',
    shortDescription: 'Pastéis de bacalhau em miniatura.' }),
  mini({ id: 'n-salsicha', slug: 'mini-salsicha', name: 'Mini Salsicha', category: MINI, art: 'salsicha',
    shortDescription: 'Salgados de salsicha em miniatura.' }),
];
