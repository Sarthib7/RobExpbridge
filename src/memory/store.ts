import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { recordSchema, type Record } from '../domain/schema.js';
import { seal, verify } from './integrity.js';
export class Store {
  private pending = Promise.resolve();
  constructor(private path: string) {}
  async all(): Promise<Record[]> {
    let text: string;
    try { text = await readFile(this.path, 'utf8'); }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e; }
    const records = recordSchema.array().parse(JSON.parse(text));
    if (records.some(r => !verify(r))) throw new Error('store integrity failure');
    return records;
  }
  async publish(input: unknown): Promise<Record> {
    const record = seal(input);
    const operation = this.pending.then(async () => {
      const records = await this.all();
      if (records.some(r => r.id === record.id)) throw new Error('duplicate experience ID');
      await mkdir(dirname(this.path), { recursive: true });
      const temp = this.path + '.' + randomUUID() + '.tmp';
      await writeFile(temp, JSON.stringify([...records, record], null, 2), { flag: 'wx', mode: 0o600 });
      await rename(temp, this.path);
    });
    this.pending = operation.catch(() => {});
    await operation;
    return record;
  }
}
