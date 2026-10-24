import copy
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from memory import ExperimentError, file_digest, seal, write_once
from run import (lesson_from_evaluation, paired_summary, validate_cases,
                 validate_evaluation)
from sim import scenario
from train import validate_artifact
from test_memory import CONTEXT


def training_artifact(folder, *, seed=7, start="e" * 64):
    folder.mkdir()
    (folder / "final.pt").write_bytes(b"local validator fixture, never loaded as a checkpoint")
    (folder / "policy.onnx").write_bytes(b"local validator fixture, never executed")
    artifact = seal({
        "schemaVersion": 1, "kind": "microduck-training-artifact", "complete": True,
        "context": copy.deepcopy(CONTEXT), "seed": seed, "numEnvs": 4,
        "iterations": 1, "startIteration": 0, "trainingSteps": 96, "trainingSeconds": 1.0,
        "priorTrainingSteps": 0, "priorTrainingSeconds": 0.0,
        "startCheckpointSha256": start, "snapshotSha256": None, "alpha": 0,
        "resumeMode": "resume", "device": "test-only-device-label",
        "checkpointFile": "final.pt", "checkpointSha256": file_digest(folder / "final.pt"),
        "policyFile": "policy.onnx", "policySha256": file_digest(folder / "policy.onnx"),
    })
    write_once(folder / "artifact.json", artifact)
    return artifact


def cases(split="evaluation"):
    return seal({"schemaVersion": 1, "context": copy.deepcopy(CONTEXT),
        "cases": [scenario(family, 1, split) for family in ("face_down", "face_up", "sitting", "standing")]})


def evaluation(artifact, *, good=True, split="evaluation"):
    inputs = cases(split)
    sample = {"height": 0.115 if good else 0.06, "tilt": 0.0, "bothFeet": True}
    episodes = [{"scenario": case, "policyKind": "onnx", "policySha256": artifact["policySha256"],
        "controlSteps": 300, "simulatedSeconds": 6.0, "wallSeconds": 0.1,
        "initialState": {"qpos": [0, 0, 0.115, 1, 0, 0, 0] + [0] * 14, "qvel": [0] * 20},
        "recovered": good, "outcome": "recovered" if good else "not-recovered",
        "samples": [copy.copy(sample) for _ in range(300)]}
        for case in inputs["cases"]]
    return seal({"schemaVersion": 1, "kind": "policy-evaluation", "complete": True,
        "context": copy.deepcopy(CONTEXT), "artifactSha256": artifact["sha256"],
        "policySha256": artifact["policySha256"], "casesSha256": inputs["sha256"],
        "split": split, "episodes": episodes, "wallSeconds": 0.4})


class RunTests(unittest.TestCase):
    # V30: complete, matched evidence may report worse performance; partial work cannot succeed.
    def test_worse_result_is_reported_without_promoting_it(self):
        with tempfile.TemporaryDirectory() as folder:
            a = training_artifact(Path(folder) / "a")
            b = training_artifact(Path(folder) / "b")
            summary = paired_summary(evaluation(a), evaluation(b, good=False), cases(), a, b)
            self.assertEqual(summary["recoveryResult"], "worse")
            self.assertEqual(summary["perFamily"]["face_up"],
                             {"attempts": 1, "baselineSuccesses": 1, "memorySuccesses": 0})

    def test_mismatched_checkpoint_seed_and_budget_fail_closed(self):
        with tempfile.TemporaryDirectory() as folder:
            a = training_artifact(Path(folder) / "a")
            b = training_artifact(Path(folder) / "b")
            for key, value in (("startCheckpointSha256", "f" * 64), ("seed", 9), ("trainingSteps", 192)):
                changed = {**b, key: value}
                with self.assertRaisesRegex(ExperimentError, "UNMATCHED"):
                    paired_summary(evaluation(a), evaluation(changed), cases(), a, changed)

    def test_missing_episode_and_invented_success_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            artifact = training_artifact(Path(folder) / "a")
            report = evaluation(artifact)
            report.pop("sha256")
            report["episodes"].pop()
            with self.assertRaisesRegex(ExperimentError, "INCOMPLETE"):
                validate_evaluation(seal(report), cases(), artifact)
            report = evaluation(artifact, good=False)
            report.pop("sha256")
            report["episodes"][0]["recovered"] = True
            with self.assertRaisesRegex(ExperimentError, "OUTCOME"):
                validate_evaluation(seal(report), cases(), artifact)

    def test_wrong_partition_and_smoke_are_not_learning_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            artifact = training_artifact(Path(folder) / "a")
            with self.assertRaisesRegex(ExperimentError, "PARTITION"):
                lesson_from_evaluation(evaluation(artifact), cases(), artifact,
                    "donor", "2099-01-01T00:00:00Z")
            report = evaluation(artifact, split="train")
            report.pop("sha256")
            report["episodes"][0]["policyKind"] = "hold-home-smoke"
            with self.assertRaisesRegex(ExperimentError, "IDENTITY"):
                lesson_from_evaluation(seal(report), cases("train"), artifact,
                    "donor", "2099-01-01T00:00:00Z")

    def test_tampered_training_artifact_is_rejected_before_loading(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / "a"
            training_artifact(root)
            self.assertEqual(validate_artifact(root)["trainingSteps"], 96)
            (root / "final.pt").write_bytes(b"changed")
            with self.assertRaisesRegex(ExperimentError, "INTEGRITY"):
                validate_artifact(root)

    def test_no_cuda_is_an_error_not_a_success_receipt(self):
        source = os.environ.get("MICRODUCK_SOURCE")
        if not source:
            raise RuntimeError("MICRODUCK_SOURCE required")
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / "attempt"
            command = [sys.executable, str(Path(__file__).resolve().parents[1] / "train.py"),
                "--source", source, "--output", str(output), "--seed", "7",
                "--num-envs", "4", "--iterations", "1"]
            # Force the documented CPU-only error even on a GPU CI host.
            result = subprocess.run(command, capture_output=True, text=True, timeout=30,
                env={**os.environ, "CUDA_VISIBLE_DEVICES": ""})
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("CUDA_TRAINING_UNAVAILABLE", result.stderr)
            self.assertFalse(output.exists())


if __name__ == "__main__":
    unittest.main()
