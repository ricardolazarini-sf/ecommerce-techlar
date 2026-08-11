import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as loadYaml } from 'js-yaml';

import { CONTRACT_KEYS, TEXT_PROPS, NUMBER_PROPS } from '../src/collect/contract.js';

// O contrato do engajamento existe em dois lugares que NÃO podem divergir: o
// YAML que é carregado no Data Stream da org e o achatador que monta o registro.
// Divergência aqui não falha em teste nenhum, falha em produção — como 400
// `required key [x] not found`, horas depois, na fila. Então falha aqui.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '../../docs/data360/ecommerce_events.yaml');

const schema = loadYaml(fs.readFileSync(SCHEMA_PATH, 'utf8'));
const events = schema.components.schemas.ecommerce_events;

test('o YAML do Data Stream e o achatador têm exatamente as mesmas chaves', () => {
  assert.deepEqual(Object.keys(events.properties).sort(), [...CONTRACT_KEYS].sort());
});

test('cada chave tem no YAML o tipo que o achatador produz', () => {
  for (const key of TEXT_PROPS) {
    assert.equal(events.properties[key]?.type, 'string', `${key} deveria ser string`);
  }
  for (const key of NUMBER_PROPS) {
    assert.equal(events.properties[key]?.type, 'number', `${key} deveria ser number`);
  }
});

test('occurred_at é datetime, que é o que a categoria Engagement exige', () => {
  assert.equal(events.properties.occurred_at.type, 'string');
  assert.equal(events.properties.occurred_at.format, 'date-time');
});

test('event_id é obrigatório: é a chave de deduplicação do lado da org', () => {
  assert.ok(events.required.includes('event_id'));
  assert.ok(events.required.includes('event_type'));
  assert.ok(events.required.includes('occurred_at'));
});

// A Ingestion API recusa o arquivo com `integer`, com objeto aninhado e com
// array — daí items_json ser string.
test('o schema não usa tipo que a Ingestion API recusa', () => {
  for (const [key, def] of Object.entries(events.properties)) {
    assert.ok(['string', 'number', 'boolean'].includes(def.type), `${key}: tipo ${def.type}`);
  }
});
