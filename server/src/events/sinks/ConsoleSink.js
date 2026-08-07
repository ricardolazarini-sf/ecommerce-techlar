// Default sink (development). Prints each event as a structured log line.
// Nothing leaves the process — safe to use during builds and tests.
export class ConsoleSink {
  constructor({ logger } = {}) {
    this.name = 'console';
    this.logger = logger;
  }

  async send(event) {
    if (this.logger?.info) {
      this.logger.info('event.emitted', { sink: this.name, event });
    } else {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify({ sink: this.name, event }));
    }
  }
}

export default ConsoleSink;
