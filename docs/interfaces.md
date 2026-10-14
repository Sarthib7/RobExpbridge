# Simulator contract

VERIFIED source: `src/server.ts` validates experiences and simulation requests with strict schemas.
VERIFIED source: recovery accepts a stored experience ID and rechecks compatibility, expiry, revocation and evidence.
VERIFIED source: missing context returns `requires_review`; hardware mismatch returns `incompatible`.
All outcomes are constructed simulation results. Digests detect record changes; they do not authenticate provenance.

## Least confident decisions

1. The single fixture does not model physical robot performance.
2. The JSON store assumes one process owns each file.
