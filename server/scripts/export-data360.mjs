// Exporta o banco do e-commerce para CSVs conformes ao Contrato de Dados
// (Sprint IV). Gera três arquivos em ./exports:
//   - ecommerce_customers_pf.csv   (contrato §4.1.a)
//   - ecommerce_customers_pj.csv   (contrato §4.1.b)
//   - ecommerce_orders.csv         (contrato §4.1.c)
//
// Uso (precisa de DATABASE_URL apontando para o Postgres do site):
//   npm run export:data360            (na raiz)  ou
//   node scripts/export-data360.mjs   (dentro de /server)
//
// Os CSVs servem para o BULK ingest (histórico). Para streaming contínuo, os
// mesmos mapeadores (contractMappers.js) produzem o JSON do POST.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query, closePool, getPool } from '../src/db/index.js';
import { toCSV } from '../src/integration/data360/csv.js';
import {
  toPfRow,
  toPjRow,
  toOrderRow,
  partitionByEmail,
} from '../src/integration/data360/contractMappers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '..', '..', 'exports');

const PF_COLS = [
  'customer_id', 'first_name', 'last_name', 'cpf', 'id_type', 'id_name',
  'email', 'phone', 'address_line1', 'city', 'country', 'updated_at',
];
const PJ_COLS = [
  'customer_id', 'account_name', 'cnpj', 'email', 'phone',
  'address_line1', 'city', 'country', 'updated_at',
];
const ORDER_COLS = ['sales_order_id', 'customer_id', 'total_amount', 'order_date'];

function onlyWithEmail(name, mapped) {
  const { rows, missing } = partitionByEmail(mapped);
  if (missing) console.warn(`! ${name}: ${missing} linha(s) sem e-mail — fora do arquivo`);
  return rows;
}

async function run() {
  getPool(); // valida DATABASE_URL cedo
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { rows: pf } = await query(`SELECT * FROM customers WHERE tipo = 'PF' ORDER BY id`);
  const { rows: pj } = await query(`SELECT * FROM customers WHERE tipo = 'PJ' ORDER BY id`);
  const { rows: orders } = await query(
    `SELECT o.order_number, o.customer_id, o.total, o.created_at, c.tipo AS customer_tipo
       FROM orders o
       LEFT JOIN customers c ON c.id = o.customer_id
      ORDER BY o.id`,
  );

  // `email` é obrigatório nos schemas PF/PJ: linha sem e-mail é avisada e fica
  // fora do CSV em vez de subir com a coluna em branco.
  const pfRows = onlyWithEmail('ecommerce_customers_pf.csv', pf.map(toPfRow));
  const pjRows = onlyWithEmail('ecommerce_customers_pj.csv', pj.map(toPjRow));
  const orderRows = orders.map(toOrderRow);

  const files = [
    ['ecommerce_customers_pf.csv', toCSV(pfRows, PF_COLS), pfRows.length],
    ['ecommerce_customers_pj.csv', toCSV(pjRows, PJ_COLS), pjRows.length],
    ['ecommerce_orders.csv', toCSV(orderRows, ORDER_COLS), orderRows.length],
  ];

  for (const [name, content, count] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), content, 'utf8');
    console.log(`✓ ${name} — ${count} linha(s)`);
  }
  console.log(`\nArquivos gravados em: ${OUT_DIR}`);
}

run()
  .then(() => closePool())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Falha no export:', err.message);
    process.exit(1);
  });
