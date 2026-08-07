// The decoupled emission facade. Callers only ever do `events.emit(event)` and
// never learn where the event goes. Two responsibilities, both best-effort:
//   1. Optionally mirror the event into the local `events` table (audit log).
//   2. Forward the event to the configured sink.
// A failure in either path is logged but NEVER propagated to the caller, so the
// storefront keeps working even if the database or the ingestion endpoint is down.

export class EventBus {
  constructor({ sink, persistLocal = false, dbQuery = null, logger = null } = {}) {
    this.sink = sink;
    this.persistLocal = persistLocal;
    this.dbQuery = dbQuery;
    this.logger = logger;
  }

  async emit(event, meta = {}) {
    await this.#persistLocal(event, meta);
    await this.#forward(event);
  }

  async #persistLocal(event, meta) {
    if (!this.persistLocal || typeof this.dbQuery !== 'function') return;
    try {
      await this.dbQuery(
        `INSERT INTO events (type, customer_id, device_id, payload)
         VALUES ($1, $2, $3, $4)`,
        [
          event.event_type,
          meta.customerId ?? null,
          event.customer_ref?.device_id ?? null,
          event,
        ],
      );
    } catch (err) {
      this.logger?.warn?.('events.local_persist_failed', {
        event_type: event.event_type,
        err: err.message,
      });
    }
  }

  async #forward(event) {
    if (!this.sink || typeof this.sink.send !== 'function') return;
    try {
      await this.sink.send(event);
    } catch (err) {
      this.logger?.error?.('events.sink_failed', {
        sink: this.sink?.name,
        event_type: event.event_type,
        err: err.message,
      });
    }
  }
}

export default EventBus;
