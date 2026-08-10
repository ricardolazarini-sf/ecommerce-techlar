// Gera os CSVs SIMULADOS do app mobile (contrato §4.2), em ./exports/app:
//   - app_clientes_pf.csv   (APP-PF-*)
//   - app_clientes_pj.csv   (APP-PJ-*)
//   - app_pedidos.csv       (APP-ORD-*)
//
// Ponto central: as personas vêm de src/db/personas.js — as MESMAS do e-commerce
// — de propósito, para o Data 360 reconciliar a mesma pessoa/empresa entre silos.
// A variância aqui é de VALORES (nome abreviado, email de outro domínio, CPF
// ausente em alguns registros), não de FORMATO (que segue o contrato: E.164, ISO,
// tudo Text). Isso é o que faz o Identity Resolution "trabalhar".
//
// Uso:  npm run gen:app-csv   (raiz)   ou   node scripts/generate-app-csv.mjs (server)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_PEOPLE, BASE_COMPANIES } from '../src/db/personas.js';
import { toCSV } from '../src/integration/data360/csv.js';
import { toE164BR } from '../src/integration/data360/contractMappers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'exports', 'app');

const PF_COLS = [
  'customer_id', 'first_name', 'last_name', 'cpf', 'id_type', 'id_name',
  'email', 'phone', 'address_line1', 'city', 'country', 'updated_at',
];
const PJ_COLS = [
  'customer_id', 'account_name', 'cnpj', 'email', 'phone',
  'address_line1', 'city', 'country', 'updated_at',
];
const ORDER_COLS = ['sales_order_id', 'customer_id', 'total_amount', 'order_date'];

const APP_TS = '2026-07-15T10:00:00.000Z';

// Troca o domínio do email (variância proposital entre app e site).
const appEmail = (email) => email.replace(/@.*/, '@appmail.com');

function buildAppPf() {
  // Amostra enxuta: 5 pessoas; algumas SEM CPF (força match por email).
  return BASE_PEOPLE.slice(0, 5).map((p, i) => {
    const parts = p.nome.split(/\s+/);
    const hasCpf = i % 4 !== 0; // 1 em cada 4 vem sem CPF (força match por email)
    return {
      customer_id: `APP-PF-${9001 + i}`,
      first_name: parts[0],
      last_name: parts[parts.length - 1], // abrevia (perde nome do meio) = variância
      cpf: hasCpf ? p.cpf : '',
      id_type: hasCpf ? 'CPF' : '',
      id_name: hasCpf ? 'CPF' : '',
      // Com CPF: pode divergir o email (o CPF garante o match).
      // Sem CPF: mantém o email ORIGINAL para casar pela regra de email.
      email: hasCpf ? appEmail(p.email) : p.email,
      phone: toE164BR(p.phone),
      address_line1: '',
      city: '',
      country: 'Brasil',
      updated_at: APP_TS,
    };
  });
}

function buildAppPj() {
  // Amostra enxuta: 2 empresas.
  return BASE_COMPANIES.slice(0, 2).map((co, i) => ({
    customer_id: `APP-PJ-${8001 + i}`,
    account_name: co.account_name,
    cnpj: co.cnpj,
    email: appEmail(co.email),
    phone: toE164BR(co.phone),
    address_line1: '',
    city: '',
    country: 'Brasil',
    updated_at: APP_TS,
  }));
}

function buildAppOrders(pfRows, pjRows) {
  const orders = [];
  let n = 7001;
  // Poucos pedidos PF
  pfRows.slice(0, 3).forEach((c, i) => {
    orders.push({
      sales_order_id: `APP-ORD-${n++}`,
      customer_id: c.customer_id,
      total_amount: (180 + i * 45).toFixed(2),
      order_date: `2026-07-${String(18 + i).padStart(2, '0')}T09:15:00.000Z`,
    });
  });
  // Um pedido PJ (ticket maior)
  pjRows.slice(0, 1).forEach((c, i) => {
    orders.push({
      sales_order_id: `APP-ORD-${n++}`,
      customer_id: c.customer_id,
      total_amount: (3200 + i * 800).toFixed(2),
      order_date: `2026-07-${String(22 + i).padStart(2, '0')}T11:00:00.000Z`,
    });
  });
  return orders;
}

function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pf = buildAppPf();
  const pj = buildAppPj();
  const orders = buildAppOrders(pf, pj);

  const files = [
    ['app_clientes_pf.csv', toCSV(pf, PF_COLS), pf.length],
    ['app_clientes_pj.csv', toCSV(pj, PJ_COLS), pj.length],
    ['app_pedidos.csv', toCSV(orders, ORDER_COLS), orders.length],
  ];
  for (const [name, content, count] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), content, 'utf8');
    console.log(`✓ ${name} — ${count} linha(s)`);
  }
  console.log(`\nArquivos gravados em: ${OUT_DIR}`);
}

run();
