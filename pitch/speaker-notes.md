# Slide 1: EXBRIDGE

One robot’s recovery.
Another robot’s next decision.

An evidence-backed exchange for robot recovery lessons.

THE WEDGE
Share a compatible recovery before another machine repeats the failure.

THE PROOF
A working, deterministic three-arm simulator with 15 passing tests.

VERIFIED: npm run demo; npm test, 13 October 2026.

Speaker notes: Open with the demo. exbridge transfers a typed recovery advisory between synthetic factory scenarios. The current proof is a constructed simulator, not a physical deployment.

# Slide 2: 01 / PROBLEM

Useful recovery lessons
need a path across owners.

Start with connector insertion across independent factories.

CURRENT HYPOTHESIS
Operators may repeat commissioning and recovery work when lessons stay inside deployments.

WHAT MUST TRANSFER
Hardware context, evidence and permission to use the lesson. A procedure alone is insufficient.

INFERRED: commercial hypothesis. Source: vision.md, Why now / problem.

Speaker notes: We have not measured customer demand or downtime savings. The buyer hypothesis is a systems integrator or fleet operator who repeatedly solves similar recovery problems.

# Slide 3: 02 / PRODUCT

Consult experience
before execution.

A narrow path from a recorded failure to a compatible advisory.

CONTRIBUTE
Arm A records a failure and a simulator-tested recovery.

CONSULT
Arm B queries by task, hardware and fixture. The service returns an advisory only when the gates pass.

REJECT
Arm C has a different gripper. The service refuses the transfer.

VERIFIED: scripts/demo.ts; src/memory/match.ts; npm run demo.

Speaker notes: The existing controller retains execution authority. No physical robot commands or downloaded robot procedures are executed.

# Slide 4: 03 / DEMO

Same fixture.
Different decision.

Constructed scenario: seed 7, fixture-7, connector insertion.

WITHOUT MEMORY
Arm B: 12 N → slip. Baseline failures: 1/1.

WITH MEMORY
Arm B: 8 N → success. Recovery successes: 1/1.

INCOMPATIBLE ARM
Arm C: vacuum-v2 → gripper mismatch. Advisory: null.

VERIFIED: npm run demo. One fixed case; no statistical or real-world performance claim.

Speaker notes: Run npm run demo. Point to identical seed and fixture for Arm B. The lower force succeeds because of deterministic scenario rules. These results do not establish general transfer effectiveness.

# Slide 5: 04 / TRUST

A useful lesson
needs boundaries.

The service refuses unsafe or unsupported recommendations.

COMPATIBILITY
Task, robot model, gripper, connector, material, fixture and force envelope must match.

EVIDENCE & LIFECYCLE
Replay the fixed recovery. Reject expired, revoked or insufficient-evidence records. Missing context requires review.

INTEGRITY
Canonical SHA-256 detects edits against the saved digest. Contributor claims remain unauthenticated.

VERIFIED: src/memory/match.ts; src/memory/integrity.ts; npm test.

Speaker notes: Do not describe a digest as a signature. Replacing both record and digest can evade this check. Current identities and outcome declarations are synthetic.

# Slide 6: 05 / MACHINE ECONOMY

The traded service:
a permitted recovery lesson.

Proposed deal: Factory B licenses an applicable insight from Factory A.

VALUE EXCHANGE
Contributor supplies a lesson with evidence and permitted uses. Consumer obtains a compatible advisory.

PEAQ ROLE
Planned machine identity links attribution to machines. Planned settlement records licensed access.

DATA BOUNDARY
Keep experience content offchain. Record economic events without publishing proprietary telemetry.

INFERRED: proposed economic design. VERIFIED: current receipt is simulated; transactionHash: null.

Speaker notes: peaq has a direct role in the proposed exchange: attribution and settlement between owners. Neither role is integrated today. Pricing and willingness to pay remain untested.

# Slide 7: 06 / IMPLEMENTATION

The core path runs today.

TypeScript + Fastify + Zod + local JSON + Node crypto.

WORKING
Publish → persist → query → verify → advise → replay. HTTP API and one-command CLI demo.

CHECKED
15 tests passed, 0 failed. Includes mismatches, tampering, expiry, unsafe force and simulated payment errors.

INTEGRATION STATUS
peaq receipt: simulated. Machine ID: synthetic. dstack and ROS: not implemented.

VERIFIED: npm test: tests 15, pass 15, fail 0. Source: package.json; README.md.

Speaker notes: The service is local, unauthenticated and intended for synthetic demos. Passing tests proves these checks pass, not production safety or durability.

# Slide 8: 07 / DIFFERENTIATION

Test the cross-owner exchange.

The proposed value is compatible transfer with explicit rights.

EXISTING STACK
Controllers handle execution. Simulators test procedures. Fleet tools already capture operational knowledge.

EXBRIDGE THESIS
A context-gated exchange across independent owners may add value to those systems.

HOW TO EARN THE CLAIM
Test held-out scenarios and interview operators. Compare against existing fleet recovery workflows.

INFERRED: positioning and differentiation hypothesis. Source: vision.md, competitive risks.

Speaker notes: Do not claim retrieval is novel or that competitors lack this feature. Cross-owner rights and transfer quality are the questions that need evidence.

# Slide 9: 08 / VALIDATION

Prove usefulness
beyond the toy scenario.

Advance only when technical and commercial evidence support it.

NEXT TECHNICAL PROOF
Activate a real peaq machine identity and verify a permitted activity or settlement event.

NEXT TRANSFER PROOF
Use held-out tasks and multiple configurations. Measure correct transfers and rejected mismatches.

NEXT BUYER PROOF
Seek two independent operators and test whether avoided recovery work justifies integration and licensing costs.

INFERRED: proposed next work. Source: vision.md, Decision gates. No pilots or revenue claimed.

Speaker notes: Least confident decisions: 1. Independent operators will share lessons with usable rights. 2. Compatibility rules will generalize beyond the fixed simulator. 3. Licensed access will justify transaction and validation costs.

# Slide 10: 09 / BOUNTY FIT

A working prototype
for machine knowledge commerce.

Built for the peaq Machine Economy track.

TECHNICAL IMPLEMENTATION
Reproducible demo, typed API, deterministic gates and negative tests.

ECONOMIC FOCUS
A machine-linked insight becomes a proposed licensed service between owners.

HONEST SUBMISSION
Show the working demo first. Disclose simulated economics and the missing live peaq integration.

VERIFIED: bounty criteria fetched 13 October 2026. See speaker notes for listing URL.

Speaker notes: Source: https://superteam.fun/earn/listing/build-solutions-advancing-the-machine-economy-with-peaq . The listing welcomes early prototypes and judges technical work, impact, clarity and Machine Economy focus. It warns against decks replacing demos. It is restricted to Germany; confirm eligibility before submission.

# Slide 11: 10 / CLOSE

Help machines reuse
a recovery worth sharing.

exbridge proves one narrow transfer path today.

WATCH THE PROOF
npm run demo

WHAT WE WANT TO VALIDATE
Real machine attribution, permitted exchange and transfer beyond one constructed case.

VERIFIED: working local simulator. INFERRED: future exchange value.

Speaker notes: Close by running the demo, not by promising scale. Ask for ecosystem feedback on real machine attribution and a permitted operator pilot. No funding amount, customer traction or commercial savings are asserted.

Source: https://superteam.fun/earn/listing/build-solutions-advancing-the-machine-economy-with-peaq
