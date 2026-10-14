import Fastify from 'fastify';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { contextSchema, experienceSchema, querySchema } from './domain/schema.js';
import { seal } from './memory/integrity.js';
import { Store } from './memory/store.js';
import { match } from './memory/match.js';
import { runSimulation } from './sim/assembly.js';
export function buildServer(store = new Store('data/local/experiences.json')) {
  const app = Fastify({ logger: false, bodyLimit: 65536 });
  app.setErrorHandler((error, _request, reply) => {
    const e = error as Error & { statusCode?: number };
    const status = e instanceof z.ZodError ? 400 : e.message === 'duplicate experience ID' ? 409 : e.statusCode && e.statusCode < 500 ? e.statusCode : 500;
    reply.code(status).send({ error: status === 500 ? 'storage or internal failure' : status === 400 ? 'invalid request' : e.message });
  });
  app.get('/health' , async () => ({ status: 'ok', mode: 'synthetic-local-demo', peaq: 'simulation', tee: 'not implemented' }));
  app.post('/experiences', async (request, reply) => {
    const input = experienceSchema.parse(request.body);
    const check = match(seal(input), { task: input.task, context: input.context, use: 'synthetic-demo' });
    if (check.status === 'rejected') return reply.code(422).send({ error: 'evidence rejected', reasons: check.reasons });
    const saved = await store.publish(input);
    return reply.code(201).send(saved);
  });
  app.post('/experiences/query', async request => {
    const query = querySchema.parse(request.body);
    return { results: (await store.all()).map(record => ({ id: record.id, ...match(record, query) })) };
  });
  app.get('/experiences/:id', async (request, reply) => {
    const { id } = z.strictObject({ id: z.string().min(1).max(100) }).parse(request.params);
    const record = (await store.all()).find(r => r.id === id);
    return record ?? reply.code(404).send({ error: 'experience not found' });
  });
  app.post('/simulation/run', async (request, reply) => {
    const input = z.strictObject({ context: contextSchema, experienceId: z.string().min(1).max(100).optional() }).parse(request.body);
    if (!input.experienceId) {
      try { return runSimulation(input.context); } catch { return reply.code(422).send({ error: 'unsupported simulation context or envelope' }); }
    }
    const record = (await store.all()).find(r => r.id === input.experienceId);
    if (!record) return reply.code(404).send({ error: 'experience not found' });
    const decision = match(record, { task: 'connector_insertion', context: input.context, use: 'synthetic-demo' });
    if (decision.status !== 'compatible' || !decision.advisory) return reply.code(422).send(decision);
    return { ...runSimulation(input.context, decision.advisory), experienceId: record.id, advisoryOnly: true };
  });
  return app;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = z.coerce.number().int().min(1024).max(65535).parse(process.env.PORT ?? 8787);
  const app = buildServer();
  await app.listen({ port, host: '127.0.0.1' });
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void app.close(); });
}
