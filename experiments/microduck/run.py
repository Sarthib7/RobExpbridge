"""Simulation-only Microduck experiments. No cloud submission or hardware execution."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import os
from pathlib import Path
import subprocess
import sys
import time

from memory import (
    ExperimentError, FAMILIES, SOURCE_REVISION, canonical, file_digest, freeze_lessons,
    integer, load_json, object_keys, publish_lesson, scenario_ids, seal, timestamp, finite_number,
    validate_context, validate_lesson, validate_snapshot, verify_seal, write_once,
)


def source_setup(source: Path) -> Path:
    from sim import verify_source
    if not source.exists():
        source.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "init", str(source)], check=True, timeout=30)
        subprocess.run(["git", "-C", str(source), "remote", "add", "origin",
                        "https://github.com/pollen-robotics/microduck_rl.git"], check=True, timeout=30)
        subprocess.run(["git", "-C", str(source), "fetch", "--depth", "1", "origin", SOURCE_REVISION],
                       check=True, timeout=240)
        subprocess.run(["git", "-C", str(source), "checkout", "--detach", "FETCH_HEAD"],
                       check=True, timeout=60)
    return verify_source(source)


def make_cases(source: Path, per_family: int, seed: int, split: str) -> dict:
    from sim import context, scenario
    integer(per_family, "EPISODES_PER_FAMILY", 1)
    integer(seed, "SEED")
    return seal({"schemaVersion": 1, "context": context(source),
                 "cases": [scenario(family, seed + index, split)
                           for family in FAMILIES for index in range(per_family)]})


def validate_cases(value: dict, expected_context: dict, split: str | None = None) -> dict:
    from sim import validate_scenario
    cases = verify_seal(value)
    object_keys(cases, {"schemaVersion", "context", "cases", "sha256"}, "CASES")
    if type(cases["schemaVersion"]) is not int or cases["schemaVersion"] != 1:
        raise ExperimentError("INVALID_CASES_VERSION")
    validate_context(cases["context"])
    if cases["context"] != expected_context:
        raise ExperimentError("INCOMPATIBLE_CASES")
    if type(cases["cases"]) is not list or not cases["cases"]:
        raise ExperimentError("MISSING_CASES")
    families = set()
    for case in cases["cases"]:
        validate_scenario(case)
        if split is not None and case["split"] != split:
            raise ExperimentError("WRONG_SCENARIO_PARTITION")
        families.add(case["family"])
    scenario_ids([case["id"] for case in cases["cases"]])
    if families != set(FAMILIES):
        raise ExperimentError("MISSING_SCENARIO_FAMILY")
    return cases


def evaluate(source: Path, artifact_folder: Path, cases: dict, split: str) -> dict:
    from sim import EpisodeSimulator, context
    from train import validate_artifact
    ctx = context(source)
    validate_cases(cases, ctx, split)
    artifact = validate_artifact(artifact_folder, ctx)
    simulator = EpisodeSimulator(source, artifact_folder / artifact["policyFile"])
    rows = []
    started = time.perf_counter()
    for case in cases["cases"]:
        row = simulator.episode(case)
        row.pop("context")
        rows.append(row)
    return seal({"schemaVersion": 1, "kind": "policy-evaluation", "complete": True,
                 "context": ctx, "artifactSha256": artifact["sha256"],
                 "policySha256": artifact["policySha256"], "casesSha256": cases["sha256"],
                 "split": split, "episodes": rows, "wallSeconds": time.perf_counter() - started})


def validate_evaluation(value: dict, cases: dict, artifact: dict) -> dict:
    from sim import HORIZON, CONTROL_HZ, recovered
    report = verify_seal(value)
    object_keys(report, {"schemaVersion", "kind", "complete", "context", "artifactSha256",
        "policySha256", "casesSha256", "split", "episodes", "wallSeconds", "sha256"}, "EVALUATION")
    if type(report["schemaVersion"]) is not int or report["schemaVersion"] != 1:
        raise ExperimentError("INVALID_EVALUATION_VERSION")
    finite_number(report["wallSeconds"], "EVALUATION_TIME")
    if any(row["split"] != report["split"] for row in cases["cases"]):
        raise ExperimentError("WRONG_SCENARIO_PARTITION")
    if (report.get("kind") != "policy-evaluation" or report.get("complete") is not True
            or report.get("context") != artifact["context"]
            or report.get("artifactSha256") != artifact["sha256"]
            or report.get("policySha256") != artifact["policySha256"]
            or report.get("casesSha256") != cases["sha256"]):
        raise ExperimentError("EVALUATION_IDENTITY_MISMATCH")
    rows = report.get("episodes")
    if type(rows) is not list or len(rows) != len(cases["cases"]):
        raise ExperimentError("INCOMPLETE_EVALUATION")
    for row, case in zip(rows, cases["cases"]):
        object_keys(row, {"scenario", "initialState", "policyKind", "policySha256", "controlSteps",
                         "simulatedSeconds", "wallSeconds", "recovered", "outcome", "samples"}, "EPISODE")
        integer(row["controlSteps"], "CONTROL_STEPS")
        finite_number(row["simulatedSeconds"], "SIMULATION_TIME")
        finite_number(row["wallSeconds"], "EVALUATION_TIME")
        state = object_keys(row["initialState"], {"qpos", "qvel"}, "INITIAL_STATE")
        if (type(state["qpos"]) is not list or type(state["qvel"]) is not list
                or len(state["qpos"]) < 21 or len(state["qvel"]) != len(state["qpos"]) - 1):
            raise ExperimentError("INVALID_INITIAL_STATE")
        for value in state["qpos"] + state["qvel"]:
            finite_number(value, "INITIAL_STATE", minimum=-1e6)
        if (row.get("scenario") != case or row.get("policyKind") != "onnx"
                or row.get("policySha256") != artifact["policySha256"]):
            raise ExperimentError("EVALUATION_IDENTITY_MISMATCH")
        if (row.get("controlSteps") != int(HORIZON * CONTROL_HZ)
                or abs(row.get("simulatedSeconds", 0) - HORIZON) > 1e-8):
            raise ExperimentError("INCOMPLETE_EVALUATION")
        outcome = recovered(row["samples"])
        if (type(row.get("recovered")) is not bool or row["recovered"] != outcome
                or row["outcome"] != ("recovered" if outcome else "not-recovered")):
            raise ExperimentError("EVALUATION_OUTCOME_MISMATCH")
    return report


def lesson_from_evaluation(report: dict, cases: dict, artifact: dict,
                           donor_id: str, expires_at: str) -> dict:
    validate_cases(cases, artifact["context"], "train")
    validate_evaluation(report, cases, artifact)
    if artifact["priorTrainingSteps"] + artifact["trainingSteps"] <= 0:
        raise ExperimentError("TRAINED_DONOR_REQUIRED: initialization is not learning evidence")
    counts = {family: {"attempted": 0, "failed": 0} for family in FAMILIES}
    for row in report["episodes"]:
        family = row["scenario"]["family"]
        counts[family]["attempted"] += 1
        counts[family]["failed"] += int(not row["recovered"])
    record = seal({"schemaVersion": 1, "donorId": donor_id,
        "policySha256": artifact["policySha256"], "context": artifact["context"],
        "evidenceLevel": "simulation-observed",
        "createdAt": datetime.now(timezone.utc).isoformat(), "expiresAt": expires_at,
        "rights": {"use": "local-noncommercial-simulation", "redistribution": False},
        "counts": counts, "scenarioIds": [row["id"] for row in cases["cases"]],
        "donorCost": {"trainingSteps": artifact["priorTrainingSteps"] + artifact["trainingSteps"],
                      "trainingSeconds": artifact["priorTrainingSeconds"] + artifact["trainingSeconds"],
                      "evaluationSteps": sum(row["controlSteps"] for row in report["episodes"]),
                      "evaluationSeconds": report["wallSeconds"]}})
    return validate_lesson(record)


def train_child(source: Path, output: Path, seed: int, num_envs: int, iterations: int,
                timeout: int, start: Path | None = None, snapshot: Path | None = None,
                alpha: float = 0.0) -> dict:
    from train import validate_artifact
    command = [sys.executable, str(Path(__file__).with_name("train.py")),
               "--source", str(source), "--output", str(output), "--seed", str(seed),
               "--num-envs", str(num_envs), "--iterations", str(iterations)]
    if start:
        command.extend(["--start", str(start)])
    if snapshot:
        command.extend(["--snapshot", str(snapshot), "--alpha", str(alpha)])
    subprocess.run(command, check=True, timeout=timeout,
                   env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"})
    return validate_artifact(output)


def paired_summary(baseline: dict, memory: dict, cases: dict,
                   baseline_artifact: dict, memory_artifact: dict) -> dict:
    validate_evaluation(baseline, cases, baseline_artifact)
    validate_evaluation(memory, cases, memory_artifact)
    if (baseline_artifact["startCheckpointSha256"] != memory_artifact["startCheckpointSha256"]
            or baseline_artifact["startCheckpointSha256"] is None
            or baseline_artifact["seed"] != memory_artifact["seed"]
            or baseline_artifact["numEnvs"] != memory_artifact["numEnvs"]
            or baseline_artifact["trainingSteps"] != memory_artifact["trainingSteps"]
            or baseline_artifact["device"] != memory_artifact["device"]):
        raise ExperimentError("UNMATCHED_TRAINING_PAIR")
    result = {}
    for family in FAMILIES:
        a = [row for row in baseline["episodes"] if row["scenario"]["family"] == family]
        b = [row for row in memory["episodes"] if row["scenario"]["family"] == family]
        result[family] = {"attempts": len(a), "baselineSuccesses": sum(row["recovered"] for row in a),
                          "memorySuccesses": sum(row["recovered"] for row in b)}
    a_success = sum(row["recovered"] for row in baseline["episodes"]
                    if row["scenario"]["family"] != "standing")
    b_success = sum(row["recovered"] for row in memory["episodes"]
                    if row["scenario"]["family"] != "standing")
    return {"seed": baseline_artifact["seed"], "perFamily": result,
            "recoveryResult": "better" if b_success > a_success else "worse" if b_success < a_success else "same",
            "newInteractionsPerArm": baseline_artifact["trainingSteps"],
            "baselineTrainingSeconds": baseline_artifact["trainingSeconds"],
            "memoryTrainingSeconds": memory_artifact["trainingSeconds"],
            "baselineEvaluationSeconds": baseline["wallSeconds"],
            "memoryEvaluationSeconds": memory["wallSeconds"]}


def compare(source: Path, output: Path, snapshot_file: Path, cases_file: Path,
            seeds: list[int], iterations: int, num_envs: int, alpha: float, timeout: int) -> dict:
    from sim import context
    from train import cuda_device
    started = time.perf_counter()
    if len(seeds) < 2 or len(set(seeds)) != len(seeds):
        raise ExperimentError("REPEATED_PAIRED_SEEDS_REQUIRED")
    for seed in seeds:
        integer(seed, "SEED")
    integer(iterations, "ITERATIONS", 1)
    integer(num_envs, "ENVIRONMENTS", 1)
    integer(timeout, "WORKER_TIMEOUT", 1)
    ctx = context(source)
    frozen = validate_snapshot(load_json(snapshot_file))
    cases = validate_cases(load_json(cases_file), ctx, "evaluation")
    if (frozen["context"] != ctx or frozen["evaluationScenarioIds"] != [row["id"] for row in cases["cases"]]):
        raise ExperimentError("INCOMPATIBLE_FROZEN_PROTOCOL")
    mix_probabilities_for_protocol(frozen, alpha)
    cuda_device()
    preflight_seconds = time.perf_counter() - started
    # An existing directory is never resumed or overwritten automatically.
    output.mkdir(parents=True, exist_ok=False)
    protocol = seal({"schemaVersion": 1, "state": "started", "context": ctx,
        "snapshotSha256": frozen["sha256"], "casesSha256": cases["sha256"],
        "seeds": seeds, "iterations": iterations, "numEnvs": num_envs, "alpha": alpha})
    write_once(output / "started.json", protocol)
    write_once(output / "snapshot.json", frozen)
    write_once(output / "cases.json", cases)
    summaries, outputs = [], []
    try:
        for index, seed in enumerate(seeds):
            root = output / f"pair-{index}"
            initial = root / "initial"
            init_artifact = train_child(source, initial, seed, num_envs, 0, timeout)
            arms = {}
            order = ("baseline", "memory") if index % 2 == 0 else ("memory", "baseline")
            for arm in order:
                folder = root / arm
                artifact = train_child(source, folder, seed, num_envs, iterations, timeout,
                    start=initial, snapshot=output / "snapshot.json" if arm == "memory" else None,
                    alpha=alpha if arm == "memory" else 0)
                if artifact["startCheckpointSha256"] != init_artifact["checkpointSha256"]:
                    raise ExperimentError("START_CHECKPOINT_MISMATCH")
                evaluation = evaluate(source, folder, cases, "evaluation")
                write_once(folder / "evaluation.json", evaluation)
                arms[arm] = (artifact, evaluation)
            a, b = arms["baseline"], arms["memory"]
            summary = paired_summary(a[1], b[1], cases, a[0], b[0])
            summary["executionOrder"] = list(order)
            summary["initializationSeconds"] = init_artifact["trainingSeconds"]
            summaries.append(summary)
            outputs.append({arm: {"artifact": values[0]["sha256"], "evaluation": values[1]["sha256"]}
                            for arm, values in arms.items()})
        donor_policies = {}
        donor_evaluation_steps = 0
        donor_evaluation_seconds = 0.0
        for record in frozen["lessons"]:
            key, cost = record["policySha256"], record["donorCost"]
            training_cost = {"steps": cost["trainingSteps"], "seconds": cost["trainingSeconds"]}
            if key in donor_policies and donor_policies[key] != training_cost:
                raise ExperimentError("DONOR_COST_CONFLICT")
            donor_policies[key] = training_cost
            donor_evaluation_steps += cost["evaluationSteps"]
            donor_evaluation_seconds += cost["evaluationSeconds"]
        donor_training_seconds = sum(row["seconds"] for row in donor_policies.values())
        measured_wall_seconds = time.perf_counter() - started
        report = seal({"schemaVersion": 1, "kind": "matched-microduck-experiment", "complete": True,
            "protocolSha256": protocol["sha256"], "context": ctx,
            "snapshotSha256": frozen["sha256"], "casesSha256": cases["sha256"],
            "pairs": summaries, "outputs": outputs,
            "donorTrainingSteps": sum(row["steps"] for row in donor_policies.values()),
            "donorTrainingSeconds": sum(row["seconds"] for row in donor_policies.values()),
            "donorEvaluationSteps": donor_evaluation_steps, "donorEvaluationSeconds": donor_evaluation_seconds,
            "preflightSeconds": preflight_seconds, "measuredWallSeconds": measured_wall_seconds,
            "includingDonorSeconds": measured_wall_seconds + donor_training_seconds + donor_evaluation_seconds,
            "timingScope": "comparison wall time includes preflight, worker initialization, learning, export and evaluation; donor time counted separately",
            "physicalRobotExecution": False, "performanceClaim": "paired observations only; no automatic policy promotion"})
        write_once(output / "report.json", report)
        return report
    except BaseException as error:
        write_once(output / "failure.json", {"state": "failed", "errorType": type(error).__name__})
        raise


def mix_probabilities_for_protocol(snapshot: dict, alpha: float):
    from memory import mix_probabilities
    return mix_probabilities([0.25] * 4, snapshot["counts"], alpha)


def read_completed_run(folder: Path) -> dict:
    from train import validate_artifact
    protocol = verify_seal(load_json(folder / "started.json"))
    report = verify_seal(load_json(folder / "report.json"))
    if report.get("kind") != "matched-microduck-experiment" or report.get("complete") is not True:
        raise ExperimentError("INCOMPLETE_RUN")
    if report.get("protocolSha256") != protocol["sha256"]:
        raise ExperimentError("RUN_PROTOCOL_MISMATCH")
    cases = verify_seal(load_json(folder / "cases.json"))
    snapshot = verify_seal(load_json(folder / "snapshot.json"))
    if cases["sha256"] != protocol["casesSha256"] or snapshot["sha256"] != protocol["snapshotSha256"]:
        raise ExperimentError("RUN_PROTOCOL_MISMATCH")
    pairs = []
    outputs = []
    for index, _seed in enumerate(protocol["seeds"]):
        arms = {}
        for arm in ("baseline", "memory"):
            root = folder / f"pair-{index}" / arm
            artifact = validate_artifact(root, protocol["context"])
            evaluation = load_json(root / "evaluation.json")
            arms[arm] = (artifact, evaluation)
        a, b = arms["baseline"], arms["memory"]
        summary = paired_summary(a[1], b[1], cases, a[0], b[0])
        summary["executionOrder"] = ["baseline", "memory"] if index % 2 == 0 else ["memory", "baseline"]
        summary["initializationSeconds"] = validate_artifact(folder / f"pair-{index}" / "initial")["trainingSeconds"]
        pairs.append(summary)
        outputs.append({arm: {"artifact": value[0]["sha256"], "evaluation": value[1]["sha256"]}
                        for arm, value in arms.items()})
    if pairs != report.get("pairs") or outputs != report.get("outputs"):
        raise ExperimentError("RUN_RESULT_MISMATCH")
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    setup = commands.add_parser("setup", help="fetch only the pinned simulator source; installs no policies")
    setup.add_argument("--source", type=Path, required=True)
    for name in ("cases", "smoke", "evaluate", "donor", "snapshot", "compare"):
        command = commands.add_parser(name)
        command.add_argument("--source", type=Path, required=True)
        command.add_argument("--output", type=Path, required=True)
        if name == "cases":
            command.add_argument("--per-family", type=int, required=True)
            command.add_argument("--seed", type=int, required=True)
            command.add_argument("--split", choices=("train", "evaluation"), required=True)
        if name in ("evaluate", "donor", "snapshot", "compare"):
            command.add_argument("--cases", type=Path, required=True)
        if name in ("evaluate", "donor"):
            command.add_argument("--artifact", type=Path, required=True)
        if name == "donor":
            command.add_argument("--donor-id", required=True)
            command.add_argument("--expires-at", required=True)
            command.add_argument("--lessons", type=Path, required=True)
        if name == "snapshot":
            command.add_argument("--lessons", type=Path, nargs="+", required=True)
        if name == "compare":
            command.add_argument("--snapshot", type=Path, required=True)
            command.add_argument("--seeds", type=int, nargs="+", required=True)
            command.add_argument("--iterations", type=int, required=True)
            command.add_argument("--num-envs", type=int, required=True)
            command.add_argument("--alpha", type=float, required=True)
            command.add_argument("--worker-timeout-seconds", type=int, required=True)
        if name == "smoke":
            command.add_argument("--render", action="store_true")
    report = commands.add_parser("report", help="verify a completed run without restarting any process")
    report.add_argument("--run", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command == "setup":
            print(canonical({"source": str(source_setup(args.source.resolve())), "revision": SOURCE_REVISION}).decode())
            return
        if args.command == "report":
            print(canonical(read_completed_run(args.run.resolve())).decode())
            return
        source, output = args.source.resolve(), args.output.resolve()
        if args.command == "cases":
            write_once(output, make_cases(source, args.per_family, args.seed, args.split))
        elif args.command == "smoke":
            from sim import EpisodeSimulator, scenario
            output.mkdir(parents=True, exist_ok=False)
            simulator = EpisodeSimulator(source, smoke=True)
            rows = []
            for index, family in enumerate(FAMILIES):
                result = simulator.episode(scenario(family, index, "evaluation"))
                result.pop("context")
                rows.append(result)
                if args.render:
                    simulator.render_png(output / (family + ".png"))
            write_once(output / "report.json", seal({"kind": "physics-smoke", "complete": True,
                "context": simulator.context, "episodes": rows, "learningMeasured": False,
                "note": "Hold-home action probe. No trained policy, learning gain, or hardware result."}))
        elif args.command in ("evaluate", "donor"):
            from train import validate_artifact
            artifact = validate_artifact(args.artifact.resolve())
            split = "train" if args.command == "donor" else "evaluation"
            cases = validate_cases(load_json(args.cases), artifact["context"], split)
            if args.command == "donor":
                if timestamp(args.expires_at) <= datetime.now(timezone.utc):
                    raise ExperimentError("INVALID_TIME: expiry must be in the future")
                if artifact["priorTrainingSteps"] + artifact["trainingSteps"] <= 0:
                    raise ExperimentError("TRAINED_DONOR_REQUIRED")
            measured = evaluate(source, args.artifact.resolve(), cases, split)
            write_once(output, measured)
            if args.command == "donor":
                lesson = lesson_from_evaluation(measured, cases, artifact, args.donor_id, args.expires_at)
                path = publish_lesson(args.lessons.resolve(), lesson)
                print(canonical({"lesson": str(path), "sha256": lesson["sha256"]}).decode())
        elif args.command == "snapshot":
            from sim import context
            ctx = context(source)
            cases = validate_cases(load_json(args.cases), ctx, "evaluation")
            records = [load_json(path) for path in args.lessons]
            write_once(output, freeze_lessons(records, ctx, [row["id"] for row in cases["cases"]]))
        elif args.command == "compare":
            compare(source, output, args.snapshot.resolve(), args.cases.resolve(), args.seeds,
                    args.iterations, args.num_envs, args.alpha, args.worker_timeout_seconds)
        print(canonical({"command": args.command, "output": str(output), "complete": True}).decode())
    except (ExperimentError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"{type(error).__name__}: {error}\n")


if __name__ == "__main__":
    main()
