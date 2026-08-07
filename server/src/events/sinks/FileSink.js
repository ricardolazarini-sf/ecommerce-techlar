import fs from 'node:fs';
import path from 'node:path';

// Appends each event as a JSON line (JSONL) to a file. Useful for local
// inspection or shipping via a file-based log drain.
export class FileSink {
  constructor({ filePath = './events.log', logger } = {}) {
    this.name = 'file';
    this.filePath = path.resolve(filePath);
    this.logger = logger;
  }

  async send(event) {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true }).catch(() => {});
    await fs.promises.appendFile(this.filePath, JSON.stringify(event) + '\n', 'utf8');
  }
}

export default FileSink;
