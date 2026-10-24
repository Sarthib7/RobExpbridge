"""Headless CPU MuJoCo episodes. No hardware or network control imports."""
from __future__ import annotations

import ast
import contextlib
import hashlib
import importlib.metadata
import importlib.util
import io
import math
from pathlib import Path
import struct
import subprocess
import zlib

import mujoco
import numpy as np

from memory import (
    BAM_REVISION, SOURCE_REVISION, SUCCESS_RULE, TASK, ExperimentError, digest,
    file_digest, integer,
)

TIMESTEP = 0.005
DECIMATION = 4
HORIZON = 6.0
CONTROL_HZ = 50
HOLD_STEPS = 50
HEIGHT = 0.115
HEIGHT_TOLERANCE = 0.015
TILT_LIMIT = math.radians(15)


def verify_source(source: Path) -> Path:
    source = source.resolve()
    try:
        revision = subprocess.check_output(["git", "-C", str(source), "rev-parse", "HEAD"],
                                           text=True, stderr=subprocess.DEVNULL).strip()
        changed = subprocess.check_output(["git", "-C", str(source), "status", "--porcelain",
                                           "--untracked-files=no"], text=True)
    except (OSError, subprocess.CalledProcessError) as error:
        raise ExperimentError("PINNED_SOURCE_REQUIRED: run setup first") from error
    if revision != SOURCE_REVISION or changed:
        raise ExperimentError("SOURCE_REVISION_MISMATCH: modified or wrong upstream checkout")
    if importlib.metadata.version("better-actuator-models") != "1.0.1":
        raise ExperimentError("BAM_VERSION_MISMATCH")
    dist = importlib.metadata.distribution("better-actuator-models")
    import json
    direct_url = json.loads(dist.read_text("direct_url.json") or "{}")
    if direct_url.get("vcs_info", {}).get("commit_id") != BAM_REVISION:
        raise ExperimentError("BAM_REVISION_MISMATCH")
    return source


def tree_digest(folder: Path, suffixes: set[str]) -> str:
    result = hashlib.sha256()
    for path in sorted(p for p in folder.rglob("*") if p.is_file() and p.suffix in suffixes):
        result.update(path.relative_to(folder).as_posix().encode() + b"\0")
        result.update(bytes.fromhex(file_digest(path)))
    return result.hexdigest()


def context(source: Path) -> dict:
    source = verify_source(source)
    return {
        "task": TASK, "sourceRevision": SOURCE_REVISION, "bamRevision": BAM_REVISION,
        "modelSha256": tree_digest(source / "src/mjlab_microduck/robot/microduck", {".xml", ".stl"}),
        "physicsSha256": digest({"mujoco": mujoco.__version__, "bam": BAM_REVISION,
            "numpy": np.__version__, "timestep": TIMESTEP, "decimation": DECIMATION,
            "voltage": 7.4, "sagGain": 0.1, "kp": 200.0, "minimumVoltage": 6.0,
            "height": HEIGHT, "heightTolerance": HEIGHT_TOLERANCE,
            "tiltLimit": TILT_LIMIT, "holdSteps": HOLD_STEPS, "horizon": HORIZON}),
        "trainingConfigSha256": tree_digest(source / "src/mjlab_microduck", {".py"}),
        "observationSize": 61, "actionSize": 14, "controlHz": CONTROL_HZ,
        "successRule": SUCCESS_RULE,
    }


def upstream_inference(source: Path):
    path = source / "scripts/infer_policy.py"
    spec = importlib.util.spec_from_file_location("experiencebridge_upstream_inference", path)
    if spec is None or spec.loader is None:
        raise ExperimentError("INFERENCE_MODULE_UNAVAILABLE")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scenario(family: str, seed: int, split: str) -> dict:
    from memory import FAMILIES
    if family not in FAMILIES or split not in ("train", "evaluation"):
        raise ExperimentError("INVALID_SCENARIO")
    integer(seed, "SEED")
    return {"id": digest({"family": family, "seed": seed}), "family": family,
            "seed": seed, "split": split}


def validate_scenario(value: object) -> dict:
    from memory import object_keys
    row = object_keys(value, {"id", "family", "seed", "split"}, "SCENARIO")
    if row != scenario(row["family"], row["seed"], row["split"]):
        raise ExperimentError("INVALID_SCENARIO_ID")
    return row


def success_sample(height: float, tilt: float, both_feet: bool) -> bool:
    if (type(height) not in (int, float) or type(tilt) not in (int, float)
            or not math.isfinite(height) or not math.isfinite(tilt)
            or not 0 <= tilt <= math.pi or type(both_feet) is not bool):
        raise ExperimentError("NONFINITE_SIMULATION: invalid observation")
    return abs(height - HEIGHT) <= HEIGHT_TOLERANCE and tilt <= TILT_LIMIT and both_feet


def recovered(samples: list[dict]) -> bool:
    if type(samples) is not list or len(samples) != int(HORIZON * CONTROL_HZ):
        raise ExperimentError("INCOMPLETE_EPISODE")
    valid = []
    for row in samples:
        if type(row) is not dict or row.keys() != {"height", "tilt", "bothFeet"}:
            raise ExperimentError("INVALID_SIMULATION_SAMPLE")
        valid.append(success_sample(row["height"], row["tilt"], row["bothFeet"]))
    return all(valid[-HOLD_STEPS:])


class EpisodeSimulator:
    def __init__(self, source: Path, policy: Path | None = None, *, smoke: bool = False):
        if (policy is None) != smoke:
            raise ExperimentError("POLICY_REQUIRED: use explicit smoke for a hold-home probe")
        self.source = verify_source(source)
        self.context = context(self.source)
        self.upstream = upstream_inference(self.source)
        self.policy_path = policy.resolve() if policy is not None else None
        self.policy_hash = file_digest(self.policy_path) if self.policy_path else None
        self.smoke = smoke
        self.bam_model = self.upstream.load_bam_model(200.0, 7.4, None)
        with contextlib.redirect_stdout(io.StringIO()):
            self.model, self.data, self.bam, _ = self.upstream.load_mujoco_with_bam(
                str(self.source / self.upstream.MICRODUCK_XML), self.bam_model,
                TIMESTEP, 0.1, 6.0)
            self.policy = (self.upstream.PolicyInference(
                self.model, self.data, standing_onnx_path=str(self.policy_path),
                bam_ctrl=self.bam, use_projected_gravity=True, new_cmd_obs=True)
                if self.policy_path else None)
        if self.model.nu != 14:
            raise ExperimentError("ACTION_LAYOUT_MISMATCH")
        self.joint_qpos = self.model.jnt_qposadr[self.model.actuator_trnid[:, 0]]
        self.home = np.asarray(self.upstream.DEFAULT_POSE[:14], dtype=np.float64)
        self.floor = self.model.geom("floor").id
        self.feet = {self.model.geom(name).id for name in
                     ("left_foot_collision", "right_foot_collision")}
        self.trunk = self.model.body("trunk_base").id
        self.initial_damping = self.model.dof_damping.copy()
        self.initial_friction = self.model.dof_frictionloss.copy()
        if self.policy:
            input_shape = self.policy.ort_session.get_inputs()[0].shape
            output_shape = self.policy.ort_session.get_outputs()[0].shape
            if input_shape != [1, 61] or output_shape != [1, 14]:
                raise ExperimentError("POLICY_LAYOUT_MISMATCH: expected [1,61] -> [1,14]")
        tree = ast.parse((self.source / "src/mjlab_microduck/tasks/microduck_standup_env_cfg.py").read_text())
        self.sitting = next(ast.literal_eval(node.value) for node in tree.body
            if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name)
            and target.id == "SITTING_JOINT_OVERRIDES" for target in node.targets))

    def reset(self, case: dict) -> None:
        validate_scenario(case)
        rng = np.random.default_rng(case["seed"])
        mujoco.mj_resetData(self.model, self.data)
        self.model.dof_damping[:] = self.initial_damping
        self.model.dof_frictionloss[:] = self.initial_friction
        self.data.qpos[self.joint_qpos] = self.home
        yaw = rng.uniform(-math.pi, math.pi)
        cy, sy = math.cos(yaw / 2), math.sin(yaw / 2)
        s = math.sqrt(0.5)
        family = case["family"]
        if family == "face_down":
            quat = [s * cy, -s * sy, s * cy, s * sy]
        elif family == "face_up":
            quat = [s * cy, s * sy, -s * cy, s * sy]
        else:
            quat = [cy, 0, 0, sy]
        self.data.qpos[3:7] = quat
        self.data.qpos[2] = rng.uniform(0.05, 0.09) if family.startswith("face_") else (
            rng.uniform(0.055, 0.065) if family == "sitting" else 0.115)
        if family == "sitting":
            for index, angle in self.sitting.items():
                self.data.qpos[self.joint_qpos[index]] = angle
        self.data.qvel[:] = 0
        self.bam_model.reset()
        self.bam.reset(self.data.qpos)
        self.bam.last_ts = 0.0
        if self.policy:
            self.policy.last_action.fill(0)
            self.policy.command.fill(0)
            self.policy.vel_cmd.fill(0)
            self.policy.head_offset.fill(0)
            self.policy.body_cmd.fill(0)
            if self.policy.action_buffer is not None:
                for value in self.policy.action_buffer:
                    value.fill(0)
                self.policy.buffer_index = 0
        mujoco.mj_forward(self.model, self.data)
        self.initial_state = {"qpos": self.data.qpos.tolist(), "qvel": self.data.qvel.tolist()}

    def step(self, action: np.ndarray) -> dict:
        action = np.asarray(action)
        if action.shape != (14,) or not np.isfinite(action).all():
            raise ExperimentError("INVALID_ACTION")
        targets = self.home + action
        # Match the upstream target semantics; motor limits remain in the physics model.
        if not np.isfinite(targets).all() or np.max(np.abs(targets)) > 100:
            raise ExperimentError("INVALID_ACTION: unbounded target")
        self.bam.q_target[:] = targets
        for _ in range(DECIMATION):
            before = self.data.time
            self.bam.update()
            mujoco.mj_step(self.model, self.data)
            if (not math.isclose(self.data.time - before, TIMESTEP, abs_tol=1e-10)
                    or not np.isfinite(self.data.qpos).all()
                    or not np.isfinite(self.data.qvel).all()
                    or not np.isfinite(self.data.ctrl).all()
                    or any(w.number for w in self.data.warning)):
                raise ExperimentError("NONFINITE_SIMULATION: invalid state or solver reset")
        height = float(self.data.xpos[self.trunk, 2])
        tilt = math.acos(float(np.clip(self.data.xmat[self.trunk, 8], -1, 1)))
        contact_feet = set()
        for contact in self.data.contact:
            if contact.dist <= 0:
                pair = {int(contact.geom1), int(contact.geom2)}
                if self.floor in pair:
                    contact_feet.update(pair & self.feet)
        return {"height": height, "tilt": tilt, "bothFeet": contact_feet == self.feet}

    def episode(self, case: dict) -> dict:
        import time
        start = time.perf_counter()
        self.reset(case)
        samples = []
        zero = np.zeros(14, dtype=np.float32)
        for _ in range(int(HORIZON * CONTROL_HZ)):
            samples.append(self.step(self.policy.infer() if self.policy else zero))
        result = recovered(samples)
        return {"scenario": case, "initialState": self.initial_state,
                "policyKind": "onnx" if self.policy else "hold-home-smoke",
                "policySha256": self.policy_hash, "context": self.context,
                "recovered": result, "outcome": "recovered" if result else "not-recovered",
                "simulatedSeconds": float(self.data.time), "controlSteps": len(samples),
                "wallSeconds": time.perf_counter() - start, "samples": samples}

    def render_png(self, path: Path) -> None:
        with mujoco.Renderer(self.model, height=360, width=640) as renderer:
            camera = mujoco.MjvCamera()
            camera.lookat[:] = self.data.xpos[self.trunk]
            camera.distance, camera.azimuth, camera.elevation = 0.65, 140, -25
            renderer.update_scene(self.data, camera=camera)
            pixels = renderer.render()
        def chunk(kind, payload):
            return struct.pack(">I", len(payload)) + kind + payload + struct.pack(">I", zlib.crc32(kind + payload))
        header = struct.pack(">IIBBBBB", 640, 360, 8, 2, 0, 0, 0)
        rows = b"".join(b"\0" + row.tobytes() for row in pixels)
        payload = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
        with path.open("xb") as stream:
            stream.write(payload)
