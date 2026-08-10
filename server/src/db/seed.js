import { getPool, withTransaction, closePool } from './index.js';
import { logger } from '../utils/logger.js';
import { hashPassword } from '../customers/password.js';
import { BASE_PEOPLE, BASE_COMPANIES } from './personas.js';
import { ORG_PRODUCTS, imageFor } from './products.js';

// Idempotent seed: truncates the data tables and repopulates them, so
// `npm run seed` always yields the same base. Section 7 identity variance is
// applied on purpose so Data 360 Identity Resolution has something to unify.

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const WARRANTY_RATE = 0.15;

// --------------------------------------------------------------------------
// Catalog — produtos da org (Price Book). Fonte única em ./products.js.
// --------------------------------------------------------------------------
const PRODUCTS = ORG_PRODUCTS;

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
    { customer: 0, items: [['GSGH2J23213', 1, true], ['CABO-USB', 1, false]] },
    { customer: 1, items: [['MacBookM4Air', 2, false]] },
    { customer: 3, items: [['GSGH2J232111', 1, true], ['CABO-USB', 2, false]] },
    { customer: 5, items: [['GSGH2J232xxsssssss', 1, false]] },
    { customer: 7, items: [['IMP-3D-PREMIUM', 1, false], ['CABO-USB', 3, false]] },
    { customer: 9, items: [['MacBookM4Air', 1, true]] },
    { customer: 12, items: [['IMP-3D-PLUS', 1, false], ['CABO-USB', 2, false]] },
    { customer: 15, items: [['GSGH2J23213', 1, true], ['CABO-USB', 1, false]] },
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
    { company: 0, items: [['MacBookM4Air', 5, false], ['CABO-USB', 5, false]] },
    { company: 1, items: [['GSGH2J232111', 8, false], ['CABO-USB', 8, false]] },
    { company: 3, items: [['IMP-3D-PREMIUM', 3, false], ['CABO-USB', 6, false]] },
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
