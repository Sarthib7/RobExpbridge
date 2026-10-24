"""Explicit local CUDA worker. Uses upstream PPO; never submits cloud jobs."""
from __future__ import annotations

import argparse
import importlib.metadata
import os
import random
import sys
import time
from dataclasses import asdict
from pathlib import Path

from memory import (
    ExperimentError, FAMILIES, TASK, canonical, file_digest, finite_number,
    hash_string, integer, load_json, seal, validate_context, validate_snapshot,
    verify_seal, write_once, mix_probabilities, object_keys, text,
)


def cuda_device():
    try:
        import torch
    except ImportError as error:
        raise ExperimentError("CUDA_TRAINING_UNAVAILABLE: install the training extra on an NVIDIA worker") from error
    if not torch.cuda.is_available():
        raise ExperimentError("CUDA_TRAINING_UNAVAILABLE: no usable NVIDIA CUDA device")
    if torch.__version__.split("+")[0] != "2.9.1":
        raise ExperimentError("TRAINING_VERSION_MISMATCH: torch 2.9.1 required")
    return torch


def validate_artifact(folder: Path, expected_context: dict | None = None) -> dict:
    """Only use checkpoints produced locally by this experiment, never remote pickle files."""
    artifact = verify_seal(load_json(folder / "artifact.json"))
    object_keys(artifact, {"schemaVersion", "kind", "complete", "context", "seed", "numEnvs",
        "iterations", "startIteration", "trainingSteps", "trainingSeconds", "priorTrainingSteps",
        "priorTrainingSeconds", "startCheckpointSha256", "snapshotSha256", "alpha", "resumeMode",
        "device", "checkpointFile", "checkpointSha256", "policyFile", "policySha256", "sha256"}, "ARTIFACT")
    if type(artifact["schemaVersion"]) is not int or artifact["schemaVersion"] != 1:
        raise ExperimentError("INVALID_ARTIFACT_VERSION")
    if artifact.get("kind") != "microduck-training-artifact" or artifact.get("complete") is not True:
        raise ExperimentError("INCOMPLETE_TRAINING_ARTIFACT")
    validate_context(artifact.get("context"))
    if expected_context is not None and artifact["context"] != expected_context:
        raise ExperimentError("INCOMPATIBLE_TRAINING_ARTIFACT")
    for field, hash_field in (("checkpointFile", "checkpointSha256"), ("policyFile", "policySha256")):
        name = artifact.get(field)
        if type(name) is not str or Path(name).name != name:
            raise ExperimentError("INVALID_TRAINING_PATH")
        path = folder / name
        if path.is_symlink() or not path.is_file() or file_digest(path) != hash_string(artifact.get(hash_field), hash_field):
            raise ExperimentError("TRAINING_ARTIFACT_INTEGRITY")
    integer(artifact.get("seed"), "SEED")
    integer(artifact.get("numEnvs"), "ENVIRONMENTS", 1)
    integer(artifact.get("trainingSteps"), "TRAINING_STEPS")
    finite_number(artifact.get("trainingSeconds"), "TRAINING_SECONDS")
    iterations = integer(artifact["iterations"], "ITERATIONS")
    integer(artifact["startIteration"], "ITERATION")
    integer(artifact["priorTrainingSteps"], "PRIOR_STEPS")
    finite_number(artifact["priorTrainingSeconds"], "PRIOR_SECONDS")
    if artifact["trainingSteps"] != iterations * 24 * artifact["numEnvs"]:
        raise ExperimentError("TRAINING_BUDGET_MISMATCH")
    for key in ("startCheckpointSha256", "snapshotSha256"):
        if artifact[key] is not None:
            hash_string(artifact[key], key)
    finite_number(artifact["alpha"], "ALPHA")
    if (artifact["alpha"] >= 1 or artifact["resumeMode"] != "resume"
            or (artifact["snapshotSha256"] is None and artifact["alpha"] != 0)):
        raise ExperimentError("INVALID_TRAINING_CONFIG")
    text(artifact["device"], "DEVICE")
    return artifact


def shared_failure_curriculum(env, env_ids, event_name, param_stages, counts, alpha):
    from mjlab_microduck.tasks.mdp import event_param_curriculum
    result = event_param_curriculum(env, env_ids, event_name, param_stages)
    event = env.event_manager.get_term_cfg(event_name)
    base = [event.params[family + "_prob"] for family in FAMILIES]
    mixed, _ = mix_probabilities(base, counts, alpha)
    event.params.update({family + "_prob": value for family, value in zip(FAMILIES, mixed)})
    return result


def rng_state(torch):
    import numpy as np
    return {"python": random.getstate(), "numpy": np.random.get_state(),
            "torch": torch.get_rng_state(), "cuda": torch.cuda.get_rng_state_all()}


def restore_rng(torch, value):
    import numpy as np
    if not isinstance(value, dict) or set(value) != {"python", "numpy", "torch", "cuda"}:
        raise ExperimentError("CHECKPOINT_RNG_MISSING")
    random.setstate(value["python"])
    np.random.set_state(value["numpy"])
    torch.set_rng_state(value["torch"].cpu())
    torch.cuda.set_rng_state_all([state.cpu() for state in value["cuda"]])


def worker(source: Path, output: Path, seed: int, num_envs: int, iterations: int,
           start: Path | None = None, snapshot: Path | None = None, alpha: float = 0.0) -> dict:
    from sim import context, verify_source
    integer(seed, "SEED")
    integer(num_envs, "ENVIRONMENTS", 1)
    integer(iterations, "ITERATIONS")
    finite_number(alpha, "ALPHA")
    if alpha >= 1 or (snapshot is None and alpha != 0):
        raise ExperimentError("INVALID_ALPHA")
    source = verify_source(source)
    expected_context = context(source)
    frozen = validate_snapshot(load_json(snapshot)) if snapshot else None
    if frozen and frozen["context"] != expected_context:
        raise ExperimentError("INCOMPATIBLE_SNAPSHOT")
    previous = validate_artifact(start, expected_context) if start else None
    if previous and (previous["seed"] != seed or previous["numEnvs"] != num_envs):
        raise ExperimentError("CHECKPOINT_PAIR_MISMATCH: seed and environment count must match")
    torch = cuda_device()
    if importlib.metadata.version("mjlab") != "1.3.0":
        raise ExperimentError("TRAINING_VERSION_MISMATCH: mjlab 1.3.0 required")
    # No telemetry, W&B uploads, or HF job interception. Imports resolve to the verified checkout.
    os.environ.update(WANDB_MODE="disabled", HF_HUB_DISABLE_TELEMETRY="1",
                      DO_NOT_TRACK="1", MICRODUCK_WARM_START="0")
    sys.path.insert(0, str(source / "src"))
    import numpy as np
    import mjlab_microduck.tasks
    from mjlab.envs import ManagerBasedRlEnv
    from mjlab.rl import RslRlVecEnvWrapper
    from mjlab.tasks.registry import load_env_cfg, load_rl_cfg, load_runner_cls
    from mjlab.rl.exporter_utils import attach_metadata_to_onnx, get_base_metadata
    from mjlab.utils.torch import configure_torch_backends

    configure_torch_backends()
    torch.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    random.seed(seed)
    np.random.seed(seed)
    cfg = load_env_cfg(TASK)
    cfg.seed, cfg.scene.num_envs = seed, num_envs
    rl_cfg = load_rl_cfg(TASK)
    rl_cfg.seed, rl_cfg.logger, rl_cfg.upload_model = seed, "tensorboard", False
    if frozen:
        curriculum = cfg.curriculum["ground_state_mix"]
        curriculum.func = shared_failure_curriculum
        curriculum.params = {**curriculum.params, "counts": frozen["counts"], "alpha": alpha}
    output.mkdir(parents=True, exist_ok=False)
    write_once(output / "started.json", seal({"seed": seed, "numEnvs": num_envs,
        "iterations": iterations, "context": expected_context,
        "startCheckpointSha256": previous["checkpointSha256"] if previous else None,
        "snapshotSha256": frozen["sha256"] if frozen else None, "alpha": alpha}))
    env = None
    started = time.perf_counter()
    try:
        env = ManagerBasedRlEnv(cfg=cfg, device="cuda:0")
        wrapped = RslRlVecEnvWrapper(env, clip_actions=rl_cfg.clip_actions)
        runner_cls = load_runner_cls(TASK)
        if runner_cls is None:
            raise ExperimentError("UPSTREAM_RUNNER_UNAVAILABLE")
        runner = runner_cls(wrapped, asdict(rl_cfg), str(output / "logs"), "cuda:0")
        if previous:
            # Upstream uses pickle-based torch checkpoints. Only this local worker's artifacts are accepted.
            infos = runner.load(str(start / previous["checkpointFile"]), map_location="cuda:0")
            restore_rng(torch, infos.get("experiencebridge_rng"))
        start_counter = int(env.common_step_counter)
        start_iteration = int(runner.current_learning_iteration)
        if iterations:
            runner.learn(num_learning_iterations=iterations, init_at_random_ep_len=True)
        steps = (int(env.common_step_counter) - start_counter) * num_envs
        expected_steps = iterations * rl_cfg.num_steps_per_env * num_envs
        if steps != expected_steps:
            raise ExperimentError("TRAINING_BUDGET_MISMATCH")
        checkpoint = output / "final.pt"
        runner.save(str(checkpoint), infos={"experiencebridge_rng": rng_state(torch)})
        # This upstream export includes the trained observation normalizer.
        runner.export_policy_to_onnx(str(output), "policy.onnx")
        attach_metadata_to_onnx(str(output / "policy.onnx"),
                                get_base_metadata(env, run_path=str(checkpoint)))
        artifact = seal({"schemaVersion": 1, "kind": "microduck-training-artifact", "complete": True,
            "context": expected_context, "seed": seed, "numEnvs": num_envs,
            "iterations": iterations, "startIteration": start_iteration,
            "trainingSteps": steps, "trainingSeconds": time.perf_counter() - started,
            "priorTrainingSteps": previous["priorTrainingSteps"] + previous["trainingSteps"] if previous else 0,
            "priorTrainingSeconds": previous["priorTrainingSeconds"] + previous["trainingSeconds"] if previous else 0,
            "startCheckpointSha256": previous["checkpointSha256"] if previous else None,
            "snapshotSha256": frozen["sha256"] if frozen else None, "alpha": alpha,
            "resumeMode": "resume", "device": torch.cuda.get_device_name(0),
            "checkpointFile": checkpoint.name, "checkpointSha256": file_digest(checkpoint),
            "policyFile": "policy.onnx", "policySha256": file_digest(output / "policy.onnx")})
        write_once(output / "artifact.json", artifact)
        return artifact
    except BaseException as error:
        write_once(output / "failure.json", {"state": "failed", "errorType": type(error).__name__})
        raise
    finally:
        if env is not None:
            env.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--num-envs", type=int, required=True)
    parser.add_argument("--iterations", type=int, required=True)
    parser.add_argument("--start", type=Path)
    parser.add_argument("--snapshot", type=Path)
    parser.add_argument("--alpha", type=float, default=0.0)
    args = parser.parse_args()
    try:
        print(canonical(worker(args.source.resolve(), args.output.resolve(), args.seed,
            args.num_envs, args.iterations, args.start.resolve() if args.start else None,
            args.snapshot.resolve() if args.snapshot else None, args.alpha)).decode())
    except (ExperimentError, FileExistsError) as error:
        parser.exit(1, f"{error}\n")


if __name__ == "__main__":
    main()
