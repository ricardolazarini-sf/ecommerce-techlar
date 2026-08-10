// Personas base — FONTE ÚNICA de verdade para as pessoas/empresas "reais".
// Usada tanto pelo seed do e-commerce quanto pelo gerador de CSV do app. Manter
// aqui garante SOBREPOSIÇÃO de CPF/CNPJ entre as fontes, que é o que permite ao
// Data 360 demonstrar Identity Resolution (mesma pessoa em silos diferentes).

// -------- B2C: pessoas físicas (CPF válido) --------
export const BASE_PEOPLE = [
  { nome: 'Ana Beatriz Souza', email: 'ana.souza@example.com', phone: '11987654321', cpf: '39053344705', variants: 3 },
  { nome: 'Bruno Carvalho Lima', email: 'bruno.lima@example.com', phone: '21998877665', cpf: '15350946056', variants: 3 },
  { nome: 'Carla Menezes', email: 'carla.menezes@example.com', phone: '31991234567', cpf: '11144477735', variants: 2 },
  { nome: 'Diego Fernandes', email: 'diego.fernandes@example.com', phone: '41996543210', cpf: '22233344405', variants: 2 },
  { nome: 'Eduarda Nogueira', email: 'eduarda.nogueira@example.com', phone: '51993334455', cpf: '35524680827', variants: 3 },
  { nome: 'Felipe Andrade', email: 'felipe.andrade@example.com', phone: '61992223344', cpf: '76399483043', variants: 2 },
  { nome: 'Gabriela Rocha', email: 'gabriela.rocha@example.com', phone: '71994445566', cpf: '48874935007', variants: 2 },
  { nome: 'Henrique Barbosa', email: 'henrique.barbosa@example.com', phone: '81995556677', cpf: '90291074060', variants: 1 },
  { nome: 'Isabela Martins', email: 'isabela.martins@example.com', phone: '85996667788', cpf: '30719088010', variants: 2 },
  { nome: 'João Pedro Alves', email: 'joao.alves@example.com', phone: '11987771122', cpf: '64913872085', variants: 3 },
  { nome: 'Karina Duarte', email: 'karina.duarte@example.com', phone: '19988882233', cpf: '82530816000', variants: 2 },
  { nome: 'Lucas Ribeiro', email: 'lucas.ribeiro@example.com', phone: '48997773344', cpf: '17033259032', variants: 2 },
  { nome: 'Mariana Teixeira', email: 'mariana.teixeira@example.com', phone: '27996664455', cpf: '52998224725', variants: 3 },
  { nome: 'Nathan Gomes', email: 'nathan.gomes@example.com', phone: '92995551166', cpf: '39895342061', variants: 1 },
  { nome: 'Olívia Castro', email: 'olivia.castro@example.com', phone: '84994442277', cpf: '20817644089', variants: 2 },
  { nome: 'Paulo Henrique Dias', email: 'paulo.dias@example.com', phone: '11983331188', cpf: '46664112030', variants: 2 },
  { nome: 'Renata Cardoso', email: 'renata.cardoso@example.com', phone: '31982223399', cpf: '73465432101', variants: 2 },
  { nome: 'Sérgio Moura', email: 'sergio.moura@example.com', phone: '11981114455', cpf: '55544433302', variants: 2 },
];

// Completa os 2 dígitos verificadores de um CNPJ a partir de uma base de 12
// dígitos, garantindo CNPJs sintaticamente válidos nas personas B2B.
function cnpjFromBase(base12) {
  const dv = (base, weights) => {
    const sum = base.split('').reduce((a, d, i) => a + parseInt(d, 10) * weights[i], 0);
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = dv(base12, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = dv(base12 + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base12}${d1}${d2}`;
}

// -------- B2B: pessoas jurídicas (CNPJ válido) --------
export const BASE_COMPANIES = [
  {
    account_name: 'Padaria do João LTDA',
    cnpj: cnpjFromBase('112223330001'),
    email: 'vendas@padariadojoao.com.br',
    phone: '1133224455',
    address_line1: 'Rua do Pão 100',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '01010000',
  },
  {
    account_name: 'TechParts Distribuidora ME',
    cnpj: cnpjFromBase('445566770001'),
    email: 'compras@techparts.com.br',
    phone: '1140028922',
    address_line1: 'Av. das Indústrias 2000',
    city: 'Campinas',
    state: 'SP',
    postal_code: '13010000',
  },
  {
    account_name: 'Mercado Central Comércio LTDA',
    cnpj: cnpjFromBase('778899110001'),
    email: 'financeiro@mercadocentral.com.br',
    phone: '2138889090',
    address_line1: 'Rua do Comércio 55',
    city: 'Rio de Janeiro',
    state: 'RJ',
    postal_code: '20010000',
  },
  {
    account_name: 'Oliveira & Filhos Materiais',
    cnpj: cnpjFromBase('223344550001'),
    email: 'contato@oliveirafilhos.com.br',
    phone: '3133445566',
    address_line1: 'Av. Amazonas 1200',
    city: 'Belo Horizonte',
    state: 'MG',
    postal_code: '30110000',
  },
];

export default { BASE_PEOPLE, BASE_COMPANIES };
