import { createHash } from 'node:crypto';
import { experienceSchema, recordSchema, type Experience, type Record } from '../domain/schema.js';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value !== null && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k,v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}';
  return JSON.stringify(value);
}
export function digest(record: Experience): string { return createHash('sha256').update(canonical(record)).digest('hex'); }
export function seal(input: unknown): Record { const record = experienceSchema.parse(input); return { ...record, integrity: { sha256: digest(record) } }; }
export function verify(input: unknown): boolean {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return false;
  const { integrity, ...record } = parsed.data;
  return integrity.sha256 === digest(record);
}
