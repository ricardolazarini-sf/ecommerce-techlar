import { getPool, withTransaction, closePool } from './index.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../customers/password.js';
import { BASE_PEOPLE, BASE_COMPANIES } from './personas.js';

// Idempotent seed: truncates the data tables and repopulates them, so
// `npm run seed` always yields the same base. Section 7 identity variance is
// applied on purpose so Data 360 Identity Resolution has something to unify.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const WARRANTY_RATE = 0.15;

// --------------------------------------------------------------------------
// Catalog — ~16 home-technology products.
// --------------------------------------------------------------------------
const PRODUCTS = [
  { sku: 'NB-PRO-14', nome: 'Notebook TechLar Pro 14"', categoria: 'notebooks', preco: 7499.0, descricao: 'Notebook premium com tela 14" 2.8K, 32GB RAM e SSD 1TB. Ideal para trabalho e criação.' },
  { sku: 'NB-AIR-13', nome: 'Notebook TechLar Air 13"', categoria: 'notebooks', preco: 4999.0, descricao: 'Ultrafino e leve, 16GB RAM, SSD 512GB e bateria de até 18h.' },
  { sku: 'NB-GAMER-16', nome: 'Notebook TechLar Gamer 16"', categoria: 'notebooks', preco: 9899.0, descricao: 'Placa dedicada, tela 165Hz e refrigeração dupla para jogos pesados.' },
  { sku: 'MO-WL-01', nome: 'Mouse Sem Fio TechLar Silent', categoria: 'perifericos', preco: 149.9, descricao: 'Mouse silencioso, 2.4GHz + Bluetooth, 4000 DPI ajustável.' },
  { sku: 'KB-MEC-02', nome: 'Teclado Mecânico TechLar RGB', categoria: 'perifericos', preco: 429.9, descricao: 'Switches hot-swap, ABNT2, iluminação RGB por tecla.' },
  { sku: 'HS-GAMER-01', nome: 'Headset Gamer TechLar 7.1', categoria: 'perifericos', preco: 349.9, descricao: 'Som surround 7.1 virtual, microfone com cancelamento de ruído.' },
  { sku: 'WC-FHD-01', nome: 'Webcam TechLar Full HD', categoria: 'perifericos', preco: 279.9, descricao: 'Webcam 1080p 60fps com foco automático e microfone estéreo.' },
  { sku: 'HUB-USBC-7', nome: 'Hub USB-C TechLar 7 em 1', categoria: 'perifericos', preco: 319.9, descricao: 'HDMI 4K, 2x USB-A, leitor SD, USB-C PD 100W e Ethernet.' },
  { sku: 'MN-27-4K', nome: 'Monitor TechLar 27" 4K', categoria: 'monitores', preco: 2599.0, descricao: 'IPS 27" 4K UHD, 99% sRGB, USB-C com 90W de carga.' },
  { sku: 'MN-24-FHD', nome: 'Monitor TechLar 24" Full HD', categoria: 'monitores', preco: 999.0, descricao: 'IPS 24" 100Hz, bordas finas, ideal para home office.' },
  { sku: 'SPK-SMART-01', nome: 'Smart Speaker TechLar Casa', categoria: 'casa-inteligente', preco: 499.0, descricao: 'Assistente por voz, som 360°, controle de dispositivos da casa.' },
  { sku: 'LMP-SMART-01', nome: 'Lâmpada Inteligente TechLar', categoria: 'casa-inteligente', preco: 89.9, descricao: 'Wi-Fi, 16 milhões de cores, controle por app e por voz.' },
  { sku: 'CAM-WIFI-01', nome: 'Câmera de Segurança Wi-Fi TechLar', categoria: 'casa-inteligente', preco: 329.9, descricao: 'Full HD, visão noturna, detecção de movimento e áudio bidirecional.' },
  { sku: 'RT-WIFI6-01', nome: 'Roteador TechLar Wi-Fi 6', categoria: 'redes', preco: 749.0, descricao: 'Wi-Fi 6 AX3000, cobertura ampla e priorização de tráfego.' },
  { sku: 'SSD-1TB-NVME', nome: 'SSD TechLar 1TB NVMe', categoria: 'armazenamento', preco: 649.0, descricao: 'Leitura até 7000MB/s, ideal para upgrade de notebooks e PCs.' },
  { sku: 'SVC-WARRANTY-12', nome: 'Garantia Estendida 12 meses', categoria: 'servicos', preco: 199.0, descricao: 'Proteção adicional de 12 meses contra defeitos de fabricação.' },
  { sku: 'SVC-INSTALL-SMART', nome: 'Instalação Smart Home', categoria: 'servicos', preco: 249.0, descricao: 'Instalação e configuração profissional dos seus dispositivos inteligentes.' },
];

// Deterministic image URLs (stable per SKU) — only loaded by the browser at
// runtime, never during build.
const imageFor = (sku) => `https://picsum.photos/seed/techlar-${sku}/800/600`;

// --------------------------------------------------------------------------
// Identity-variance helpers (section 7). Same real person, small divergences.
// --------------------------------------------------------------------------
const stripAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cpfMasked = (d) => `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
const phoneMasked = (d) => `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
const phoneIntl = (d) => `+55 (${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
const phoneIntlPlain = (d) => `+55${d}`;

// Pool de endereços (distribuído por pessoa). Só o e-commerce coleta endereço;
// a variância de identidade fica nos OUTROS campos (nome/email/telefone/CPF).
const ADDRESSES = [
  { address_line1: 'Rua das Flores 100', city: 'São Paulo', state: 'SP', postal_code: '01001000' },
  { address_line1: 'Av. Paulista 1500', city: 'São Paulo', state: 'SP', postal_code: '01310200' },
  { address_line1: 'Rua da Praia 250', city: 'Porto Alegre', state: 'RS', postal_code: '90010000' },
  { address_line1: 'Av. Atlântica 800', city: 'Rio de Janeiro', state: 'RJ', postal_code: '22010000' },
  { address_line1: 'Rua XV de Novembro 45', city: 'Curitiba', state: 'PR', postal_code: '80020000' },
];

// Base people vêm de ./personas.js (fonte única, compartilhada com o gerador de
// CSV do app). `variants` descreve quantos registros divergentes emitir para a
// mesma pessoa real e qual transformação aplicar a cada um.

// Produce one customer record for variant `v` of a base person. Each variant
// mixes email casing, phone formatting, CPF masking and name spelling.
function buildVariant(person, v, personIndex) {
  const emailStyles = [
    person.email,
    person.email.toUpperCase(),
    person.email.replace(/^(.)/, (c) => c.toUpperCase()),
  ];
  const phoneStyles = [phoneIntl(person.phone), person.phone, phoneMasked(person.phone), phoneIntlPlain(person.phone)];
  const cpfStyles = [cpfMasked(person.cpf), person.cpf];
  const nameStyles = [
    person.nome,
    stripAccents(person.nome),
    person.nome.split(' ')[0] + ' ' + person.nome.split(' ').slice(-1),
  ];

  const addr = ADDRESSES[personIndex % ADDRESSES.length];
  return {
    nome: nameStyles[v % nameStyles.length],
    email: emailStyles[v % emailStyles.length],
    telefone: phoneStyles[v % phoneStyles.length],
    documento: cpfStyles[v % cpfStyles.length],
    // Variants of the same person occasionally share a device (a resolution
    // signal); otherwise each record carries its own device_id.
    device_id: v === 0 ? `web-${personIndex}-a` : v === 1 ? `web-${personIndex}-a` : `web-${personIndex}-${v}`,
    ...addr,
    country: 'Brasil',
  };
}

function buildCustomers() {
  const customers = [];
  BASE_PEOPLE.forEach((person, personIndex) => {
    for (let v = 0; v < person.variants; v += 1) {
      customers.push(buildVariant(person, v, personIndex));
    }
  });
  return customers;
}

async function truncateAll(client) {
  await client.query(`
    TRUNCATE TABLE
      events, order_items, orders, cart_items, carts, wishlist_items, customers, products
    RESTART IDENTITY CASCADE;
  `);
}

async function insertProducts(client) {
  const ids = {};
  for (const p of PRODUCTS) {
    const { rows } = await client.query(
      `INSERT INTO products (sku, nome, categoria, preco, descricao, imagem_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      // Use imagem_url quando informado; senão, gera uma imagem determinística.
      [p.sku, p.nome, p.categoria, p.preco, p.descricao, p.imagem_url || imageFor(p.sku)],
    );
    ids[p.sku] = { id: rows[0].id, preco: p.preco };
  }
  return ids;
}

async function insertCustomers(client) {
  const rows = buildCustomers();
  const ids = [];
  // A single well-known demo login (documented in the README output).
  const demoHash = hashPassword('techlar123');
  const { rows: demoRows } = await client.query(
    `INSERT INTO customers
       (nome, email, telefone, documento, device_id, password_hash,
        tipo, address_line1, city, state, postal_code, country)
     VALUES ($1,$2,$3,$4,$5,$6,'PF','Av. Paulista 1500','São Paulo','SP','01310200','Brasil')
     RETURNING id`,
    ['Cliente Demo TechLar', 'demo@techlar.com', '+55 (11) 90000-0000', '11144477735', 'web-demo', demoHash],
  );
  ids.push(demoRows[0].id);

  for (const c of rows) {
    const { rows: r } = await client.query(
      `INSERT INTO customers
         (nome, email, telefone, documento, device_id,
          tipo, address_line1, city, state, postal_code, country)
       VALUES ($1,$2,$3,$4,$5,'PF',$6,$7,$8,$9,$10) RETURNING id`,
      [c.nome, c.email, c.telefone, c.documento, c.device_id,
        c.address_line1, c.city, c.state, c.postal_code, c.country],
    );
    ids.push(r[0].id);
  }
  return ids;
}

// Empresas B2B (PJ) — CNPJ válido, para exercitar o ruleset Account do Data 360.
async function insertCompanies(client) {
  const ids = [];
  for (const co of BASE_COMPANIES) {
    const { rows: r } = await client.query(
      `INSERT INTO customers
         (nome, razao_social, cnpj, email, telefone,
          tipo, address_line1, city, state, postal_code, country)
       VALUES ($1,$1,$2,$3,$4,'PJ',$5,$6,$7,$8,'Brasil') RETURNING id`,
      [co.account_name, co.cnpj, co.email, co.phone,
        co.address_line1, co.city, co.state, co.postal_code],
    );
    ids.push(r[0].id);
  }
  return ids;
}

async function insertHistoricalOrders(client, productIdx, customerIds) {
  // Deterministic set of historical orders + their events, so identity and
  // order signals exist for Data 360 derivations (e.g. abandonment analysis).
  const plans = [
    { customer: 0, items: [['NB-PRO-14', 1, true], ['MO-WL-01', 1, false]] },
    { customer: 1, items: [['MN-27-4K', 2, false]] },
    { customer: 3, items: [['KB-MEC-02', 1, true], ['MO-WL-01', 1, false], ['HS-GAMER-01', 1, false]] },
    { customer: 5, items: [['NB-AIR-13', 1, false]] },
    { customer: 7, items: [['SPK-SMART-01', 1, false], ['LMP-SMART-01', 3, false]] },
    { customer: 9, items: [['SSD-1TB-NVME', 1, true]] },
    { customer: 12, items: [['RT-WIFI6-01', 1, false], ['CAM-WIFI-01', 2, false]] },
    { customer: 15, items: [['NB-GAMER-16', 1, true], ['HS-GAMER-01', 1, false]] },
  ];

  let seq = 1;
  for (const plan of plans) {
    const customerId = customerIds[plan.customer % customerIds.length];
    let subtotal = 0;
    let warrantyTotal = 0;
    const items = plan.items.map(([sku, qty, warranty]) => {
      const { id, preco } = productIdx[sku];
      subtotal = round2(subtotal + preco * qty);
      if (warranty) warrantyTotal = round2(warrantyTotal + preco * WARRANTY_RATE * qty);
      return { product_id: id, qty, unit_price: preco, warranty };
    });
    const total = round2(subtotal + warrantyTotal);
    const orderNumber = `TL-20260801-${String(seq).padStart(6, '0')}`;
    const createdAt = new Date(Date.UTC(2026, 6, 20 + (seq % 8), 12, 0, 0)).toISOString();

    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, customer_id, subtotal, total, status, created_at)
       VALUES ($1, $2, $3, $4, 'confirmed', $5) RETURNING id`,
      [orderNumber, customerId, subtotal, total, createdAt],
    );
    const orderId = orderRows[0].id;
    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, qty, unit_price, warranty)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, it.product_id, it.qty, it.unit_price, it.warranty],
      );
    }

    // Mirror the corresponding order_placed event into the local log.
    await client.query(
      `INSERT INTO events (type, customer_id, device_id, payload, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        'order_placed',
        customerId,
        null,
        JSON.stringify({
          event_type: 'order_placed',
          event_id: `seed-${orderNumber}`,
          occurred_at: createdAt,
          customer_ref: { email: null, phone: null, document: null, device_id: null },
          payload: { order_number: orderNumber, items, subtotal, total, status: 'confirmed' },
        }),
        createdAt,
      ],
    );
    seq += 1;
  }
  return seq - 1;
}

// Pedidos B2B (PJ) — tickets maiores, para o CLV por Account fazer sentido.
async function insertCompanyOrders(client, productIdx, companyIds, startSeq) {
  const plans = [
    { company: 0, items: [['NB-AIR-13', 5, false], ['MO-WL-01', 5, false]] },
    { company: 1, items: [['MN-27-4K', 8, false], ['HUB-USBC-7', 8, false]] },
    { company: 3, items: [['RT-WIFI6-01', 3, false], ['CAM-WIFI-01', 6, false]] },
  ];
  let seq = startSeq;
  for (const plan of plans) {
    const customerId = companyIds[plan.company % companyIds.length];
    let subtotal = 0;
    const items = plan.items.map(([sku, qty]) => {
      const { id, preco } = productIdx[sku];
      subtotal = round2(subtotal + preco * qty);
      return { product_id: id, qty, unit_price: preco, warranty: false };
    });
    const orderNumber = `TL-20260801-${String(seq).padStart(6, '0')}`;
    const createdAt = new Date(Date.UTC(2026, 6, 22 + (seq % 6), 15, 0, 0)).toISOString();
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders (order_number, customer_id, subtotal, total, status, created_at)
       VALUES ($1, $2, $3, $3, 'confirmed', $4) RETURNING id`,
      [orderNumber, customerId, subtotal, createdAt],
    );
    const orderId = orderRows[0].id;
    for (const it of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, qty, unit_price, warranty)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, it.product_id, it.qty, it.unit_price, it.warranty],
      );
    }
    seq += 1;
  }
  return seq - startSeq;
}

export async function seed() {
  return withTransaction(async (client) => {
    await truncateAll(client);
    const productIdx = await insertProducts(client);
    const customerIds = await insertCustomers(client);
    const companyIds = await insertCompanies(client);
    const orderCount = await insertHistoricalOrders(client, productIdx, customerIds);
    const companyOrders = await insertCompanyOrders(
      client,
      productIdx,
      companyIds,
      orderCount + 1,
    );
    return {
      products: Object.keys(productIdx).length,
      customers: customerIds.length + companyIds.length,
      orders: orderCount + companyOrders,
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Ensure the pool exists (throws a clear error if DATABASE_URL is missing).
  getPool();
  seed()
    .then((summary) => {
      logger.info('seed.done', summary);
      return closePool();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error('seed.error', { err: err.message });
      process.exit(1);
    });
}
