# Simulator contract

VERIFIED source: `src/server.ts` validates experiences and simulation requests with strict schemas.
VERIFIED source: recovery accepts a stored experience ID and rechecks compatibility, expiry, revocation and evidence.
VERIFIED source: missing context returns `requires_review`; hardware mismatch returns `incompatible`.
All outcomes are constructed simulation results. Digests detect record changes; they do not authenticate provenance.

## Least confident decisions

1. The single fixture does not model physical robot performance.
2. The JSON store assumes one process owns each file.

## EVM gateway

VERIFIED source: `src/economics/chain.ts` binds payment evidence to buyer, seller, amount, memo, network and finalized canonical inclusion.
VERIFIED source: `src/economics/wallets.ts` stores generated test-wallet keys in files with mode 0600.
No live transfer is part of CI.

## License orders

VERIFIED source: `src/economics/orders.ts` stores a bearer token, quote, record digest, payment intent and signed bytes before broadcast.
VERIFIED source: retries reuse saved signed bytes; unlock rechecks finality and record compatibility.
