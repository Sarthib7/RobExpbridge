import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { z } from 'zod';
import { contextSchema, type Record as ExperienceRecord } from '../domain/schema.js';
import { Store } from '../memory/store.js';
import { match } from '../memory/match.js';
import type { ChainGateway, PaymentIntent } from './chain.js';

const orderSchema = z.strictObject({
  id: z.string().uuid(), token: z.string().regex(/^[a-f0-9]{64}$/), idempotencyKey: z.string().uuid(),
  experienceId: z.string(), digest: z.string(), context: contextSchema,
  state: z.enum(['quoted', 'pending', 'confirmed', 'rejected']), createdAt: z.string(), expiresAt: z.string(),
  buyerAddress: z.string(), sellerAddress: z.string(), amountAtomic: z.enum(['1000000000000000', '1000000']), data: z.string(),
  transactionHash: z.string().nullable(), rawTransaction: z.string().nullable(), reason: z.string(),
});
type Order = z.infer<typeof orderSchema>;
export class PaymentError extends Error {
  constructor(public code: string, message: string, public statusCode = 400) { super(message); }
}
export class Orders {
  // One process owns this file. The queue also serializes signing across buyer nonces.
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private path: string, private store: Store, public gateway: ChainGateway) {}
  private async load() {
    try {
      const schema = z.preprocess(value => {
        if (value && typeof value === 'object' && 'amountWei' in value && !('amountAtomic' in value)) {
          const { amountWei, ...rest } = value; return { ...rest, amountAtomic: amountWei };
        }
        return value;
      }, orderSchema);
      const orders = schema.array().parse(JSON.parse(await readFile(this.path, 'utf8')));
      if (orders.some(o => o.amountAtomic !== this.gateway.amountAtomic || o.buyerAddress !== this.gateway.buyerAddress || o.sellerAddress !== this.gateway.sellerAddress)) throw new Error('Wrong payment network or wallet.');
      return orders;
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new PaymentError('ORDER_STORE_UNAVAILABLE', 'Order storage is unavailable. Existing payments were not changed.', 503);
    }
  }
  private async save(orders: Order[]) {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    const temp = this.path + '.' + randomUUID() + '.tmp';
    await writeFile(temp, JSON.stringify(orders), { flag: 'wx', mode: 0o600 });
    await rename(temp, this.path);
  }
  private serial<T>(fn: () => Promise<T>): Promise<T> {
    const work = this.queue.then(fn); this.queue = work.catch(() => {}); return work;
  }
  private auth(orders: Order[], id: string, token: string): Order {
    const order = orders.find(o => o.id === id);
    if (!order || !/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(order.token))) throw new PaymentError('ORDER_UNAUTHORIZED', 'Order access token is missing or invalid.', 401);
    return order;
  }
  private async compatible(experienceId: string, context: Order['context'], digest?: string): Promise<ExperienceRecord> {
    const record = (await this.store.all()).find(r => r.id === experienceId);
    if (!record) throw new PaymentError('EXPERIENCE_NOT_FOUND', 'Publish the example experience first.', 404);
    if (digest && record.integrity.sha256 !== digest) throw new PaymentError('EXPERIENCE_CHANGED', 'The experience changed after this quote. Access is blocked.', 409);
    const decision = match(record, { task: 'connector_insertion', context, use: 'synthetic-demo' });
    if (decision.status !== 'compatible') throw new PaymentError('INCOMPATIBLE', decision.reasons.join('; '), 422);
    return record;
  }
  private intent(o: Order): PaymentIntent { return { buyer: o.buyerAddress, seller: o.sellerAddress, amountAtomic: o.amountAtomic, data: o.data }; }
  private view(o: Order) {
    return { id: o.id, experienceId: o.experienceId, state: o.state, recordDigest: o.digest, data: o.data, price: this.gateway.price, currency: this.gateway.currency, buyerAddress: o.buyerAddress, sellerAddress: o.sellerAddress, expiresAt: o.expiresAt, transactionHash: o.transactionHash, explorerUrl: o.transactionHash ? this.gateway.transactionUrl(o.transactionHash) || null : null, reason: o.reason };
  }
  async create(input: unknown) {
    const request = z.strictObject({ experienceId: z.string().min(1).max(100), context: contextSchema, idempotencyKey: z.string().uuid() }).parse(input);
    return this.serial(async () => {
      const orders = await this.load();
      const previous = orders.find(o => o.idempotencyKey === request.idempotencyKey);
      if (previous) {
        if (previous.experienceId !== request.experienceId || JSON.stringify(previous.context) !== JSON.stringify(request.context)) throw new PaymentError('IDEMPOTENCY_CONFLICT', 'This request key already belongs to a different quote.', 409);
        return { order: this.view(previous), token: previous.token };
      }
      const record = await this.compatible(request.experienceId, request.context);
      const id = randomUUID();
      const order: Order = { ...request, id, token: randomBytes(32).toString('hex'), digest: record.integrity.sha256, state: 'quoted', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), buyerAddress: this.gateway.buyerAddress, sellerAddress: this.gateway.sellerAddress, amountAtomic: z.enum(['1000000000000000', '1000000']).parse(this.gateway.amountAtomic), data: '0x' + Buffer.from('experiencebridge:' + id + ':' + record.integrity.sha256).toString('hex'), rawTransaction: null, transactionHash: null, reason: 'Quote ready. No payment sent.' };
      orders.push(order); await this.save(orders);
      return { order: this.view(order), token: order.token };
    });
  }
  async get(id: string, token: string) { return { order: this.view(this.auth(await this.load(), id, token)) }; }
  async pay(id: string, token: string) {
    return this.serial(async () => {
      const orders = await this.load(); const o = this.auth(orders, id, token);
      if (o.state === 'confirmed' || o.state === 'rejected') return { order: this.view(o) };
      await this.compatible(o.experienceId, o.context, o.digest);
      if (!o.rawTransaction) {
        if (Date.parse(o.expiresAt) <= Date.now()) throw new PaymentError('QUOTE_EXPIRED', 'This quote expired. Create a new quote.', 409);
        // Never sign another nonce while a previous signed transaction has an uncertain outcome.
        if (orders.some(other => other.id !== o.id && other.state === 'pending')) throw new PaymentError('PAYMENT_PENDING', 'Verify the earlier pending payment before starting another.', 409);
        const prepared = await this.gateway.prepare(this.intent(o));
        o.rawTransaction = prepared.rawTransaction; o.transactionHash = prepared.transactionHash;
        o.state = 'pending'; o.reason = 'Signed payment saved. Awaiting broadcast and finality.';
        await this.save(orders);
      }
      try { await this.gateway.broadcast(o.rawTransaction); o.reason = 'Payment submitted. Check finality to unlock the advisory.'; }
      catch { o.reason = 'Broadcast outcome unknown. Check payment status, or retry this same payment. Do not create another payment.'; }
      await this.save(orders); return { order: this.view(o) };
    });
  }
  async verify(id: string, token: string) {
    return this.serial(async () => {
      const orders = await this.load(); const o = this.auth(orders, id, token);
      if (!o.transactionHash) return { order: this.view(o) };
      const checked = await this.gateway.verify(this.intent(o), o.transactionHash);
      o.state = checked.state; o.reason = checked.reason; await this.save(orders);
      return { order: this.view(o) };
    });
  }
  async unlock(id: string, token: string) {
    const o = this.auth(await this.load(), id, token);
    if (o.state !== 'confirmed' || !o.transactionHash) throw new PaymentError('PAYMENT_REQUIRED', 'A finalized payment is required.', 402);
    // Re-read chain evidence at access time so stale local status cannot grant access.
    const checked = await this.gateway.verify(this.intent(o), o.transactionHash);
    if (checked.state !== 'confirmed') throw new PaymentError('PAYMENT_NOT_FINAL', checked.reason, 402);
    const record = await this.compatible(o.experienceId, o.context, o.digest);
    return { record, context: o.context };
  }
}
