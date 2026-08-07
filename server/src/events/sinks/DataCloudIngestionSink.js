// Posts events to the Salesforce Data Cloud (Data 360) Ingestion API.
//
// This is a *plain HTTP* destination — it does NOT authenticate a Salesforce
// org, run SOQL, or deploy metadata. It only issues an HTTPS POST to a
// configured Ingestion endpoint with a bearer token. It is inert unless
// EVENTS_SINK=datacloud and the URL is configured.
//
// Reliability: retries with exponential backoff on network / 5xx / 429 errors.
// On final failure it throws, but the EventBus facade swallows that so a failed
// ingestion NEVER breaks the storefront operation.

export class DataCloudIngestionSink {
  constructor({
    url = '',
    connector = '',
    token = '',
    object = 'ecommerce_events',
    maxRetries = 3,
    retryBaseMs = 300,
    logger,
    fetchImpl,
    sleepImpl,
  } = {}) {
    this.name = 'datacloud';
    this.url = url;
    this.connector = connector;
    this.token = token;
    this.object = object;
    this.maxRetries = maxRetries;
    this.retryBaseMs = retryBaseMs;
    this.logger = logger;
    this.fetch = fetchImpl || globalThis.fetch;
    this.sleep = sleepImpl || ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  buildEndpoint() {
    if (!this.url) {
      throw new Error('DATACLOUD_INGESTION_URL is not configured');
    }
    const base = this.url.replace(/\/+$/, '');
    // Data Cloud streaming ingestion shape: /api/v1/ingest/sources/{connector}/{object}
    if (this.connector) {
      return `${base}/api/v1/ingest/sources/${this.connector}/${this.object}`;
    }
    return base;
  }

  async send(event) {
    if (typeof this.fetch !== 'function') {
      throw new Error('No fetch implementation available for DataCloudIngestionSink');
    }
    const endpoint = this.buildEndpoint();
    // Data Cloud Ingestion expects a { data: [...] } envelope.
    const body = JSON.stringify({ data: [event] });
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };

    let lastError = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const res = await this.fetch(endpoint, { method: 'POST', headers, body });
        if (res.ok) {
          this.logger?.debug?.('datacloud.ingestion.ok', {
            event_type: event.event_type,
            event_id: event.event_id,
            attempt,
          });
          return;
        }
        // Client errors (except 429) are non-retryable: fail fast.
        const retryable = res.status >= 500 || res.status === 429;
        const httpError = new Error(`Data Cloud ingestion returned HTTP ${res.status}`);
        if (!retryable) {
          httpError.nonRetryable = true;
          throw httpError;
        }
        lastError = httpError;
      } catch (err) {
        if (err.nonRetryable) {
          this.logger?.error?.('datacloud.ingestion.failed', {
            event_type: event.event_type,
            event_id: event.event_id,
            err: err.message,
          });
          throw err;
        }
        // Network / retryable error — keep trying.
        lastError = err;
      }

      if (attempt < this.maxRetries) {
        const delay = this.retryBaseMs * 2 ** attempt;
        this.logger?.warn?.('datacloud.ingestion.retry', {
          event_type: event.event_type,
          attempt,
          delay,
          err: lastError?.message,
        });
        await this.sleep(delay);
      }
    }

    this.logger?.error?.('datacloud.ingestion.failed', {
      event_type: event.event_type,
      event_id: event.event_id,
      err: lastError?.message,
    });
    throw lastError || new Error('Data Cloud ingestion failed');
  }
}

export default DataCloudIngestionSink;
