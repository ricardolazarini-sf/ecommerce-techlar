// Catálogo oficial — espelha os produtos da org (Price Book) para que o SKU sirva
// de chave de junção entre o site e o Data 360. Fonte única, usada pelo seed e
// pelo script de carga do catálogo (scripts/load-org-catalog.mjs).
//
// Os 3 últimos itens não tinham SKU visível na org; use um placeholder até
// confirmarmos o SKU real. Troque aqui e rode o seed/carga novamente.
export const ORG_PRODUCTS = [
  {
    sku: 'GSGH2J23213',
    nome: 'iPhone 17',
    categoria: 'smartphones',
    preco: 8608.0,
    descricao: 'iPhone 17 com chip de última geração, câmera avançada e tela Super Retina.',
  },
  {
    sku: 'GSGH2J232111',
    nome: 'iPhone 17 Pro Max',
    categoria: 'smartphones',
    preco: 18902.0,
    descricao: 'iPhone 17 Pro Max com tela ProMotion, câmera profissional e bateria de longa duração.',
  },
  {
    sku: 'MacBookM4Air',
    nome: 'MacBook Air M4',
    categoria: 'notebooks',
    preco: 10000.0,
    descricao: 'MacBook Air com chip M4, ultraleve, silencioso e com grande autonomia de bateria.',
  },
  {
    sku: 'GSGH2J232xxsssssss',
    nome: 'MacBook Air M5',
    categoria: 'notebooks',
    preco: 18902.0,
    descricao: 'MacBook Air com chip M5, desempenho superior para trabalho e criação.',
  },
  {
    sku: 'IMP-3D-PREMIUM',
    nome: 'Impressora 3D Premium',
    categoria: 'impressoras-3d',
    preco: 5500.0,
    descricao: 'Impressora 3D de alta precisão, ideal para prototipagem e projetos avançados.',
  },
  {
    sku: 'IMP-3D-PLUS',
    nome: 'Impressora 3D Plus Premium',
    categoria: 'impressoras-3d',
    preco: 7865.0,
    descricao: 'Impressora 3D Plus com maior volume de impressão e recursos profissionais.',
  },
  {
    sku: 'CABO-USB',
    nome: 'Cabo USB',
    categoria: 'perifericos',
    preco: 20.0,
    descricao: 'Cabo USB de alta durabilidade para carga e transferência de dados.',
  },
];

// Imagem determinística por SKU (carregada só no browser em runtime).
export const imageFor = (sku) => `https://picsum.photos/seed/techlar-${sku}/800/600`;

export default { ORG_PRODUCTS, imageFor };
