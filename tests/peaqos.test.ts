import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, stat, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AGUNG_GENESIS, DEPLOYMENT, MAX_BOND, assertAgung, activationAllowed, machineKey, publicError, assertCurrentActivation, confirmedActivation } from '../scripts/peaqos-check.js';

test('peaqOS checks reject mainnet and a different genesis before SDK use', () => {
 assert.doesNotThrow(() => assertAgung('0x2706', AGUNG_GENESIS));
 assert.throws(() => assertAgung('0xd0a', AGUNG_GENESIS), /AGUNG_NETWORK_MISMATCH/);
 assert.throws(() => assertAgung('0x2706', '0xwrong'), /AGUNG_NETWORK_MISMATCH/);
});
test('peaqOS activation requires Agung, capped bond and funds including gas reserve', () => {
 const preview = { chainId: 9990, deploymentId: DEPLOYMENT, balance: MAX_BOND + 50_000_000_000_000_000n, netPeaqAmount: MAX_BOND };
 assert.doesNotThrow(() => activationAllowed(preview));
 assert.throws(() => activationAllowed({ ...preview, chainId: 3338 }), /AGUNG_NETWORK_MISMATCH/);
 assert.throws(() => activationAllowed({ ...preview, netPeaqAmount: MAX_BOND + 1n }), /BOND_CAP_EXCEEDED/);
 assert.throws(() => activationAllowed({ ...preview, balance: MAX_BOND }), /INSUFFICIENT_TEST_TOKENS/);
});
test('machine verification key persists and private file is restricted', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'eb-peaqos-key-'));
 const first = await machineKey(directory);
 assert.match(first, /^z6Mk/);
 assert.equal(await machineKey(directory), first);
 assert.equal((await stat(join(directory, 'machine-ed25519.pem'))).mode & 0o777, 0o600);
});
test('SDK error output excludes raw provider messages and secrets', () => {
 assert.equal(publicError({ code: 'INSUFFICIENT_BALANCE', message: 'private data' }), 'INSUFFICIENT_BALANCE');
 assert.equal(publicError(new Error('request includes secret 0x123')), 'PEAQOS_CHECK_FAILED');
});

test('current activation requires matching identity and an active subscription', () => {
 const owner = '0x' + '11'.repeat(20);
 const state = { machineId: 7n, owner, controller: owner, isHomedLocally: true, subscription: { periodStart: 10n, periodEnd: 30n } };
 assert.doesNotThrow(() => assertCurrentActivation(state, 7n, owner, 20n));
 for (const changed of [{ ...state, owner: '0x' + '22'.repeat(20) }, { ...state, controller: '0x' + '22'.repeat(20) }, { ...state, machineId: 8n }, { ...state, isHomedLocally: false }]) assert.throws(() => assertCurrentActivation(changed, 7n, owner, 20n), /ACTIVATION_IDENTITY_MISMATCH/);
 for (const subscription of [{ periodStart: 0n, periodEnd: 30n }, { periodStart: 21n, periodEnd: 30n }, { periodStart: 10n, periodEnd: 20n }]) assert.throws(() => assertCurrentActivation({ ...state, subscription }, 7n, owner, 20n), /ACTIVATION_SUBSCRIPTION_NOT_CURRENT/);
 assert.throws(() => assertCurrentActivation({ ...state, subscription: undefined }, 7n, owner, 20n), /ACTIVATION_STATE_UNAVAILABLE/);
});
test('confirmed activation evidence survives refresh and rejects replacement', async () => {
 const directory = await mkdtemp(join(tmpdir(), 'eb-peaqos-confirmed-'));
 const value = { deploymentId: DEPLOYMENT, machineId: '7', owner: '0x' + '11'.repeat(20), transactionHash: '0x' + 'aa'.repeat(32), confirmedAt: '2026-10-13T00:00:00.000Z' } as const;
 assert.equal(await confirmedActivation(directory, '7'), null);
 await confirmedActivation(directory, '7', value);
 assert.deepEqual(await confirmedActivation(directory, '7'), value);
 await assert.rejects(confirmedActivation(directory, '7', { ...value, transactionHash: '0x' + 'bb'.repeat(32) }), /ACTIVATION_EVIDENCE_CONFLICT/);
 assert.deepEqual(JSON.parse(await readFile(join(directory, 'peaqos-confirmed-7.json'), 'utf8')), value);
 assert.equal(await confirmedActivation(directory, '8'), null);
});
