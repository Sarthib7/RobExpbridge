import { z } from 'zod';
import { contextSchema, querySchema } from './domain/schema.js';
import { seal } from './memory/integrity.js';
import { match } from './memory/match.js';
import { runSimulation } from './sim/assembly.js';
import { demoExperience } from './sim/experience.js';

const record = seal(demoExperience());
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
// This entry point imports no wallet, signer, order store, or payment gateway.
export function createPublicHandler(assets: Record<string, string>, evidence: string, peaqos: unknown) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const asset = assets[url.pathname];
      if (asset !== undefined) return new Response(asset, { headers: { ...headers, 'Content-Type': url.pathname.endsWith('.json') ? 'application/json' : url.pathname.endsWith('.js') ? 'application/javascript' : url.pathname.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' } });
      if (url.pathname === '/evidence' || url.pathname === '/evidence.md') return new Response(evidence, { headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
      if (url.pathname === '/api/peaqos') return json(peaqos);
      if (url.pathname === '/api/config') return json({ mode: 'public-demo', publicDemo: true, networkName: 'Public simulation preview', chainId: null, currency: '', maxFee: '0', price: '0', buyerAddress: 'No signing wallet connected', sellerAddress: 'No signing wallet connected', faucetUrl: null, explorerUrl: null });
      if (url.pathname === '/api/network') return json({ connected: false, buyerBalance: 'Not connected', sellerBalance: 'Not connected', currency: '' });
      if (url.pathname === '/health') return json({ status: 'ok', mode: 'public-demo', paymentSigning: false, peaqos: 'See /api/peaqos for measured readiness. Activation is not implied.' });
      return json({ error: 'Not found.' }, 404);
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'Cross-origin requests are blocked.' }, 403);
    if (request.headers.get('x-experiencebridge-client') !== 'local-ui') return json({ error: 'Client header required.' }, 403);
    if (url.pathname.startsWith('/api/orders')) return json({ error: 'Public preview cannot create orders, sign payments, or unlock paid access. Use the local test workspace.' }, 403);
    try {
      const text = await request.text();
      if (text.length > 16_384) return json({ error: 'Request too large.' }, 413);
      const input = JSON.parse(text);
      if (url.pathname === '/api/demo/publish') {
        z.strictObject({}).parse(input);
        return json({ id: record.id, contributor: record.contributor, evidence: record.evidence, context: record.context, persisted: false, publicDemo: true });
      }
      if (url.pathname === '/experiences/query') {
        const decision = match(record, querySchema.parse(input));
        return json({ results: [{ id: record.id, ...decision, advisory: null }] });
      }
      if (url.pathname === '/simulation/run' || url.pathname === '/api/demo/recovery') {
        const { context } = z.strictObject({ context: contextSchema }).parse(input);
        if (url.pathname === '/simulation/run') return json(runSimulation(context));
        const decision = match(record, { task: 'connector_insertion', context, use: 'synthetic-demo' });
        if (decision.status !== 'compatible') return json({ error: decision.reasons.join('; ') }, 422);
        return json({ ...runSimulation(context, decision.advisory), publicDemo: true, paymentSent: false });
      }
      return json({ error: 'Not found.' }, 404);
    } catch { return json({ error: 'Invalid or unsupported synthetic scenario.' }, 400); }
  };
}
