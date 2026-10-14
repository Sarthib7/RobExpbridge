import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { encodeBase58, hexlify, toUtf8Bytes } from 'ethers';
import type { ActivateMachineParams, ActivationPreview } from '@peaqos/peaq-os-sdk';
import { z } from 'zod';
import { loadTestWallets } from '../src/economics/wallets.js';

export const AGUNG_GENESIS = '0x94a1f4eda5c7cc3a9efe8beaec43dc34bbdc0c7087350e59571126d4f424f147';
export const DEPLOYMENT = 'agung-2026-08-28';
export const MAX_BOND = 3_000_000_000_000_000_000n;
const RPC = 'https://peaq-agung.api.onfinality.io/public';
const contracts = {
 identityRegistry: '0x9E9463a65c7B74623b3b6Cdc39F71be7274e5971',
 identityStaking: '0x55f336714aDb0749DbFE33b057a1702405564E3d',
 // Constructor requirement only. This legacy registry is never used to submit events.
 eventRegistry: '0x2DAD8905380993940e340C5cE6d313d5c2780040',
 machineNft: '0xB41C2A4f1c19b6B06beaAce0F5CD8439e77C4b1c',
 didRegistry: '0x0000000000000000000000000000000000000800',
 batchPrecompile: '0x0000000000000000000000000000000000000805',
} as const;
export function assertAgung(chain: unknown, genesis: unknown) {
 if (chain !== '0x2706' || genesis !== AGUNG_GENESIS) throw new Error('AGUNG_NETWORK_MISMATCH');
}
export function activationAllowed(preview: Pick<ActivationPreview, 'chainId' | 'deploymentId' | 'balance' | 'netPeaqAmount'>) {
 if (preview.chainId !== 9990 || preview.deploymentId !== DEPLOYMENT) throw new Error('AGUNG_NETWORK_MISMATCH');
 if (preview.netPeaqAmount > MAX_BOND) throw new Error('BOND_CAP_EXCEEDED');
 if (preview.balance < preview.netPeaqAmount + 50_000_000_000_000_000n) throw new Error('INSUFFICIENT_TEST_TOKENS');
}
const currentStateSchema = z.object({ machineId: z.bigint(), owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/), controller: z.string().regex(/^0x[0-9a-fA-F]{40}$/), isHomedLocally: z.boolean(), subscription: z.object({ periodStart: z.bigint(), periodEnd: z.bigint() }) });
export function assertCurrentActivation(input: unknown, machineId: bigint, owner: string, now = BigInt(Math.floor(Date.now() / 1000))) {
 const parsed = currentStateSchema.safeParse(input);
 if (!parsed.success) throw new Error('ACTIVATION_STATE_UNAVAILABLE');
 const state = parsed.data;
 if (state.machineId !== machineId || state.owner.toLowerCase() !== owner.toLowerCase() || state.controller.toLowerCase() !== owner.toLowerCase() || !state.isHomedLocally) throw new Error('ACTIVATION_IDENTITY_MISMATCH');
 if (state.subscription.periodStart <= 0n || state.subscription.periodStart > now || state.subscription.periodEnd <= now) throw new Error('ACTIVATION_SUBSCRIPTION_NOT_CURRENT');
}
const confirmationSchema = z.strictObject({ deploymentId: z.literal(DEPLOYMENT), machineId: z.string().regex(/^[1-9][0-9]*$/), owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/), transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), confirmedAt: z.string().datetime() });
type Confirmation = z.infer<typeof confirmationSchema>;
export async function confirmedActivation(dataDir: string, machineId: string, value?: Confirmation): Promise<Confirmation | null> {
 if (!/^[1-9][0-9]*$/.test(machineId)) throw new Error('ACTIVATION_ID_INVALID');
 const path = join(dataDir, `peaqos-confirmed-${machineId}.json`);
 if (value) {
  const parsed = confirmationSchema.parse(value);
  if (parsed.machineId !== machineId) throw new Error('ACTIVATION_IDENTITY_MISMATCH');
  await mkdir(dataDir, { recursive: true, mode: 0o700 });
  try { await writeFile(path, JSON.stringify(parsed), { flag: 'wx', mode: 0o600 }); }
  catch (error) {
   if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
   const previous = await confirmedActivation(dataDir, machineId);
   if (previous?.transactionHash !== parsed.transactionHash || previous.owner.toLowerCase() !== parsed.owner.toLowerCase()) throw new Error('ACTIVATION_EVIDENCE_CONFLICT');
  }
 }
 try { return confirmationSchema.parse(JSON.parse(await readFile(path, 'utf8'))); }
 catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw new Error('ACTIVATION_EVIDENCE_INVALID'); }
}
export function publicError(error: unknown) {
 const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : error instanceof Error ? error.message : '';
 return typeof code === 'string' && /^[A-Z_]{3,64}$/.test(code) ? code : 'PEAQOS_CHECK_FAILED';
}
async function rpc(method: string, params: unknown[]) {
 const response = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }), signal: AbortSignal.timeout(15_000) });
 const body = await response.json() as { result?: unknown; error?: unknown };
 if (!response.ok || body.error) throw new Error('AGUNG_RPC_FAILED');
 return body.result;
}
async function network() {
 const [chainId, genesis] = await Promise.all([rpc('eth_chainId', []), rpc('chain_getBlockHash', [0])]);
 assertAgung(chainId, genesis); return { chainId: 9990, genesis };
}
export async function machineKey(dataDir: string) {
 await mkdir(dataDir, { recursive: true, mode: 0o700 });
 const file = join(dataDir, 'machine-ed25519.pem');
 try {
  const { privateKey } = generateKeyPairSync('ed25519');
  await writeFile(file, privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 });
 } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw new Error('MACHINE_KEY_CREATION_FAILED'); }
 if (((await stat(file)).mode & 0o077) !== 0) throw new Error('MACHINE_KEY_PERMISSIONS');
 const key = createPrivateKey(await readFile(file));
 if (key.asymmetricKeyType !== 'ed25519') throw new Error('MACHINE_KEY_TYPE');
 const publicDer = createPublicKey(key).export({ type: 'spki', format: 'der' });
 return 'z' + encodeBase58(Buffer.concat([Buffer.from([0xed, 0x01]), publicDer.subarray(-32)]));
}
export async function main(activate = false) {
 process.env.PEAQOS_TELEMETRY = '0'; process.env.DO_NOT_TRACK = '1';
 const evidence: Record<string, unknown> = { observedAt: new Date().toISOString(), provenance: 'VERIFIED', network: 'Agung testnet', deploymentId: DEPLOYMENT, status: 'blocked', transactionHash: null, simulation: true, note: 'Synthetic robot identity. Preview does not activate a machine. Solana peaqOS onboarding is mainnet-only; this tool never uses mainnet.' };
 const dataDir = process.env.EB_DATA_DIR ?? 'data/local';
 try {
  evidence.networkCheck = await network();
  const wallets = await loadTestWallets(join(dataDir, 'test-wallets.json'));
  const publicKeyMultibase = await machineKey(dataDir);
  const { PeaqosClient, resolveTokenomics20Deployment } = await import('@peaqos/peaq-os-sdk');
  const deployment = resolveTokenomics20Deployment(DEPLOYMENT);
  evidence.contracts = deployment.contracts;
  evidence.owner = wallets.buyerAddress;
  evidence.balanceWei = BigInt(await rpc('eth_getBalance', [wallets.buyerAddress, 'latest']) as string).toString();
  evidence.verificationKey = publicKeyMultibase;
  const client = new PeaqosClient<'tokenomics20'>({ rpcUrl: RPC, privateKey: wallets.buyerPrivateKey, contracts, tokenomics20: { deploymentId: DEPLOYMENT } });
  const params: ActivateMachineParams = { controller: wallets.buyerAddress as `0x${string}`, verificationMethods: [{ id: '#machine-key', methodType: 'Ed25519VerificationKey2020', controller: wallets.buyerAddress as `0x${string}`, publicKeyMultibase }], authentication: [0n], serviceEndpoints: [], machineType: 'ExperienceBridgeSyntheticArm', credentialSubject: hexlify(toUtf8Bytes(JSON.stringify({ application: 'ExperienceBridge', role: 'Arm B', owner: wallets.buyerAddress, simulation: true }))) as `0x${string}`, manufacturer: wallets.buyerAddress as `0x${string}`, tier: 0, maxNetPeaqAmount: MAX_BOND, timeoutMs: 90_000 };
  evidence.identityClaims = { machineType: params.machineType, credentialSubject: params.credentialSubject, manufacturerMeaning: 'Self-declared synthetic demo operator, not a verified hardware manufacturer.' };
  const machineId = await client.computeMachineId(params.machineType, params.credentialSubject);
  evidence.machineId = machineId.toString(); evidence.machineIdStatus = 'computed, activation not yet verified';
  const historical = await confirmedActivation(dataDir, machineId.toString());
  if (historical) {
   if (historical.owner.toLowerCase() !== wallets.buyerAddress.toLowerCase()) throw new Error('ACTIVATION_EVIDENCE_CONFLICT');
   evidence.confirmedActivation = historical; evidence.transactionHash = historical.transactionHash;
  }
  try {
   const state = await client.getMachineActivationState(machineId);
   evidence.activationState = state;
   assertCurrentActivation(state, machineId, wallets.buyerAddress);
   evidence.status = 'activated'; evidence.machineIdStatus = 'owner, controller and current subscription verified on-chain';
  } catch (error) {
   evidence.activationStateError = publicError(error);
   if (evidence.activationStateError !== 'MACHINE_NOT_FOUND') throw error;
  }
  if (evidence.status !== 'activated') {
   const preview = await client.previewMachineActivation({ ...params, expectedMachineId: machineId });
   evidence.preview = preview;
   activationAllowed(preview);
   evidence.status = 'ready';
   if (activate) {
    await network();
    // Exclusive persistent journal blocks a repeat after an uncertain SDK write or crash.
    const journal = join(dataDir, 'peaqos-activation-attempt.json');
    try { await writeFile(journal, JSON.stringify({ machineId: machineId.toString(), startedAt: new Date().toISOString(), state: 'attempting' }), { flag: 'wx', mode: 0o600 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('ACTIVATION_ATTEMPT_REQUIRES_RECONCILIATION'); throw error; }
    const result = await client.activateMachine({ ...params, expectedMachineId: machineId });
    evidence.transactionHash = result.transactionHash;
    evidence.activationState = await client.getMachineActivationState(machineId);
    const state = evidence.activationState as Awaited<ReturnType<typeof client.getMachineActivationState>>;
    assertCurrentActivation(state, machineId, wallets.buyerAddress);
    evidence.confirmedActivation = await confirmedActivation(dataDir, machineId.toString(), { deploymentId: DEPLOYMENT, machineId: machineId.toString(), owner: wallets.buyerAddress, transactionHash: result.transactionHash, confirmedAt: new Date().toISOString() });
    evidence.status = 'activated'; evidence.machineIdStatus = 'on-chain activation verified';
    await writeFile(journal, JSON.stringify({ machineId: machineId.toString(), state: 'activated', transactionHash: result.transactionHash }), { mode: 0o600 });
   }
  }
 } catch (error) { evidence.error = publicError(error); evidence.status = 'blocked'; }
 await mkdir('data/evidence', { recursive: true });
 const json = JSON.stringify(evidence, (_, value) => typeof value === 'bigint' ? value.toString() : value, 2);
 await writeFile('data/evidence/peaqos-readiness.json', json + '\n');
 console.log(json);
 if (evidence.status === 'blocked') process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 if (process.argv.slice(2).some(arg => arg !== '--activate')) throw new Error('Only --activate is supported. This command is Agung-only.');
 await main(process.argv.includes('--activate'));
}
