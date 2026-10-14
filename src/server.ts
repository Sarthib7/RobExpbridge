import Fastify from 'fastify';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { Orders, PaymentError } from './economics/orders.js';
import { createRuntime } from './economics/runtime.js';
import { demoExperience } from './sim/experience.js';
import { contextSchema, experienceSchema, querySchema } from './domain/schema.js';
import { seal } from './memory/integrity.js';
import { Store } from './memory/store.js';
import { match } from './memory/match.js';
import { runSimulation } from './sim/assembly.js';
export function buildServer(store = new Store('data/local/experiences.json'), orders?: Orders) {
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  app.setErrorHandler((error, _request, reply) => {
    const e = error as Error & { statusCode?: number };
    if (error instanceof PaymentError) return reply.code(error.statusCode).send({ error: error.message, code: error.code });
    const status = e instanceof z.ZodError ? 400 : e.message === 'duplicate experience ID' ? 409 : e.statusCode && e.statusCode < 500 ? e.statusCode : 500;
    reply.code(status).send({ error: status === 500 ? 'storage or internal failure' : status === 400 ? 'invalid request' : e.message });
  });
  if (orders) {
    app.addHook('onRequest', async (request, reply) => {
      let host: URL;
      try { host = new URL('http://' + request.headers.host); }
      catch { return reply.code(403).send({ error: 'Local requests only.' }); }
      if (!['localhost', '127.0.0.1', '[::1]'].includes(host.hostname)) return reply.code(403).send({ error: 'Local requests only.' });
      if (request.headers.origin && request.headers.origin !== host.origin) return reply.code(403).send({ error: 'Cross-origin requests are blocked.' });
      if (!['GET', 'HEAD'].includes(request.method) && request.headers['x-experiencebridge-client'] !== 'local-ui') return reply.code(403).send({ error: 'Local client header required.' });
      reply.header('Cache-Control', 'no-store');
      reply.header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Referrer-Policy', 'no-referrer');
    });
    app.get('/api/config', async () => ({ mode: orders.gateway.mode, chainId: orders.gateway.chainId, networkName: orders.gateway.mode === 'agung' ? 'Agung testnet' : orders.gateway.mode === 'solana-devnet' ? 'Solana devnet' : 'Local EVM (not peaq)', currency: orders.gateway.currency, price: orders.gateway.price, maxFee: orders.gateway.maxFee, buyerAddress: orders.gateway.buyerAddress, sellerAddress: orders.gateway.sellerAddress, faucetUrl: orders.gateway.mode === 'solana-devnet' ? 'https://faucet.solana.com' : 'https://docs.peaq.xyz/peaqchain/build/getting-started/get-test-tokens', explorerUrl: orders.gateway.explorerUrl }));
    app.get('/api/network', async (_request, reply) => {
      try { const balances = await orders.gateway.balances(); return { connected: true, buyerBalance: balances.buyer, sellerBalance: balances.seller, currency: orders.gateway.currency }; }
      catch { return reply.code(503).send({ error: 'Cannot verify the payment network. Check RPC access and retry.' }); }
    });
    app.post('/api/demo/publish', async () => {
      let record = (await store.all()).find(r => r.id === 'exp-001');
      if (!record) {
        try { record = await store.publish(demoExperience()); }
        catch (error) { if ((error as Error).message !== 'duplicate experience ID') throw error; record = (await store.all()).find(r => r.id === 'exp-001'); }
      }
      return { id: record!.id, contributor: record!.contributor, evidence: record!.evidence, context: record!.context };
    });
    app.post('/api/orders', async request => orders.create(request.body));
    const credentials = (request: { params: unknown; headers: { authorization?: string } }) => {
      const { id } = z.strictObject({ id: z.string().uuid() }).parse(request.params);
      return { id, token: request.headers.authorization?.replace(/^Bearer /, '') ?? '' };
    };
    app.get('/api/orders/:id', async request => { const { id, token } = credentials(request); return orders.get(id, token); });
    app.post('/api/orders/:id/pay', async (request, reply) => {
      const { id, token } = credentials(request);
      try { return await orders.pay(id, token); }
      catch (error) { if (error instanceof PaymentError) throw error; return reply.code(503).send({ error: 'Payment preparation failed. Check buyer funds and the network, then check this order before retrying.' }); }
    });
    app.post('/api/orders/:id/verify', async (request, reply) => {
      const { id, token } = credentials(request);
      try { return await orders.verify(id, token); }
      catch (error) { if (error instanceof PaymentError) throw error; return reply.code(503).send({ error: 'Payment verification is unavailable. Retry checking this order; do not create another payment.' }); }
    });
    app.get('/api/orders/:id/advisory', async request => {
      const { id, token } = credentials(request); const { record } = await orders.unlock(id, token);
      return { advisory: record.advisory, evidence: record.evidence, contributor: record.contributor, advisoryOnly: true };
    });
    app.post('/api/orders/:id/run', async request => {
      const { id, token } = credentials(request); const { record, context } = await orders.unlock(id, token);
      return { ...runSimulation(context, record.advisory), experienceId: record.id, advisoryOnly: true };
    });
  }
  app.get('/health' , async () => ({ status: 'ok', mode: 'synthetic-local-demo', peaq: orders ? orders.gateway.mode : 'simulation', tee: 'not implemented' }));
  app.post('/experiences', async (request, reply) => {
    const input = experienceSchema.parse(request.body);
    const check = match(seal(input), { task: input.task, context: input.context, use: 'synthetic-demo' });
    if (check.status === 'rejected') return reply.code(422).send({ error: 'evidence rejected', reasons: check.reasons });
    const saved = await store.publish(input);
    if (orders) { const { advisory, ...metadata } = saved; return reply.code(201).send({ ...metadata, locked: true }); }
    return reply.code(201).send(saved);
  });
  app.post('/experiences/query', async request => {
    const query = querySchema.parse(request.body);
    return { results: (await store.all()).map(record => ({ id: record.id, ...match(record, query), ...(orders ? { advisory: null, locked: true } : {}) })) };
  });
  app.get('/experiences/:id', async (request, reply) => {
    const { id } = z.strictObject({ id: z.string().min(1).max(100) }).parse(request.params);
    const record = (await store.all()).find(r => r.id === id);
    if (record && orders) { const { advisory, ...metadata } = record; return { ...metadata, locked: true }; }
    return record ?? reply.code(404).send({ error: 'experience not found' });
  });
  app.post('/simulation/run', async (request, reply) => {
    const input = z.strictObject({ context: contextSchema, experienceId: z.string().min(1).max(100).optional() }).parse(request.body);
    if (!input.experienceId) {
      try { return runSimulation(input.context); } catch { return reply.code(422).send({ error: 'unsupported simulation context or envelope' }); }
    }
    if (orders) return reply.code(402).send({ error: 'Use a paid order to run a recovery.', code: 'PAYMENT_REQUIRED' });
    const record = (await store.all()).find(r => r.id === input.experienceId);
    if (!record) return reply.code(404).send({ error: 'experience not found' });
    const decision = match(record, { task: 'connector_insertion', context: input.context, use: 'synthetic-demo' });
    if (decision.status !== 'compatible' || !decision.advisory) return reply.code(422).send(decision);
    return { ...runSimulation(input.context, decision.advisory), experienceId: record.id, advisoryOnly: true };
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.env.PAYMENT_MODE ?? 'agung';
  if (mode !== 'agung' && mode !== 'local' && mode !== 'solana-devnet') throw new Error('PAYMENT_MODE must be agung, solana-devnet or local.');
  const port = z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? (mode === 'solana-devnet' ? 3335 : 3334));
  const runtime = await createRuntime(mode, process.env.EB_DATA_DIR, mode === 'solana-devnet' ? process.env.SOLANA_RPC_URL : process.env.PEAQ_RPC_URL);
  const app = buildServer(runtime.store, runtime.orders);
  app.addHook('onClose', runtime.close);
  try { await app.listen({ port, host: '127.0.0.1' }); }
  catch (error) { await runtime.close(); throw error; }
  console.log(`ExperienceBridge ${mode}: http://127.0.0.1:${port}`);
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close(); });
}
