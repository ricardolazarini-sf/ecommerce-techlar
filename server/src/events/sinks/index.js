import { ConsoleSink } from './ConsoleSink.js';
import { FileSink } from './FileSink.js';
import { DataCloudIngestionSink } from './DataCloudIngestionSink.js';

// Factory that builds the configured sink. Adding a new destination is a matter
// of implementing `{ name, async send(event) }` and wiring one more case here —
// no domain code changes required.
export function createSink(eventsConfig = {}, logger) {
  const kind = (eventsConfig.sink || 'console').toLowerCase();
  switch (kind) {
    case 'file':
      return new FileSink({ filePath: eventsConfig.filePath, logger });
    case 'datacloud':
      return new DataCloudIngestionSink({ ...(eventsConfig.dataCloud || {}), logger });
    case 'console':
    default:
      return new ConsoleSink({ logger });
  }
}

export { ConsoleSink, FileSink, DataCloudIngestionSink };
export default createSink;
