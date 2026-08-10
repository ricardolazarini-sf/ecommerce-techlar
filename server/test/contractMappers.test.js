import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  toE164BR,
  toISO,
  splitName,
  toPfRow,
  toPjRow,
  toOrderRow,
} from '../src/integration/data360/contractMappers.js';

test('toE164BR normaliza vários formatos para +55DDDNUMERO', () => {
  assert.equal(toE164BR('(11) 98765-4321'), '+5511987654321');
  assert.equal(toE164BR('11987654321'), '+5511987654321');
  assert.equal(toE164BR('+55 (11) 98765-4321'), '+5511987654321');
  assert.equal(toE164BR('1133224455'), '+551133224455'); // fixo 10 dígitos
});

test('toE164BR rejeita telefones fora do padrão BR', () => {
  assert.equal(toE164BR('123'), null);
  assert.equal(toE164BR(''), null);
  assert.equal(toE164BR(null), null);
});

test('toISO devolve ISO 8601 ou null', () => {
  assert.equal(toISO('2026-08-01T12:00:00Z'), '2026-08-01T12:00:00.000Z');
  assert.equal(toISO('data-invalida'), null);
  assert.equal(toISO(null), null);
});

test('splitName separa first/last e trata nome único', () => {
  assert.deepEqual(splitName('Ana Beatriz Souza'), {
    first_name: 'Ana',
    last_name: 'Beatriz Souza',
  });
  assert.deepEqual(splitName('Madonna'), { first_name: 'Madonna', last_name: 'Madonna' });
});

test('toPfRow monta a linha PF conforme o contrato', () => {
  const row = toPfRow({
    id: 42,
    nome: 'Ana Beatriz Souza',
    documento: '390.533.447-05',
    email: 'ana@example.com',
    telefone: '(11) 98765-4321',
    address_line1: 'Rua das Flores 100',
    city: 'São Paulo',
    country: 'Brasil',
    created_at: '2026-08-01T12:00:00Z',
  });
  assert.equal(row.customer_id, 'WEB-PF-42');
  assert.equal(row.first_name, 'Ana');
  assert.equal(row.last_name, 'Beatriz Souza');
  assert.equal(row.cpf, '39053344705'); // só dígitos
  assert.equal(row.id_type, 'CPF');
  assert.equal(row.id_name, 'CPF');
  assert.equal(row.phone, '+5511987654321');
  assert.equal(row.updated_at, '2026-08-01T12:00:00.000Z');
});

test('toPjRow usa razão social e CNPJ só dígitos', () => {
  const row = toPjRow({
    id: 7,
    razao_social: 'Padaria do João LTDA',
    cnpj: '11.222.333/0001-81',
    email: 'vendas@padaria.com.br',
    telefone: '1133224455',
    address_line1: 'Rua do Pão 100',
    city: 'São Paulo',
    country: 'Brasil',
    updated_at: '2026-08-02T10:00:00Z',
  });
  assert.equal(row.customer_id, 'WEB-PJ-7');
  assert.equal(row.account_name, 'Padaria do João LTDA');
  assert.equal(row.cnpj, '11222333000181');
  assert.equal(row.phone, '+551133224455');
});

test('toOrderRow prefixa customer_id pelo tipo do cliente', () => {
  const pf = toOrderRow({
    order_number: 'TL-20260801-000001',
    customer_id: 42,
    customer_tipo: 'PF',
    total: 250.5,
    created_at: '2026-03-15T14:00:00Z',
  });
  assert.equal(pf.sales_order_id, 'TL-20260801-000001');
  assert.equal(pf.customer_id, 'WEB-PF-42');
  assert.equal(pf.total_amount, 250.5);
  assert.equal(pf.order_date, '2026-03-15T14:00:00.000Z');

  const pj = toOrderRow({
    order_number: 'TL-20260801-000009',
    customer_id: 7,
    customer_tipo: 'PJ',
    total: 9000,
    created_at: '2026-03-16T14:00:00Z',
  });
  assert.equal(pj.customer_id, 'WEB-PJ-7');
});
