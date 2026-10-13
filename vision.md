# ExperienceBridge — Long-Term Product Vision

**v0.1 · 12 October 2026 · Research thesis, not validated business**

## Executive summary
**ExperienceBridge is an evidence-backed, rights-controlled exchange for operational robot experiences.** An authorized robot can consult a relevant lesson before acting, assess whether it transfers to its hardware and environment, and avoid repeating an already observed failure. Contributors can license useful insights across organizations without automatically disclosing all raw factory telemetry.

**Positioning:** a shared experience layer for physical AI, **not** a new robotics operating system, robot controller, mapping service, training platform, fleet manager, or blockchain.

## Why now / problem
Robots already log failures, undergo retraining, share information within fleets, and use simulations. The proposed gap is narrower: transferring a *specific, evidenced, compatible* operational lesson between independent organizations under explicit rights and privacy constraints. Repeated commissioning, debugging and recovery work could create economic value, but willingness to pay for individual insights is **not verified**.

## What already exists (do not duplicate)
- **ROS 2 and vendor controllers:** hardware interfaces and real-time control.
- **Open-RMF and fleet managers:** cross-fleet traffic and building-resource coordination.
- **NVIDIA Isaac and OEM simulators:** training, simulation and validation.
- **RoboMemory, PragmaBot, RT-Cache and recovery research:** episodic retrieval and pre-action experience reuse; retrieval itself is not novel.
- **RAVN, selfpatch.ai and fleet learning products:** commercial recovery knowledge and shared diagnostics; strong competitive overlap.
- **peaqOS/peaq:** machine identity, activity and commerce.
- **dstack/Phala:** confidential compute, workload-bound keys and attestation.

**Claim we can test, not assume:** an interoperable, cross-owner exchange of compatible lessons with explicit rights and evidence provides incremental value over existing products. Research and marketing pages alone do not prove that this gap is commercially open.

## Vision: five capabilities, one common experience primitive
1. **Recall (Recovery):** retrieve a prior failure/recovery advisory before executing.
2. **World changes (WorldPatch):** record time-limited environment exceptions without replacing SLAM or maps.
3. **Feasibility (MissionCheck):** compare task/site requirements to machine capabilities.
4. **Evidence (SkillProof):** evaluate a proposed lesson in simulation and label the strength of evidence.
5. **Fleet learning (FleetMemory):** share permitted insights across fleets, with versioning, revocation and provenance.

These are roadmap modules, **not** five MVP features. The first wedge is a connector-insertion recovery experience.

## Product workflow
```text
Robot A logs event
  -> operator selects permitted evidence
  -> typed experience + context + provenance
  -> simulator / reviewer assigns evidence level
  -> offchain controlled store and search index
  -> Robot B queries before action
  -> compatibility, rights and evidence checks
  -> licensed advisory + limitations
  -> existing robot controller decides whether to act
  -> outcome feedback may update or revoke lesson
```

**Experience record:** task, robot/effector configuration, operating envelope, environment, observed failure, proposed advisory, evidence/test artifacts, provenance, permitted uses, expiration, revocation and content digest. No default publication of raw images, maps, proprietary recipes or private factory parameters.

## Architecture and trust
- **Robot edge:** ROS 2/MCAP/vendor-log adapters and pre-task query client. Never enter safety-critical motor control loop.
- **Memory service:** typed schema, versioned offchain storage, context-aware retrieval, hard compatibility gates and evidence labels.
- **Evidence pipeline:** deterministic tests, simulation artifacts, independent reviewer/owner approvals where appropriate. A TEE does not make sensor readings truthful.
- **Privacy:** data minimization, permissions, access control, optional dstack confidential matching; clients must verify actual attestation and bind it to the expected workload before releasing sensitive inputs.
- **Economic layer:** peaq machine identity, contributor attribution, access/license transactions, audit receipts. No raw proprietary telemetry onchain.
- **Safety:** advisories only; controllers, operators and established safety systems retain authority. No automatic installation of untrusted control code.

## The commercial hypothesis
**Buyer:** fleet operator, systems integrator, robotics-as-a-service vendor or robot skill provider. **Seller:** operator with rights to a validated experience. **Potential value:** reduced repeated failures, fewer technician visits, shorter commissioning, fewer rejected jobs.

**Pricing experiments:** per validated insight, per compatibility check, fleet subscription, or revenue share with contributors. No asserted market size, savings percentage or willingness-to-pay figure without data.

**Economic test:** compare the avoided engineering/downtime cost against retrieval, integration, validation, legal and licensing costs. Cross-company rights may be the limiting factor, not technical retrieval.

## Competitive moat, if earned
- High-quality contextual outcome data, with documented provenance and permitted uses.
- Compatibility evaluation calibrated across robot models and environments.
- A history of actual downstream usefulness, including failed transfers and revocations.
- Distribution through existing robotics and peaqOS integrations.

A generic vector database, token, SDK wrapper or static catalog is **not** a moat. There may be no sustainable moat if OEMs and fleet vendors expose the same functions.

## Red team / failure modes
| Objection | Consequence | Mitigation / falsification |
|---|---|---|
| Vendors already do fleet memory | Duplicated product | Interview buyers; test across independent fleets, not within one vendor |
| Experiences do not transfer | Unsafe/irrelevant advice | Hard context gates; controlled experiments on multiple robot configurations |
| Factories won't share | No supply | Rights-preserving derived insights; explicit consent; do not assume TEE solves licensing |
| Evidence can be fabricated | Poisoned lessons | Provenance, multi-source checks, review, anomaly detection; disclose remaining oracle problem |
| Onchain fees exceed value | Bad unit economics | Batch settlement and offchain storage; prove willingness to pay |
| Knowledge becomes stale | Wrong recommendations | Version, expiry, revocation and feedback |
| Privacy claims overstated | Security failure | Independent TEE verification, key management and data minimization |
| Operators distrust recommendations | No adoption | Advisory-only, explainable matching and approvals |
| Small toy demo looks like proof | Misleading pitch | Separate constructed outcomes from real-world measured performance |

## Phased roadmap
**Phase 0 — 2-hour MVP:** deterministic three-arm simulation, experience ingestion/retrieval, rejection test, measured before/after result, optional real peaq testnet transaction.

**Phase 1 — 2–4 weeks:** ROS 2/MCAP ingestion, replayable simulation benchmarks, provenance, expiry and human review. Test on open robot logs with rights verified.

**Phase 2 — 1–3 months:** two independent operator pilots, hardware/context compatibility, measured transfer precision, privacy controls, real machine identities and paid access experiment.

**Phase 3 — 3–9 months:** verified dstack confidential matching, licensing workflows, multi-robot task families, independent evaluation and reputation based on observed usefulness.

**Phase 4 — long term:** federated experience exchange across operators and robot types, with optional WorldPatch/MissionCheck/SkillProof modules. Expand only where pilots justify it.

## Decision gates
1. **Technical:** memory improves performance beyond an artificial one-case simulator on held-out tasks; incompatible matches are rejected.
2. **Operational:** at least two independent robot operators can contribute/use lessons without unsafe changes or unacceptable integration costs.
3. **Commercial:** at least one prospective buyer offers a paid pilot or documented purchasing intent tied to measurable value.
4. **Legal/privacy:** contributor has rights to license the derived experience and any source evidence; appropriate data protection controls exist.
5. **Ecosystem:** confirm peaqOS or competitor doesn't already offer an equivalent cross-organization workflow.

If these gates fail, narrow to an internal recovery QA tool or stop; do not manufacture blockchain demand.

## Bounty pitch
> Robots already learn from experience, but valuable lessons often remain inside individual deployments. ExperienceBridge proposes a controlled way for one machine's evidenced operational lesson to help another machine before it repeats the same failure. Our MVP proves contextual retrieval and compatibility rejection in a deterministic simulation. peaq supports machine-linked attribution and licensed exchange; confidential matching through dstack is a later, separately verified capability.

## Research starting points (verify claims before external publication)
- Bounty: https://superteam.fun/earn/listing/build-solutions-advancing-the-machine-economy-with-peaq
- Open-RMF: https://www.open-rmf.org/
- peaq SDK: https://github.com/peaqnetwork/peaq-sdk-js
- dstack: https://github.com/Dstack-TEE/dstack
- REBOOT benchmark: https://nanayawoa.github.io/REBOOT/
- PragmaBot: https://github.com/leggedrobotics/pragmabot
- RT-Cache: https://rt-cache.github.io/
- RoboMemory paper: https://arxiv.org/abs/2508.01415

**Research integrity:** these references establish adjacent work, not the absence of competitors or verified demand. Recheck current capabilities and licensing before implementing integrations or submitting market claims.
