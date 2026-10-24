"""Local, simulation-only evidence. Digests do not authenticate contributors."""
from __future__ import annotations

import hashlib
import json
import math
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path

FAMILIES = ("face_down", "face_up", "sitting", "standing")
TASK = "Mjlab-StandUp-Flat-MicroDuck"
SOURCE_REVISION = "b02fdea4902c2b93b7d34a83a6f05da4ececb7d3"
BAM_REVISION = "62bd8ce12154340be97e06f7f41a0ca8f116d967"
SUCCESS_RULE = "stand-final-second-v1"
MAX_JSON_BYTES = 8 * 1024 * 1024


class ExperimentError(ValueError):
    pass


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True, allow_nan=False).encode("utf-8")


def digest(value: object) -> str:
    return hashlib.sha256(canonical(value)).hexdigest()


def file_digest(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def seal(value: dict) -> dict:
    if "sha256" in value:
        raise ExperimentError("INTEGRITY: cannot reseal a sealed record")
    return {**value, "sha256": digest(value)}


def object_keys(value: object, keys: set[str], label: str) -> dict:
    if type(value) is not dict or value.keys() != keys:
        raise ExperimentError(f"INVALID_{label}: missing or unexpected fields")
    return value


def finite_number(value: object, label: str, minimum: float = 0) -> float:
    if type(value) not in (int, float) or not math.isfinite(value) or value < minimum:
        raise ExperimentError(f"INVALID_{label}: expected finite number >= {minimum}")
    return value


def integer(value: object, label: str, minimum: int = 0) -> int:
    if type(value) is not int or value < minimum:
        raise ExperimentError(f"INVALID_{label}: expected integer >= {minimum}")
    return value


def text(value: object, label: str) -> str:
    if type(value) is not str or not value or len(value) > 256:
        raise ExperimentError(f"INVALID_{label}")
    return value


def hash_string(value: object, label: str, size: int = 64) -> str:
    if type(value) is not str or not re.fullmatch(rf"[0-9a-f]{{{size}}}", value):
        raise ExperimentError(f"INVALID_{label}")
    return value


def timestamp(value: object) -> datetime:
    try:
        parsed = datetime.fromisoformat(text(value, "TIME").replace("Z", "+00:00"))
        if parsed.utcoffset() is None:
            raise ValueError("timezone required")
        return parsed
    except ValueError as error:
        raise ExperimentError("INVALID_TIME") from error


def verify_seal(value: object) -> dict:
    if type(value) is not dict or "sha256" not in value:
        raise ExperimentError("INTEGRITY: sealed object required")
    expected = hash_string(value["sha256"], "INTEGRITY")
    if digest({k: v for k, v in value.items() if k != "sha256"}) != expected:
        raise ExperimentError("INTEGRITY: digest mismatch")
    return value


def validate_context(value: object) -> dict:
    obj = object_keys(value, {"task", "sourceRevision", "bamRevision", "modelSha256",
        "physicsSha256", "trainingConfigSha256", "observationSize", "actionSize",
        "controlHz", "successRule"}, "CONTEXT")
    for field in ("sourceRevision", "bamRevision"):
        hash_string(obj[field], field, 40)
    for field in ("modelSha256", "physicsSha256", "trainingConfigSha256"):
        hash_string(obj[field], field)
    for field, expected in (("task", TASK), ("observationSize", 61), ("actionSize", 14),
                            ("controlHz", 50), ("successRule", SUCCESS_RULE)):
        if type(obj[field]) is not type(expected) or obj[field] != expected:
            raise ExperimentError(f"INVALID_CONTEXT: unsupported {field}")
    return obj


def validate_counts(value: object) -> dict:
    obj = object_keys(value, set(FAMILIES), "COUNTS")
    for family in FAMILIES:
        row = object_keys(obj[family], {"attempted", "failed"}, "COUNTS")
        attempted = integer(row["attempted"], "ATTEMPTS", 1)
        if integer(row["failed"], "FAILURES") > attempted:
            raise ExperimentError("INVALID_COUNTS: failures exceed attempts")
    return obj


def scenario_ids(value: object) -> list[str]:
    if type(value) is not list or not value:
        raise ExperimentError("INVALID_SCENARIOS")
    for item in value:
        text(item, "SCENARIO")
    if len(set(value)) != len(value):
        raise ExperimentError("DUPLICATE_SCENARIO")
    return value


def validate_lesson(value: object, now: datetime | None = None) -> dict:
    obj = verify_seal(value)
    object_keys(obj, {"schemaVersion", "donorId", "policySha256", "context",
        "evidenceLevel", "createdAt", "expiresAt", "rights", "counts",
        "scenarioIds", "donorCost", "sha256"}, "LESSON")
    if type(obj["schemaVersion"]) is not int or obj["schemaVersion"] != 1:
        raise ExperimentError("INVALID_VERSION")
    text(obj["donorId"], "DONOR")
    hash_string(obj["policySha256"], "POLICY")
    validate_context(obj["context"])
    if obj["evidenceLevel"] != "simulation-observed":
        raise ExperimentError("INVALID_EVIDENCE")
    rights = object_keys(obj["rights"], {"use", "redistribution"}, "RIGHTS")
    if rights["use"] != "local-noncommercial-simulation" or rights["redistribution"] is not False:
        raise ExperimentError("INVALID_RIGHTS")
    created, expires = timestamp(obj["createdAt"]), timestamp(obj["expiresAt"])
    current = now or datetime.now(timezone.utc)
    if not created <= current < expires:
        raise ExperimentError("INVALID_TIME: future or expired lesson")
    counts = validate_counts(obj["counts"])
    ids = scenario_ids(obj["scenarioIds"])
    if len(ids) != sum(row["attempted"] for row in counts.values()):
        raise ExperimentError("INVALID_COUNTS: scenario count mismatch")
    cost = object_keys(obj["donorCost"], {"trainingSteps", "trainingSeconds",
                       "evaluationSteps", "evaluationSeconds"}, "COST")
    for field in ("trainingSteps", "evaluationSteps"):
        integer(cost[field], "COST")
    for field in ("trainingSeconds", "evaluationSeconds"):
        finite_number(cost[field], "COST")
    return obj


def freeze_lessons(records: list[dict], context: dict, evaluation_ids: list[str],
                   now: datetime | None = None) -> dict:
    validate_context(context)
    test_ids = set(scenario_ids(evaluation_ids))
    if not records:
        raise ExperimentError("MISSING_LESSON")
    counts = {family: {"attempted": 0, "failed": 0} for family in FAMILIES}
    ids, hashes = [], []
    seen = set()
    validated = []
    for raw in records:
        record = validate_lesson(raw, now)
        mismatches = [key for key in context if context[key] != record["context"][key]]
        if mismatches:
            raise ExperimentError("INCOMPATIBLE: " + ", ".join(mismatches))
        for ident in record["scenarioIds"]:
            if ident in test_ids:
                raise ExperimentError("EVALUATION_LEAKAGE")
            if ident in seen:
                raise ExperimentError("DUPLICATE_SCENARIO")
            seen.add(ident)
            ids.append(ident)
        hashes.append(record["sha256"])
        validated.append(record)
        for family in FAMILIES:
            for key in ("attempted", "failed"):
                counts[family][key] += record["counts"][family][key]
    return seal({"schemaVersion": 1, "context": context, "lessons": validated,
                 "lessonHashes": hashes, "counts": counts, "scenarioIds": ids,
                 "evaluationScenarioIds": evaluation_ids})


def validate_snapshot(value: object, now: datetime | None = None) -> dict:
    obj = verify_seal(value)
    object_keys(obj, {"schemaVersion", "context", "lessons", "lessonHashes", "counts",
                     "scenarioIds", "evaluationScenarioIds", "sha256"}, "SNAPSHOT")
    if type(obj["lessons"]) is not list:
        raise ExperimentError("INVALID_SNAPSHOT")
    expected = freeze_lessons(obj["lessons"], obj["context"], obj["evaluationScenarioIds"], now)
    if canonical(expected) != canonical(obj):
        raise ExperimentError("INVALID_SNAPSHOT: derived evidence mismatch")
    return obj


def mix_probabilities(base: list[float], counts: dict, alpha: float) -> tuple[list[float], str]:
    finite_number(alpha, "ALPHA")
    if alpha >= 1 or type(base) is not list or len(base) != 4:
        raise ExperimentError("INVALID_MIX")
    for value in base:
        finite_number(value, "PROBABILITY")
    if not math.isclose(sum(base), 1, abs_tol=1e-8):
        raise ExperimentError("INVALID_MIX: base probabilities must sum to 1")
    validate_counts(counts)
    rates = [counts[key]["failed"] / counts[key]["attempted"] for key in FAMILIES]
    total = sum(rates)
    if total == 0:
        return list(base), "no-failure-signal"
    return [(1 - alpha) * p + alpha * rate / total for p, rate in zip(base, rates)], "failure-signal"


def load_json(path: Path) -> dict:
    def unique(pairs):
        obj = {}
        for key, value in pairs:
            if key in obj:
                raise ExperimentError("DUPLICATE_JSON_KEY")
            obj[key] = value
        return obj

    def invalid_constant(_value):
        raise ExperimentError("NONFINITE_JSON")

    try:
        with path.open("rb") as stream:
            data = stream.read(MAX_JSON_BYTES + 1)
        if len(data) > MAX_JSON_BYTES:
            raise ExperimentError("JSON_TOO_LARGE")
        value = json.loads(data, object_pairs_hook=unique, parse_constant=invalid_constant)
        if type(value) is not dict:
            raise ExperimentError("JSON_OBJECT_REQUIRED")
        return value
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ExperimentError(f"CANNOT_READ_JSON: {path.name}") from error


def write_once(path: Path, value: dict) -> Path:
    """No overwrite, even when a writer dies before returning its result."""
    payload = canonical(value) + b"\n"
    if len(payload) > MAX_JSON_BYTES:
        raise ExperimentError("JSON_TOO_LARGE")
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".pending-", delete=False) as stream:
            temp = Path(stream.name)
            stream.write(payload)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(temp, path)
        except FileExistsError:
            if path.is_symlink() or path.read_bytes() != payload:
                raise ExperimentError(f"ARTIFACT_CONFLICT: {path.name}")
        return path
    finally:
        if temp is not None:
            temp.unlink(missing_ok=True)


def publish_lesson(folder: Path, value: dict, now: datetime | None = None) -> Path:
    record = validate_lesson(value, now)
    return write_once(folder / (record["sha256"] + ".json"), record)
