import copy
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from memory import (
    ExperimentError, canonical, freeze_lessons, load_json, mix_probabilities,
    publish_lesson, seal, validate_lesson,
)

NOW = datetime(2026, 10, 24, tzinfo=timezone.utc)
CONTEXT = {
    "task": "Mjlab-StandUp-Flat-MicroDuck",
    "sourceRevision": "b02fdea4902c2b93b7d34a83a6f05da4ececb7d3",
    "bamRevision": "62bd8ce12154340be97e06f7f41a0ca8f116d967",
    "modelSha256": "a" * 64, "physicsSha256": "b" * 64,
    "trainingConfigSha256": "c" * 64,
    "observationSize": 61, "actionSize": 14, "controlHz": 50,
    "successRule": "stand-final-second-v1",
}


def lesson():
    return seal({
        "schemaVersion": 1, "donorId": "donor-a", "policySha256": "d" * 64,
        "context": copy.deepcopy(CONTEXT), "evidenceLevel": "simulation-observed",
        "createdAt": "2026-10-24T00:00:00Z", "expiresAt": "2026-11-24T00:00:00Z",
        "rights": {"use": "local-noncommercial-simulation", "redistribution": False},
        "counts": {family: {"attempted": 2, "failed": failed} for family, failed in
                   [("face_down", 2), ("face_up", 1), ("sitting", 0), ("standing", 0)]},
        "scenarioIds": [f"train-{i}" for i in range(8)],
        "donorCost": {"trainingSteps": 100, "trainingSeconds": 2.0,
                      "evaluationSteps": 2400, "evaluationSeconds": 1.0},
    })


class MemoryTests(unittest.TestCase):
    # V28: local simulation evidence is immutable, compatible, and training-only.
    def test_compatible_snapshot_uses_observed_failures(self):
        frozen = freeze_lessons([lesson()], CONTEXT, ["eval-1"], NOW)
        self.assertEqual(frozen["lessonHashes"], [lesson()["sha256"]])
        mixed, signal = mix_probabilities([0.25] * 4, frozen["counts"], 0.5)
        self.assertEqual(signal, "failure-signal")
        self.assertAlmostEqual(sum(mixed), 1)
        self.assertAlmostEqual(mixed[0], 0.125 + 1 / 3)
        self.assertEqual(mixed[2:], [0.125, 0.125])

    def test_tampered_counts_are_rejected(self):
        record = lesson()
        record["counts"]["face_down"]["failed"] = 0
        with self.assertRaisesRegex(ExperimentError, "INTEGRITY"):
            validate_lesson(record, NOW)

    def test_mismatched_actuator_is_not_downgraded(self):
        context = {**CONTEXT, "bamRevision": "f" * 40}
        with self.assertRaisesRegex(ExperimentError, "INCOMPATIBLE.*bamRevision"):
            freeze_lessons([lesson()], context, ["eval-1"], NOW)

    def test_missing_context_and_unobserved_family_fail_closed(self):
        for alter in (lambda r: r["context"].pop("modelSha256"),
                      lambda r: r["counts"]["sitting"].update(attempted=0)):
            record = lesson()
            record.pop("sha256")
            alter(record)
            with self.assertRaises(ExperimentError):
                validate_lesson(seal(record), NOW)

    def test_expired_and_future_evidence_are_rejected(self):
        for name, value in (("expiresAt", "2026-10-23T00:00:00Z"),
                            ("createdAt", "2026-10-25T00:00:00Z")):
            record = lesson()
            record.pop("sha256")
            record[name] = value
            with self.assertRaisesRegex(ExperimentError, "TIME"):
                validate_lesson(seal(record), NOW)

    def test_evaluation_leakage_and_duplicate_scenarios_are_rejected(self):
        with self.assertRaisesRegex(ExperimentError, "LEAKAGE"):
            freeze_lessons([lesson()], CONTEXT, ["train-2"], NOW)
        with self.assertRaisesRegex(ExperimentError, "DUPLICATE"):
            freeze_lessons([lesson(), lesson()], CONTEXT, ["eval-1"], NOW)

    def test_zero_failure_signal_is_explicit(self):
        record = lesson()
        for row in record["counts"].values():
            row["failed"] = 0
        mixed, signal = mix_probabilities([0.4, 0.0, 0.2, 0.4], record["counts"], 0.5)
        self.assertEqual(mixed, [0.4, 0.0, 0.2, 0.4])
        self.assertEqual(signal, "no-failure-signal")

    def test_counts_and_alpha_have_strict_numeric_bounds(self):
        for failed in (True, -1, 3, float("nan")):
            record = lesson()
            record.pop("sha256")
            record["counts"]["face_down"]["failed"] = failed
            with self.assertRaises((ExperimentError, ValueError)):
                validate_lesson(seal(record), NOW)
        for alpha in (True, -0.1, 1.0, float("nan")):
            with self.assertRaises(ExperimentError):
                mix_probabilities([0.25] * 4, lesson()["counts"], alpha)

    def test_publish_is_idempotent_without_overwrite(self):
        with tempfile.TemporaryDirectory() as folder:
            first = publish_lesson(Path(folder), lesson(), NOW)
            self.assertEqual(publish_lesson(Path(folder), lesson(), NOW), first)
            self.assertEqual(load_json(first), lesson())
            first.write_text("corrupted", encoding="utf-8")
            with self.assertRaises(ExperimentError):
                publish_lesson(Path(folder), lesson(), NOW)
            self.assertEqual(first.read_text(), "corrupted")

    def test_json_rejects_duplicate_keys_nonfinite_and_oversize(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "lesson.json"
            for text in ('{"a": 1, "a": 2}', '{"a": NaN}'):
                path.write_text(text)
                with self.assertRaises(ExperimentError):
                    load_json(path)
            path.write_bytes(b" " * (8 * 1024 * 1024 + 1))
            with self.assertRaisesRegex(ExperimentError, "JSON_TOO_LARGE"):
                load_json(path)
            self.assertEqual(canonical({"b": 2, "a": 1}), b'{"a":1,"b":2}')


if __name__ == "__main__":
    unittest.main()
