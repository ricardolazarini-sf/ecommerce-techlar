import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { EventBus } from '../src/events/EventBus.js';
import { createSink, FileSink, DataCloudIngestionSink } from '../src/events/sinks/index.js';
import {
  buildIdentifyEvent,
  buildProductViewedEvent,
  buildOrderPlacedEvent,
} from '../src/events/eventBuilders.js';

// A fake sink that simply records every event it receives.
class FakeSink {
  constructor() {
    this.name = 'fake';
    this.events = [];
  }
  async send(event) {
    this.events.push(event);
  }
}

class ThrowingSink {
  constructor() {
    this.name = 'throwing';
    this.calls = 0;
  }
  async send() {
    this.calls += 1;
    throw new Error('sink boom');
  }
}

const silentLogger = { info() {}, warn() {}, error() {}, debug() {} };

// -------------------------------------------------------------------------
// EventBus facade
// -------------------------------------------------------------------------
test('EventBus forwards emitted events to the sink', async () => {
  const sink = new FakeSink();
  const bus = new EventBus({ sink, logger: silentLogger });

  await bus.emit(buildIdentifyEvent({ email: 'ana@example.com' }, { reason: 'login' }));

  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0].event_type, 'identify');
  assert.equal(sink.events[0].customer_ref.email, 'ana@example.com');
  assert.equal(sink.events[0].payload.reason, 'login');
  assert.ok(sink.events[0].event_id, 'event has an id');
  assert.ok(sink.events[0].occurred_at, 'event has a timestamp');
});

test('EventBus never throws when the sink fails (site stays up)', async () => {
  const sink = new ThrowingSink();
  const logs = [];
  const logger = { ...silentLogger, error: (msg) => logs.push(msg) };
  const bus = new EventBus({ sink, logger });

  await assert.doesNotReject(
    bus.emit(
      buildProductViewedEvent(
        { device_id: 'dev-1' },
        { id: 1, sku: 'SKU', nome: 'Item', categoria: 'x', preco: 10 },
      ),
    ),
  );
  assert.equal(sink.calls, 1);
  assert.ok(logs.includes('events.sink_failed'));
});

test('EventBus persists locally and still forwards to the sink', async () => {
  const sink = new FakeSink();
  const calls = [];
  const dbQuery = async (text, params) => {
    calls.push({ text, params });
    return { rows: [] };
  };
  const bus = new EventBus({ sink, persistLocal: true, dbQuery, logger: silentLogger });

  const event = buildOrderPlacedEvent(
    { email: 'ana@example.com', device_id: 'dev-1' },
    { order_number: 'TL-20260807-AAAAAA', items: [], subtotal: 0, total: 0, status: 'confirmed' },
  );
  await bus.emit(event, { customerId: 42 });

  assert.equal(calls.length, 1);
  assert.match(calls[0].text, /INSERT INTO events/);
  assert.equal(calls[0].params[0], 'order_placed'); // type
  assert.equal(calls[0].params[1], 42); // customer_id from meta
  assert.equal(calls[0].params[2], 'dev-1'); // device_id from customer_ref
  assert.equal(sink.events.length, 1);
});

test('EventBus swallows local-persistence errors', async () => {
  const sink = new FakeSink();
  const logs = [];
  const logger = { ...silentLogger, warn: (msg) => logs.push(msg) };
  const dbQuery = async () => {
    throw new Error('db unavailable');
  };
  const bus = new EventBus({ sink, persistLocal: true, dbQuery, logger });

  await assert.doesNotReject(bus.emit(buildIdentifyEvent({ email: 'x' }, { reason: 'register' })));
  assert.equal(sink.events.length, 1, 'still forwarded despite DB failure');
  assert.ok(logs.includes('events.local_persist_failed'));
});

// -------------------------------------------------------------------------
// Sink factory
// -------------------------------------------------------------------------
test('createSink builds the sink selected by config', () => {
  assert.equal(createSink({ sink: 'console' }, silentLogger).name, 'console');
  assert.equal(createSink({ sink: 'file', filePath: './x.log' }, silentLogger).name, 'file');
  assert.equal(
    createSink({ sink: 'datacloud', dataCloud: { url: 'https://dc' } }, silentLogger).name,
    'datacloud',
  );
  assert.equal(createSink({}, silentLogger).name, 'console', 'defaults to console');
});

// -------------------------------------------------------------------------
// FileSink
// -------------------------------------------------------------------------
test('FileSink appends one JSON line per event', async () => {
  const file = path.join(os.tmpdir(), `techlar-events-${randomUUID()}.log`);
  const sink = new FileSink({ filePath: file });
  try {
    await sink.send(buildIdentifyEvent({ email: 'a@x.com' }, { reason: 'login' }));
    await sink.send(buildIdentifyEvent({ email: 'b@x.com' }, { reason: 'register' }));

    const lines = (await fs.promises.readFile(file, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 2);
    const first = JSON.parse(lines[0]);
    assert.equal(first.event_type, 'identify');
    assert.equal(first.customer_ref.email, 'a@x.com');
  } finally {
    await fs.promises.unlink(file).catch(() => {});
  }
});

// -------------------------------------------------------------------------
// DataCloudIngestionSink (HTTP-only, with fake fetch)
// -------------------------------------------------------------------------
test('DataCloudIngestionSink POSTs the envelope to the ingestion endpoint', async () => {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, opts });
    return { ok: true, status: 200 };
  };
  const sink = new DataCloudIngestionSink({
    url: 'https://dc.example.com/',
    connector: 'techlar_web',
    object: 'ecommerce_events',
    token: 'secret-token',
    fetchImpl,
    sleepImpl: async () => {},
  });

  await sink.send(
    buildOrderPlacedEvent(
      { email: 'a@x.com' },
      { order_number: 'TL-1', items: [], subtotal: 10, total: 10, status: 'confirmed' },
    ),
  );

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    'https://dc.example.com/api/v1/ingest/sources/techlar_web/ecommerce_events',
  );
  assert.equal(calls[0].opts.method, 'POST');
  assert.equal(calls[0].opts.headers.Authorization, 'Bearer secret-token');
  const parsed = JSON.parse(calls[0].opts.body);
  assert.ok(Array.isArray(parsed.data));
  assert.equal(parsed.data[0].event_type, 'order_placed');
});

test('DataCloudIngestionSink retries on 5xx then succeeds', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    return attempts < 3 ? { ok: false, status: 503 } : { ok: true, status: 200 };
  };
  const sink = new DataCloudIngestionSink({
    url: 'https://dc',
    connector: 'c',
    fetchImpl,
    sleepImpl: async () => {},
    maxRetries: 3,
    retryBaseMs: 1,
  });

  await assert.doesNotReject(sink.send(buildIdentifyEvent({ email: 'a' }, { reason: 'login' })));
  assert.equal(attempts, 3);
});

test('DataCloudIngestionSink fails fast on 4xx (no retries)', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    return { ok: false, status: 400 };
  };
  const sink = new DataCloudIngestionSink({
    url: 'https://dc',
    connector: 'c',
    fetchImpl,
    sleepImpl: async () => {},
    maxRetries: 3,
    logger: silentLogger,
  });

  await assert.rejects(
    sink.send(buildIdentifyEvent({ email: 'a' }, { reason: 'login' })),
    /HTTP 400/,
  );
  assert.equal(attempts, 1, 'no retry on client error');
});

test('DataCloudIngestionSink throws after exhausting retries on network errors', async () => {
  let attempts = 0;
  const logs = [];
  const logger = { ...silentLogger, error: (msg) => logs.push(msg) };
  const fetchImpl = async () => {
    attempts += 1;
    throw new Error('network down');
  };
  const sink = new DataCloudIngestionSink({
    url: 'https://dc',
    connector: 'c',
    fetchImpl,
    sleepImpl: async () => {},
    maxRetries: 2,
    logger,
  });

  await assert.rejects(sink.send(buildIdentifyEvent({ email: 'a' }, { reason: 'login' })));
  assert.equal(attempts, 3); // initial try + 2 retries
  assert.ok(logs.includes('datacloud.ingestion.failed'));
});

test('EventBus + failing DataCloud sink still does not break emit', async () => {
  const fetchImpl = async () => {
    throw new Error('down');
  };
  const sink = new DataCloudIngestionSink({
    url: 'https://dc',
    connector: 'c',
    fetchImpl,
    sleepImpl: async () => {},
    maxRetries: 1,
    logger: silentLogger,
  });
  const bus = new EventBus({ sink, logger: silentLogger });

  await assert.doesNotReject(
    bus.emit(
      buildOrderPlacedEvent(
        { email: 'a' },
        { order_number: 'TL-1', items: [], subtotal: 0, total: 0, status: 'confirmed' },
      ),
    ),
  );
});
