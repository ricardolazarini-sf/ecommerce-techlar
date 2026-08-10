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
    imagem_url: 'https://bemol.vtexassets.com/arquivos/ids/548380-1200-1200?v=639087359262700000&width=1200&height=1200&aspect=true',
  },
  {
    sku: 'GSGH2J232111',
    nome: 'iPhone 17 Pro Max',
    categoria: 'smartphones',
    preco: 18902.0,
    descricao: 'iPhone 17 Pro Max com tela ProMotion, câmera profissional e bateria de longa duração.',
    imagem_url: 'https://images6.kabum.com.br/produtos/fotos/925356/iphone-17-pro-max-apple-256gb-48mp-tela-6-9-super-retina-xdr-laranja-cosmico_1757696972_gg.jpg',
  },
  {
    sku: 'MacBookM4Air',
    nome: 'MacBook Air M4',
    categoria: 'notebooks',
    preco: 10000.0,
    descricao: 'MacBook Air com chip M4, ultraleve, silencioso e com grande autonomia de bateria.',
    imagem_url: 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-mba15-m4-midnight-202503?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=aXh2djVPaDJVSUtvM2FsZmN0NGxlUUpQK2FzS25mbnVTcVVpU2Z2MzcyV3dNd3VBeE01aHVoRDJMZG9nOTdLcUNBd3lOUFpnTTVCeDVDYzlNNEhMcFROQ21LMitMSlNmdGs1dGQwVDRNeVNLUDlIQ2d5TnZKU1lrWjBsRjNhYUs',
  },
  {
    sku: 'GSGH2J232xxsssssss',
    nome: 'MacBook Air M5',
    categoria: 'notebooks',
    preco: 18902.0,
    descricao: 'MacBook Air com chip M5, desempenho superior para trabalho e criação.',
    imagem_url: 'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-mba15-m4-midnight-202503?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=aXh2djVPaDJVSUtvM2FsZmN0NGxlUUpQK2FzS25mbnVTcVVpU2Z2MzcyV3dNd3VBeE01aHVoRDJMZG9nOTdLcUNBd3lOUFpnTTVCeDVDYzlNNEhMcFROQ21LMitMSlNmdGs1dGQwVDRNeVNLUDlIQ2d5TnZKU1lrWjBsRjNhYUs',
  },
  {
    sku: 'IMP-3D-PREMIUM',
    nome: 'Impressora 3D Premium',
    categoria: 'impressoras-3d',
    preco: 5500.0,
    descricao: 'Impressora 3D de alta precisão, ideal para prototipagem e projetos avançados.',
    imagem_url: 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1028046/xlarge/Impressora-3d-Bambu-Lab-H2c-110v-Ams-2-Pro-Kit-Pf003-c-sa007_1777299217.jpg',
  },
  {
    sku: 'IMP-3D-PLUS',
    nome: 'Impressora 3D Plus Premium',
    categoria: 'impressoras-3d',
    preco: 7865.0,
    descricao: 'Impressora 3D Plus com maior volume de impressão e recursos profissionais.',
    imagem_url: 'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1028046/xlarge/Impressora-3d-Bambu-Lab-H2c-110v-Ams-2-Pro-Kit-Pf003-c-sa007_1777299217.jpg',
  },
  {
    sku: 'CABO-USB',
    nome: 'Cabo USB',
    categoria: 'perifericos',
    preco: 20.0,
    descricao: 'Cabo USB de alta durabilidade para carga e transferência de dados.',
    imagem_url: 'https://cdn.awsli.com.br/600x700/468/468162/produto/60496535/5df0fea9c6.jpg',
  },
];

// Imagem determinística por SKU (fallback quando imagem_url estiver vazio).
// Carregada só no browser em runtime, nunca durante o build.
export const imageFor = (sku) => `https://picsum.photos/seed/techlar-${sku}/800/600`;

export default { ORG_PRODUCTS, imageFor };
