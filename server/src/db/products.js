// Catálogo oficial — espelha os produtos da org (Price Book) para que o SKU sirva
// de chave de junção entre o site e o Data 360. Fonte única, usada pelo seed e
// pelo script de carga do catálogo (scripts/load-org-catalog.mjs).
//
// >>> IMAGENS DOS PRODUTOS <<<
// Coloque a URL da imagem real em `imagem_url` de cada item abaixo. Aceita:
//   - URL externa:  'https://.../iphone-17.png'
//   - arquivo local: coloque o PNG/JPG em client/public/products/ e referencie
//                    por caminho relativo, ex.: '/products/iphone-17.png'
// Se `imagem_url` ficar vazio (''), cai no fallback determinístico (imageFor).
// Depois de editar, aplique com:  npm run load:catalog  (atualiza no banco).
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
    imagem_url: '',
  },
  {
    sku: 'GSGH2J232111',
    nome: 'iPhone 17 Pro Max',
    categoria: 'smartphones',
    preco: 18902.0,
    descricao: 'iPhone 17 Pro Max com tela ProMotion, câmera profissional e bateria de longa duração.',
    imagem_url: '',
  },
  {
    sku: 'MacBookM4Air',
    nome: 'MacBook Air M4',
    categoria: 'notebooks',
    preco: 10000.0,
    descricao: 'MacBook Air com chip M4, ultraleve, silencioso e com grande autonomia de bateria.',
    imagem_url: '',
  },
  {
    sku: 'GSGH2J232xxsssssss',
    nome: 'MacBook Air M5',
    categoria: 'notebooks',
    preco: 18902.0,
    descricao: 'MacBook Air com chip M5, desempenho superior para trabalho e criação.',
    imagem_url: '',
  },
  {
    sku: 'IMP-3D-PREMIUM',
    nome: 'Impressora 3D Premium',
    categoria: 'impressoras-3d',
    preco: 5500.0,
    descricao: 'Impressora 3D de alta precisão, ideal para prototipagem e projetos avançados.',
    imagem_url: '',
  },
  {
    sku: 'IMP-3D-PLUS',
    nome: 'Impressora 3D Plus Premium',
    categoria: 'impressoras-3d',
    preco: 7865.0,
    descricao: 'Impressora 3D Plus com maior volume de impressão e recursos profissionais.',
    imagem_url: '',
  },
  {
    sku: 'CABO-USB',
    nome: 'Cabo USB',
    categoria: 'perifericos',
    preco: 20.0,
    descricao: 'Cabo USB de alta durabilidade para carga e transferência de dados.',
    imagem_url: '',
  },
];

// Imagem determinística por SKU (fallback quando imagem_url estiver vazio).
// Carregada só no browser em runtime, nunca durante o build.
export const imageFor = (sku) => `https://picsum.photos/seed/techlar-${sku}/800/600`;

export default { ORG_PRODUCTS, imageFor };
