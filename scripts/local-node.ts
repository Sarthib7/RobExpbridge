import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function freePort(): Promise<number> {
  const server = createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
  return port;
}
export async function rpc(url: string, method: string, params: unknown[] = []) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(3000) });
  const body = await response.json() as { result: unknown; error?: unknown };
  if (!response.ok || body.error) throw new Error('Local node RPC failed: ' + method);
  return body.result;
}
export async function startLocalNode(port: number, stateDirectory?: string) {
  if (stateDirectory) await mkdir(stateDirectory, { recursive: true, mode: 0o700 });
  const url = `http://127.0.0.1:${port}`;
  let occupied = false;
  try { await rpc(url, 'eth_chainId'); occupied = true; } catch { /* No RPC is listening. */ }
  if (occupied) throw new Error('Local RPC port is already in use. Stop that node before starting this demo.');
  const args = ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337', '--accounts', '0', '--silent', '--no-cors', '--block-time', '1', '--slots-in-an-epoch', '1'];
  if (stateDirectory) args.push('--state', resolve(stateDirectory, 'anvil.json'), '--preserve-historical-states');
  // Do not print Anvil's account material. The application creates separate random test wallets.
  const child = spawn('anvil', args, { stdio: 'ignore' });
  let failed = false; child.on('error', () => { failed = true; });
  const stop = async () => { if (child.exitCode === null && !failed) { child.kill('SIGINT'); await once(child, 'exit'); } };
  for (let attempt = 0; attempt < 50; attempt++) {
    if (failed || child.exitCode !== null) throw new Error('Could not start Anvil. Install Foundry and check that the local RPC port is free.');
    try { if (await rpc(url, 'eth_chainId') === '0x7a69') return { url, stop }; } catch { /* Wait for our node to start. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  await stop(); throw new Error('Anvil did not become ready.');
}
