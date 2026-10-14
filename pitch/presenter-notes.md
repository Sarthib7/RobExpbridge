# exbridge: presenter notes

Use this script with the current 11-slide HTML deck. Read the Say paragraphs aloud. Use the cues as reminders.

These notes describe the deck's local simulator and proposed exchange. They do not claim physical robot performance or live peaq settlement.

## Slide 1: Shared experience. Better-informed robots.

Cue: Start with the exbridge name. Point to the robot schematic, then the prototype counts.

Say:

“exbridge helps a robot consult a relevant recovery lesson before it repeats a known failure.

The idea is simple. One machine records a recovery. Another machine checks whether that recovery fits its task and hardware.

Our prototype demonstrates this with three simulated arms. The focus is controlled experience transfer between independent owners.”

Transition: “The problem starts when a useful lesson stays inside one deployment.”

Evidence: VERIFIED: the current deck shows three simulated arms. Earlier session output from `npm test` reported `tests 15`, `pass 15`, `fail 0`. These are recorded prototype results, not a new test run.

## Slide 2: Recovery knowledge stays local.

Cue: Point left to Factory A, then across the gap to Factory B.

Say:

“In this scenario, Factory A has already found a recovery. Factory B starts without that lesson and encounters the simulated failure.

Our hypothesis is that independent operators may repeat similar recovery work.

Sharing a procedure alone is insufficient. The lesson must carry its hardware context, supporting evidence, and permission to use it.”

Transition: “exbridge checks those conditions before it returns advice.”

Evidence: VERIFIED: the factory diagrams depict the constructed scenario. INFERRED: repeated work across independent operators is a commercial hypothesis from `vision.md`. Customer demand is unvalidated.

## Slide 3: A lesson crosses only when it fits.

Cue: Follow the diagram from Arm A through the gate to Arms B and C.

Say:

“Arm A contributes a simulator-tested recovery.

Arm B queries before acting. exbridge checks the hardware, operating context, evidence, and permitted use. A compatible query receives an advisory.

Arm C has a different gripper. Its query is rejected.

The output is advice. The existing controller retains execution authority.”

Transition: “Here is the before-and-after result under the same constructed conditions.”

Evidence: VERIFIED: earlier `npm run demo` output returned `compatible` for Arm B and `incompatible` with `gripper mismatch` for Arm C. Source: `src/memory/match.ts` as inspected earlier in this session.

## Slide 4: Same scenario. Different decision.

Cue: Pause on the force values. Point to the negative control after explaining Arm B.

Say:

“Without memory, Arm B uses twelve newtons and slips.

With a compatible advisory, it uses eight newtons and succeeds.

Both runs use seed seven and fixture seven. We keep the scenario fixed so the comparison is reproducible.

Arm C receives no advisory because its gripper does not match.

This is one constructed simulation case. It demonstrates the mechanism, not general effectiveness or real-world safety.”

Transition: “That result matters only if the service also knows when to refuse a lesson.”

Evidence: VERIFIED: earlier demo output reported `baselineFailures: 1/1`, `recoverySuccesses: 1/1`, and `advisory: null` for Arm C. Seed seven identifies a fixed scenario; it is not a random sample.

## Slide 5: Check before recommending.

Cue: Move through the checks in order. Finish at the controller-authority label.

Say:

“The first check is integrity. Has the record changed relative to its saved digest?

The second check is evidence. Can the fixed simulator reproduce the recovery? Is the record current and unrevoked?

The third check is compatibility. Does the lesson fit the task, hardware, fixture, and force envelope?

Missing context requires review. A mismatch or invalid record prevents recommendation.

A digest detects changes. It does not authenticate the contributor.”

Transition: “With those boundaries, a permitted lesson could become a service another owner pays to access.”

Evidence: VERIFIED: the earlier inspected matcher checks integrity, replay, expiration, revocation, required context, and hardware compatibility. The current trust slide preserves the digest's authentication limit.

## Slide 6: A recovery lesson becomes a service.

Cue: Trace the lesson arrow to the consumer. Then trace the proposed payment arrow back.

Say:

“Factory A contributes a permitted recovery lesson. Factory B obtains a compatible advisory.

The proposed economic exchange is licensed access to that insight.

peaq's planned role is machine identity, attribution, and settlement between owners. Experience content stays offchain in the proposed design.

This deck represents the economics as simulated. It does not show a verified chain payment.”

Transition: “The recovery path is working locally. Here is what the prototype contains.”

Evidence: INFERRED: licensed exchange, offchain content, and peaq's role are proposed architecture. VERIFIED: the deck labels peaq `CURRENT: SIMULATED`; the earlier demo receipt had `transactionHash: null`.

## Slide 7: The core loop works today.

Cue: Point to the two entry points, then the core, then the test count.

Say:

“The prototype has a command-line demo and an HTTP API.

It validates records, persists them locally, matches queries, and returns typed advisories. It also checks integrity and replays the fixed simulator.

The recorded test run passed fifteen tests. Those checks include rejection paths and tampering.

For this deck, machine identities are synthetic and peaq economics are simulated. ROS and dstack are outside the demonstrated scope.”

Transition: “The product fits alongside existing robotics tools.”

Evidence: VERIFIED: the current implementation slide and earlier test output support these prototype claims. A passing suite proves the tested cases pass. It does not prove production readiness.

## Slide 8: Connect experience across owners.

Cue: Point to the shared layer, then the existing systems below it.

Say:

“Controllers already handle execution. Simulators test procedures. Fleet tools manage operations.

exbridge proposes a shared experience layer between independent owners, carrying context, evidence, and rights.

We are not claiming that retrieval itself is novel. The question is whether this exchange adds value alongside existing recovery workflows.”

Transition: “We need stronger evidence before expanding that claim.”

Evidence: INFERRED: positioning and incremental value are hypotheses from `vision.md`. The diagram depicts a proposed integration boundary, not completed integrations.

## Slide 9: Earn the next level of evidence.

Cue: Read the timeline left to right. Separate today's proof from planned work.

Say:

“Today, we have the local three-arm demonstration and compatibility rejection.

The next proof is real peaq machine attribution with a verified activity or settlement event.

Then we need held-out tasks and multiple configurations to test transfer beyond this fixed case.

Finally, we want two independent operators to test integration cost and practical value.

Those are planned validation steps. We are not claiming pilots or revenue.”

Transition: “That gives the bounty submission a working starting point and a clear economic direction.”

Evidence: VERIFIED: the deck distinguishes local proof from planned milestones. INFERRED: the validation sequence is a proposed roadmap. Least confident decisions: operator willingness to share, transfer across configurations, and paid value.

## Slide 10: Machine knowledge commerce.

Cue: Connect the proposed service to the working demo. Keep the integration gap explicit.

Say:

“exbridge proposes a service that machines could access: a permitted recovery insight that fits their operating context.

The prototype demonstrates the retrieval path and refusal conditions. A judge can replay that behavior.

The economic direction is clear, while real peaq attribution and settlement remain planned in this deck.”

Transition: “I will close with the exact proof we can reproduce today.”

Evidence: VERIFIED: the bounty listing reviewed earlier asks for a working demo or compelling prototype and Machine Economy relevance. INFERRED: the proposed service's future impact remains untested.

## Slide 11: One recovery. A controlled transfer.

Cue: Pause before the closing sentence. If time permits, switch to the prepared terminal.

Say:

“exbridge demonstrates one controlled transfer: a compatible arm receives a recovery advisory, and an incompatible arm is refused.

The next step is to connect real machine attribution and test transfer beyond one fixed scenario.

Our prototype is reproducible with `npm run demo`. That is the proof we have today.”

Close: Stop speaking. Leave the slide visible for questions.

Evidence: VERIFIED: earlier demo output supports the constructed transfer and rejection. INFERRED: future attribution and broader transfer are next-step goals.

## Live demo flow

1. Before presenting, open a terminal in the project folder and run `npm run demo` once.
2. At slide 4 or slide 11, run the command again. Show Arm B's baseline `slip` and recovery `success`.
3. Show Arm C's `gripper mismatch` and `advisory: null`. Then show `tamperingDetected: true`.
4. Point to the explicitly simulated receipt. Return to the deck and repeat that the outcomes are constructed.

If the command fails during the presentation, state the failure. Continue with the labeled slide results; do not present them as a fresh run.

## Questions to prepare for

Does this prove physical robots will perform better?

“No. It proves one deterministic transfer path and compatibility rejection. Broader simulator benchmarks and operator testing are still needed.”

Why use peaq?

“The proposed exchange needs machine-linked attribution and licensed settlement between owners. Those are peaq's intended roles in this design.”

Is the payment real?

“The deck's receipt is simulated. I would only present a real payment with a verified transaction and supporting evidence.”

What stops a fabricated lesson?

“The prototype checks integrity and reproduces the fixed recovery. It does not authenticate contributors. Stronger provenance remains necessary.”

Who pays, and how much?

“The buyer hypothesis is an operator or integrator who saves repeated recovery work. Pricing and willingness to pay remain untested.”

## Before you present

Open the current HTML deck and this file side by side. Rehearse slides 3 through 6 first: transfer, result, refusal, and proposed exchange.

Use the public pitch URL only after HTTPS works. Keep the local HTML ready as a fallback.

Source deck: `pitch/ExperienceBridge-pitch.html`.

Source bounty: <https://superteam.fun/earn/listing/build-solutions-advancing-the-machine-economy-with-peaq>.
