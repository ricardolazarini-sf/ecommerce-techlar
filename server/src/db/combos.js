// Combos de desconto — fonte única, mesma convenção do catálogo em ./products.js.
//
// Um combo é uma REGRA sobre categorias, não uma lista fixa de SKU: o catálogo
// tem 7 produtos, e combo de SKU fixo aí viraria vitrine de duas gôndolas. O
// carrinho qualifica quando tem ao menos um item de cada categoria da regra, e o
// desconto entra sozinho — inclusive para quem montou o mesmo carrinho sem
// clicar no card. O card é a porta de entrada, não a condição.
//
// `imagem_url` aponta para a cena em client/public/combos/: as fotos reais dos
// produtos do combo, recortadas e montadas numa bancada de estúdio por
// brand/combos/build-art.py. Rode o gerador de novo quando as fotos do catálogo
// mudarem ou quando um combo passar a valer para outra categoria.
export const COMBOS = [
  {
    slug: 'mesa-de-trabalho',
    nome: 'Mesa de trabalho',
    regra: 'Notebook + smartphone',
    descricao:
      'O computador que trabalha e o celular que acompanha o resto do dia: as duas telas que você mais usa, no mesmo pedido.',
    percent: 8,
    categorias: ['notebooks', 'smartphones'],
    imagem_url: '/combos/mesa-de-trabalho.jpg',
    ativo: true,
  },
  {
    slug: 'bancada-do-atelie',
    nome: 'Bancada do ateliê',
    regra: 'Impressora 3D + notebook',
    descricao:
      'Modela o projeto no notebook e imprime na 3D ao lado. A dupla de quem tira ideia do papel dentro de casa.',
    percent: 10,
    categorias: ['impressoras-3d', 'notebooks'],
    imagem_url: '/combos/bancada-do-atelie.jpg',
    ativo: true,
  },
  {
    slug: 'casa-inteira',
    nome: 'Casa inteira',
    regra: 'Notebook + smartphone + impressora 3D',
    descricao:
      'Os três equipamentos no mesmo pedido: é o maior desconto da faixa, para quem está equipando tudo de uma vez.',
    percent: 12,
    categorias: ['notebooks', 'smartphones', 'impressoras-3d'],
    imagem_url: '/combos/casa-inteira.jpg',
    ativo: true,
  },
];

export default { COMBOS };
