import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { query } from '../db/index.js';
import { createSink } from './sinks/index.js';
import { EventBus } from './EventBus.js';
import {
  buildIdentifyEvent,
  buildProductViewedEvent,
  buildCartUpdatedEvent,
  buildCheckoutStartedEvent,
  buildOrderPlacedEvent,
} from './eventBuilders.js';

// Lazily-created singleton bus. The sink is selected from EVENTS_SINK at first
// use, so nothing external is contacted merely by importing this module.
let bus = null;

export function getEventBus() {
  if (bus) return bus;
  const sink = createSink(config.events, logger);
  bus = new EventBus({
    sink,
    persistLocal: config.events.persistLocal,
    dbQuery: query,
    logger,
  });
  logger.info('events.bus_initialized', {
    sink: sink.name,
    persistLocal: config.events.persistLocal,
  });
  return bus;
}

// Allows tests / advanced callers to inject a custom bus (e.g. a fake sink).
export function setEventBus(customBus) {
  bus = customBus;
}

// High-level, destination-agnostic API used across the domain. Callers build a
// business event and emit it; they never reference a sink.
export const events = {
  emit: (event, meta) => getEventBus().emit(event, meta),
  identify: (ref, data, meta) => getEventBus().emit(buildIdentifyEvent(ref, data), meta),
  productViewed: (ref, product, meta) =>
    getEventBus().emit(buildProductViewedEvent(ref, product), meta),
  cartUpdated: (ref, data, meta) => getEventBus().emit(buildCartUpdatedEvent(ref, data), meta),
  checkoutStarted: (ref, data, meta) =>
    getEventBus().emit(buildCheckoutStartedEvent(ref, data), meta),
  orderPlaced: (ref, data, meta) => getEventBus().emit(buildOrderPlacedEvent(ref, data), meta),
};

export { EventBus } from './EventBus.js';
export * from './eventBuilders.js';
export { createSink } from './sinks/index.js';

export default events;
