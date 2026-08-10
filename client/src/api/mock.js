// API de mentira, inteira em memória: a loja navegável com o Postgres desligado.
//
// Liga com VITE_MOCK=1 (`npm run dev:mock`); o client.js troca o `api` real por
// este objeto. Catálogo, carrinho, conta, checkout, pedidos e lista de desejos
// respondem daqui, e nada sai do browser.
//
// Cada resposta copia campo por campo a do servidor (server/src/**/*.service.js
// e *.repository.js), inclusive status e texto de erro. Forma diferente da real
// é uma tela bonita mentindo sobre o que vai funcionar em produção.

// Mesmos produtos de server/src/db/products.js, com os ids que o seed geraria
// (serial, na ordem de inserção). Copiado porque o Vite não resolve import fora
// de client/ — ao mexer no catálogo de lá, traga a mudança para cá.
const CATALOG = [
  {
    sku: 'GSGH2J23213',
    nome: 'iPhone 17',
    categoria: 'smartphones',
    preco: 8608.0,
    descricao: 'iPhone 17 com chip de última geração, câmera avançada e tela Super Retina.',
    imagem_url:
      'https://bemol.vtexassets.com/arquivos/ids/548380-1200-1200?v=639087359262700000&width=1200&height=1200&aspect=true',
  },
  {
    sku: 'GSGH2J232111',
    nome: 'iPhone 17 Pro Max',
    categoria: 'smartphones',
    preco: 18902.0,
    descricao:
      'iPhone 17 Pro Max com tela ProMotion, câmera profissional e bateria de longa duração.',
    imagem_url:
      'https://images6.kabum.com.br/produtos/fotos/925356/iphone-17-pro-max-apple-256gb-48mp-tela-6-9-super-retina-xdr-laranja-cosmico_1757696972_gg.jpg',
  },
  {
    sku: 'MacBookM4Air',
    nome: 'MacBook Air M4',
    categoria: 'notebooks',
    preco: 10000.0,
    descricao: 'MacBook Air com chip M4, ultraleve, silencioso e com grande autonomia de bateria.',
    imagem_url:
      'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-mba15-m4-midnight-202503?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=aXh2djVPaDJVSUtvM2FsZmN0NGxlUUpQK2FzS25mbnVTcVVpU2Z2MzcyV3dNd3VBeE01aHVoRDJMZG9nOTdLcUNBd3lOUFpnTTVCeDVDYzlNNEhMcFROQ21LMitMSlNmdGs1dGQwVDRNeVNLUDlIQ2d5TnZKU1lrWjBsRjNhYUs',
  },
  {
    sku: 'GSGH2J232xxsssssss',
    nome: 'MacBook Air M5',
    categoria: 'notebooks',
    preco: 18902.0,
    descricao: 'MacBook Air com chip M5, desempenho superior para trabalho e criação.',
    imagem_url:
      'https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/refurb-mba15-m4-midnight-202503?wid=1144&hei=1144&fmt=jpeg&qlt=90&.v=aXh2djVPaDJVSUtvM2FsZmN0NGxlUUpQK2FzS25mbnVTcVVpU2Z2MzcyV3dNd3VBeE01aHVoRDJMZG9nOTdLcUNBd3lOUFpnTTVCeDVDYzlNNEhMcFROQ21LMitMSlNmdGs1dGQwVDRNeVNLUDlIQ2d5TnZKU1lrWjBsRjNhYUs',
  },
  {
    sku: 'IMP-3D-PREMIUM',
    nome: 'Impressora 3D Premium',
    categoria: 'impressoras-3d',
    preco: 5500.0,
    descricao: 'Impressora 3D de alta precisão, ideal para prototipagem e projetos avançados.',
    imagem_url:
      'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1028046/xlarge/Impressora-3d-Bambu-Lab-H2c-110v-Ams-2-Pro-Kit-Pf003-c-sa007_1777299217.jpg',
  },
  {
    sku: 'IMP-3D-PLUS',
    nome: 'Impressora 3D Plus Premium',
    categoria: 'impressoras-3d',
    preco: 7865.0,
    descricao: 'Impressora 3D Plus com maior volume de impressão e recursos profissionais.',
    imagem_url:
      'https://images6.kabum.com.br/produtos/fotos/sync_mirakl/1028046/xlarge/Impressora-3d-Bambu-Lab-H2c-110v-Ams-2-Pro-Kit-Pf003-c-sa007_1777299217.jpg',
  },
  {
    sku: 'CABO-USB',
    nome: 'Cabo USB',
    categoria: 'perifericos',
    preco: 20.0,
    descricao: 'Cabo USB de alta durabilidade para carga e transferência de dados.',
    imagem_url: 'https://cdn.awsli.com.br/600x700/468/468162/produto/60496535/5df0fea9c6.jpg',
  },
].map((p, i) => ({ id: i + 1, ...p }));

// Igual ao config.warrantyRate do servidor: 15% do valor da linha.
const WARRANTY_RATE = 0.15;
// Latência de mentira, para os loaders aparecerem como vão aparecer em produção.
const LATENCY = 180;

const DEMO_LOGIN = { email: 'demo@techlar.com', password: 'techlar123' };

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

const clone = (value) => (value === undefined ? value : JSON.parse(JSON.stringify(value)));

const fail = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const onlyDigits = (value) => String(value || '').replace(/\D+/g, '');

// ---------------------------------------------------------------------------
// Estado da sessão

// Sobrevive ao F5 (sessionStorage) para o passeio não recomeçar do zero a cada
// recarga — com token guardado e carrinho vazio a loja ficaria incoerente. Morre
// ao fechar a aba, que é o tempo de vida de um dado inventado.
const STATE_KEY = 'techlar_mock_v1';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function orderNumberFor(date) {
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('');
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `TL-${stamp}-${suffix}`;
}

function demoCustomer() {
  return {
    id: 1,
    nome: 'Cliente Demo TechLar',
    email: DEMO_LOGIN.email,
    telefone: '+55 (11) 90000-0000',
    documento: '11144477735',
    tipo: 'PF',
    razao_social: null,
    cnpj: null,
    address_line1: 'Av. Paulista 1500',
    city: 'São Paulo',
    state: 'SP',
    postal_code: '01310200',
    country: 'Brasil',
    device_id: 'web-demo',
    created_at: new Date(Date.now() - 90 * 864e5).toISOString(),
  };
}

// A conta de demonstração já vem com histórico e desejos: página vazia mostra o
// vazio, não o layout.
function demoOrder() {
  const created = new Date(Date.now() - 6 * 864e5);
  const items = [
    { product: productById(4), qty: 1, warranty: true },
    { product: productById(7), qty: 2, warranty: false },
  ].map(({ product, qty, warranty }) => ({
    product_id: product.id,
    sku: product.sku,
    nome: product.nome,
    imagem_url: product.imagem_url,
    qty,
    unit_price: product.preco,
    warranty,
  }));
  const totals = totalsFor(items);
  return {
    id: 1,
    order_number: orderNumberFor(created),
    customer_id: 1,
    subtotal: totals.subtotal,
    total: totals.total,
    status: 'confirmed',
    created_at: created.toISOString(),
    items,
  };
}

function freshState() {
  return {
    // Linhas do carrinho: { product_id, qty }. O preço sai sempre do catálogo.
    cart: [],
    // E-mail de quem está logado, ou null.
    session: null,
    accounts: [{ password: DEMO_LOGIN.password, customer: demoCustomer() }],
    orders: [demoOrder()],
    wishlist: [
      { customer_id: 1, product_id: 2, created_at: new Date(Date.now() - 2 * 864e5).toISOString() },
      { customer_id: 1, product_id: 5, created_at: new Date(Date.now() - 9 * 864e5).toISOString() },
    ],
    nextCustomerId: 2,
    nextOrderId: 2,
  };
}

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STATE_KEY));
    if (saved && Array.isArray(saved.cart) && Array.isArray(saved.accounts)) return saved;
  } catch {
    // Estado ilegível é estado descartável: recomeça limpo.
  }
  return freshState();
}

// Carregado na primeira chamada, não na importação: módulo que não faz nada ao
// ser importado é módulo que o Rollup consegue podar do bundle de produção.
let state = null;

function save() {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // Sem espaço ou em modo restrito: o passeio segue só na memória.
  }
}

// ---------------------------------------------------------------------------
// Catálogo

function productById(id) {
  return CATALOG.find((p) => p.id === Number(id)) || null;
}

function requireProduct(id) {
  const product = productById(id);
  if (!product) throw fail(404, 'Produto não encontrado.');
  return product;
}

// ---------------------------------------------------------------------------
// Preços (mesma conta de server/src/cart/cart.logic.js)

function totalsFor(items) {
  let subtotal = 0;
  let warrantyTotal = 0;
  let itemCount = 0;
  for (const item of items) {
    const qty = Number(item.qty) || 0;
    const unitPrice = Number(item.unit_price) || 0;
    subtotal = round2(subtotal + round2(unitPrice * qty));
    if (item.warranty) {
      warrantyTotal = round2(warrantyTotal + round2(unitPrice * WARRANTY_RATE * qty));
    }
    itemCount += qty;
  }
  return { subtotal, warrantyTotal, total: round2(subtotal + warrantyTotal), itemCount };
}

// Itens do carrinho como o servidor os devolve. Garantia não entra aqui: a
// escolha é do checkout, e cart_items nem tem a coluna.
function cartItems() {
  return state.cart.map((line) => {
    const product = productById(line.product_id);
    return {
      product_id: product.id,
      sku: product.sku,
      nome: product.nome,
      categoria: product.categoria,
      imagem_url: product.imagem_url,
      qty: line.qty,
      unit_price: product.preco,
      line_total: round2(product.preco * line.qty),
    };
  });
}

function cartView() {
  const items = cartItems();
  return { cart_id: 1, status: 'open', items, ...totalsFor(items) };
}

// Aceita mapa ({ "3": true }) ou lista de ids, como o checkout do servidor.
function warrantySet(warranties) {
  const set = new Set();
  if (Array.isArray(warranties)) warranties.forEach((id) => set.add(Number(id)));
  else if (warranties && typeof warranties === 'object') {
    for (const [id, on] of Object.entries(warranties)) if (on) set.add(Number(id));
  }
  return set;
}

// ---------------------------------------------------------------------------
// Conta

function accountByEmail(email) {
  const wanted = String(email || '').trim().toLowerCase();
  return state.accounts.find((a) => a.customer.email.toLowerCase() === wanted) || null;
}

function currentAccount() {
  return state.session ? accountByEmail(state.session) : null;
}

function requireAccount() {
  const account = currentAccount();
  if (!account) throw fail(401, 'Sessão expirada. Entre de novo.');
  return account;
}

function myOrders() {
  const account = requireAccount();
  return state.orders
    .filter((o) => o.customer_id === account.customer.id)
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function wishlistItems(customerId) {
  return state.wishlist
    .filter((w) => w.customer_id === customerId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((entry) => {
      const product = productById(entry.product_id);
      return {
        product_id: product.id,
        sku: product.sku,
        nome: product.nome,
        categoria: product.categoria,
        preco: product.preco,
        imagem_url: product.imagem_url,
        created_at: entry.created_at,
      };
    });
}

// ---------------------------------------------------------------------------
// Handlers — síncronos e sem clone; o embrulho lá embaixo cuida disso.

const handlers = {
  getProducts({ q, categoria } = {}) {
    const term = String(q || '').trim().toLowerCase();
    const products = CATALOG.filter((p) => {
      if (categoria && p.categoria !== categoria) return false;
      if (!term) return true;
      return `${p.nome} ${p.descricao}`.toLowerCase().includes(term);
    }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    return { products };
  },

  getFeatured() {
    const products = CATALOG.slice()
      .sort((a, b) => b.preco - a.preco)
      .slice(0, 8);
    return { products };
  },

  getProduct(id) {
    return { product: requireProduct(id) };
  },

  getCategories() {
    const counts = new Map();
    for (const p of CATALOG) counts.set(p.categoria, (counts.get(p.categoria) || 0) + 1);
    const categories = [...counts.entries()]
      .map(([categoria, count]) => ({ categoria, count }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria));
    return { categories };
  },

  getCart() {
    return { cart: cartView() };
  },

  addToCart(productId, qty = 1) {
    const product = requireProduct(productId);
    const line = state.cart.find((l) => l.product_id === product.id);
    if (line) line.qty += Number(qty) || 1;
    else state.cart.push({ product_id: product.id, qty: Number(qty) || 1 });
    return { cart: cartView() };
  },

  updateCartItem(productId, qty) {
    const next = Number(qty);
    if (!Number.isInteger(next) || next < 0) throw fail(400, 'Quantidade inválida.');
    const id = Number(productId);
    if (next === 0) state.cart = state.cart.filter((l) => l.product_id !== id);
    else {
      const line = state.cart.find((l) => l.product_id === id);
      if (line) line.qty = next;
    }
    return { cart: cartView() };
  },

  removeCartItem(productId) {
    state.cart = state.cart.filter((l) => l.product_id !== Number(productId));
    return { cart: cartView() };
  },

  register(input = {}) {
    const tipo = input.tipo === 'PJ' ? 'PJ' : 'PF';
    // Validação de forma fica no formulário; aqui só o que o servidor decide,
    // que é o que a tela não tem como saber sozinha.
    if (accountByEmail(input.email)) {
      throw fail(409, 'Este email já está cadastrado. Faça login.');
    }
    if (!input.password || String(input.password).length < 6) {
      throw fail(400, 'A senha deve ter no mínimo 6 caracteres.');
    }
    // PJ: razão social vira o nome e o documento forte é o CNPJ.
    const customer = {
      id: state.nextCustomerId,
      nome: tipo === 'PJ' ? input.razaoSocial : input.nome,
      email: String(input.email || '').trim(),
      telefone: input.telefone || null,
      documento: tipo === 'PJ' ? null : onlyDigits(input.documento) || null,
      tipo,
      razao_social: tipo === 'PJ' ? input.razaoSocial : null,
      cnpj: tipo === 'PJ' ? onlyDigits(input.cnpj) || null : null,
      address_line1: input.addressLine1 || null,
      city: input.city || null,
      state: input.state || null,
      postal_code: onlyDigits(input.postalCode) || null,
      country: input.country || 'Brasil',
      created_at: new Date().toISOString(),
    };
    state.nextCustomerId += 1;
    state.accounts.push({ password: String(input.password), customer });
    state.session = customer.email;
    return { token: `mock.${customer.id}`, customer };
  },

  login({ email, password } = {}) {
    if (!email || !password) throw fail(400, 'Informe email e senha.');
    const account = accountByEmail(email);
    if (!account || account.password !== password) {
      throw fail(401, 'Email ou senha incorretos.');
    }
    state.session = account.customer.email;
    return { token: `mock.${account.customer.id}`, customer: account.customer };
  },

  me() {
    const account = requireAccount();
    return { customer: account.customer, orders: myOrders() };
  },

  updateProfile(data = {}) {
    const account = requireAccount();
    const c = account.customer;
    if (c.tipo === 'PJ') {
      if (data.razaoSocial !== undefined) {
        c.razao_social = data.razaoSocial;
        c.nome = data.razaoSocial;
      }
      if (data.cnpj !== undefined) c.cnpj = onlyDigits(data.cnpj) || null;
    } else {
      if (data.nome !== undefined) c.nome = data.nome;
      if (data.documento !== undefined) c.documento = onlyDigits(data.documento) || null;
    }
    if (data.telefone !== undefined) c.telefone = data.telefone || null;
    return { customer: c };
  },

  startCheckout(warranties) {
    const chosen = warrantySet(warranties);
    const rows = cartItems();
    if (!rows.length) {
      throw fail(400, 'Não é possível iniciar o checkout com o carrinho vazio.');
    }
    const items = rows.map((i) => ({
      product_id: i.product_id,
      sku: i.sku,
      nome: i.nome,
      imagem_url: i.imagem_url,
      qty: i.qty,
      unit_price: i.unit_price,
      warranty: chosen.has(i.product_id),
    }));
    return { review: { cart_id: 1, items, ...totalsFor(items) } };
  },

  confirmCheckout({ warranties, customer: guest } = {}) {
    const chosen = warrantySet(warranties);
    const rows = cartItems();
    if (!rows.length) throw fail(400, 'Não é possível finalizar um carrinho vazio.');

    // Sem login, o pedido cria a conta do visitante — como no servidor.
    let account = currentAccount();
    if (!account) {
      if (!guest || !guest.email || !guest.nome) {
        throw fail(400, 'Informe ao menos nome e email para finalizar.');
      }
      account = accountByEmail(guest.email);
      if (!account) {
        account = {
          password: null,
          customer: {
            id: state.nextCustomerId,
            nome: guest.nome,
            email: String(guest.email).trim(),
            telefone: guest.telefone || null,
            documento: onlyDigits(guest.documento) || null,
            tipo: 'PF',
            razao_social: null,
            cnpj: null,
            address_line1: null,
            city: null,
            state: null,
            postal_code: null,
            country: 'Brasil',
            created_at: new Date().toISOString(),
          },
        };
        state.nextCustomerId += 1;
        state.accounts.push(account);
      }
    }

    const created = new Date();
    const items = rows
      .map((i) => ({
        product_id: i.product_id,
        sku: i.sku,
        nome: i.nome,
        imagem_url: i.imagem_url,
        qty: i.qty,
        unit_price: i.unit_price,
        warranty: chosen.has(i.product_id),
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    const totals = totalsFor(items);
    const order = {
      id: state.nextOrderId,
      order_number: orderNumberFor(created),
      customer_id: account.customer.id,
      subtotal: totals.subtotal,
      total: totals.total,
      status: 'confirmed',
      created_at: created.toISOString(),
      items,
    };
    state.nextOrderId += 1;
    state.orders.push(order);
    state.cart = [];
    return { order: { ...order, warrantyTotal: totals.warrantyTotal } };
  },

  getOrders() {
    return { orders: myOrders() };
  },

  getOrder(orderNumber) {
    const order = myOrders().find((o) => o.order_number === orderNumber);
    if (!order) throw fail(404, 'Order not found');
    return { order };
  },

  getWishlist() {
    const { customer } = requireAccount();
    return { items: wishlistItems(customer.id) };
  },

  addWishlist(productId) {
    const { customer } = requireAccount();
    const product = requireProduct(productId);
    const already = state.wishlist.some(
      (w) => w.customer_id === customer.id && w.product_id === product.id,
    );
    if (!already) {
      state.wishlist.push({
        customer_id: customer.id,
        product_id: product.id,
        created_at: new Date().toISOString(),
      });
    }
    return { items: wishlistItems(customer.id) };
  },

  removeWishlist(productId) {
    const { customer } = requireAccount();
    state.wishlist = state.wishlist.filter(
      (w) => !(w.customer_id === customer.id && w.product_id === Number(productId)),
    );
    return { items: wishlistItems(customer.id) };
  },
};

// Um só lugar decide o que toda resposta tem em comum: garante o estado
// carregado, demora um pouco, sai clonada (a tela não escreve no estado por
// acidente) e grava o que mudou. Handler nenhum precisa lembrar disso.
async function respond(handler) {
  if (!state) state = loadState();
  await new Promise((resolve) => setTimeout(resolve, LATENCY));
  try {
    return clone(handler());
  } finally {
    save();
  }
}

// Delegação escrita à mão, e não gerada com Object.fromEntries, porque objeto
// literal não executa nada na importação — é o que deixa este arquivo inteiro
// fora do bundle quando o modo de demonstração está desligado.
export const mockApi = {
  getProducts: (params) => respond(() => handlers.getProducts(params)),
  getFeatured: () => respond(() => handlers.getFeatured()),
  getProduct: (id) => respond(() => handlers.getProduct(id)),
  getCategories: () => respond(() => handlers.getCategories()),

  getCart: () => respond(() => handlers.getCart()),
  addToCart: (productId, qty) => respond(() => handlers.addToCart(productId, qty)),
  updateCartItem: (productId, qty) => respond(() => handlers.updateCartItem(productId, qty)),
  removeCartItem: (productId) => respond(() => handlers.removeCartItem(productId)),

  register: (data) => respond(() => handlers.register(data)),
  login: (data) => respond(() => handlers.login(data)),
  me: () => respond(() => handlers.me()),
  updateProfile: (data) => respond(() => handlers.updateProfile(data)),

  startCheckout: (warranties) => respond(() => handlers.startCheckout(warranties)),
  confirmCheckout: (payload) => respond(() => handlers.confirmCheckout(payload)),

  getOrders: () => respond(() => handlers.getOrders()),
  getOrder: (orderNumber) => respond(() => handlers.getOrder(orderNumber)),

  getWishlist: () => respond(() => handlers.getWishlist()),
  addWishlist: (productId) => respond(() => handlers.addWishlist(productId)),
  removeWishlist: (productId) => respond(() => handlers.removeWishlist(productId)),
};

export default mockApi;
