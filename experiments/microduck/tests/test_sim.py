import copy
import math
import os
import tempfile
import unittest
from pathlib import Path

import numpy as np
import onnx
from onnx import TensorProto, helper, numpy_helper

from memory import ExperimentError
from sim import (CONTROL_HZ, HOLD_STEPS, HORIZON, EpisodeSimulator,
                 recovered, scenario, success_sample)


def boundary_policy(path, *, observations=61, invalid_actions=False):
    """Untrained boundary fixture. Never treated as a recovery policy or lesson."""
    weights = np.random.default_rng(8).normal(0, 0.001, (observations, 14)).astype(np.float32)
    if invalid_actions:
        weights.fill(np.nan)
    graph = helper.make_graph(
        [helper.make_node("MatMul", ["obs", "weights"], ["actions"])],
        "untrained-boundary-probe",
        [helper.make_tensor_value_info("obs", TensorProto.FLOAT, [1, observations])],
        [helper.make_tensor_value_info("actions", TensorProto.FLOAT, [1, 14])],
        initializer=[numpy_helper.from_array(weights, "weights")])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 18)], ir_version=10)
    onnx.checker.check_model(model)
    onnx.save(model, path)


class SuccessTests(unittest.TestCase):
    # V29: success requires a complete episode and a continuous final hold.
    def test_success_requires_both_feet_height_and_upright_hold(self):
        good = {"height": 0.115, "tilt": 0.0, "bothFeet": True}
        samples = [copy.copy(good) for _ in range(int(HORIZON * CONTROL_HZ))]
        self.assertTrue(recovered(samples))
        for changed in ({"height": 0.05}, {"tilt": math.radians(16)}, {"bothFeet": False}):
            bad = copy.deepcopy(samples)
            bad[-HOLD_STEPS].update(changed)
            self.assertFalse(recovered(bad))
        with self.assertRaisesRegex(ExperimentError, "INCOMPLETE"):
            recovered(samples[:-1])
        with self.assertRaisesRegex(ExperimentError, "NONFINITE"):
            success_sample(float("nan"), 0, True)
        bad = copy.deepcopy(samples)
        bad[0]["height"] = float("inf")
        with self.assertRaisesRegex(ExperimentError, "NONFINITE"):
            recovered(bad)

    def test_train_and_evaluation_ids_cannot_hide_identical_conditions(self):
        a = scenario("face_up", 4, "train")
        b = scenario("face_up", 4, "evaluation")
        self.assertEqual(a["id"], b["id"])
        self.assertNotEqual(a["split"], b["split"])


class PhysicsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        source = os.environ.get("MICRODUCK_SOURCE")
        if not source:
            raise RuntimeError("MICRODUCK_SOURCE is required; physics tests must not silently skip")
        cls.sim = EpisodeSimulator(Path(source), smoke=True)

    def test_actual_physics_advances_and_resets_without_history_leakage(self):
        case = scenario("face_up", 42, "evaluation")
        first = self.sim.episode(case)
        self.assertEqual(first["policyKind"], "hold-home-smoke")
        self.assertIsNone(first["policySha256"])
        self.assertAlmostEqual(first["simulatedSeconds"], HORIZON, places=9)
        self.assertEqual(first["controlSteps"], 300)
        # Gravity and contact must change this initially supine state.
        self.assertNotEqual(first["initialState"]["qpos"], self.sim.data.qpos.tolist())
        self.sim.episode(scenario("sitting", 8, "evaluation"))
        again = self.sim.episode(case)
        np.testing.assert_allclose(
            [[s["height"], s["tilt"]] for s in first["samples"]],
            [[s["height"], s["tilt"]] for s in again["samples"]], rtol=0, atol=1e-10)
        self.assertEqual(first["recovered"], again["recovered"])

    def test_invalid_action_never_advances_physics(self):
        self.sim.reset(scenario("standing", 0, "evaluation"))
        for action in (np.full(14, np.nan), np.zeros(13), np.full(14, np.inf)):
            before = self.sim.data.time
            with self.assertRaisesRegex(ExperimentError, "INVALID_ACTION"):
                self.sim.step(action)
            self.assertEqual(self.sim.data.time, before)

    def test_onnx_shape_and_nonfinite_actions_fail_before_physics(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "boundary.onnx"
            boundary_policy(path, observations=60)
            with self.assertRaisesRegex(ExperimentError, "POLICY_LAYOUT"):
                EpisodeSimulator(self.sim.source, path)
            boundary_policy(path, invalid_actions=True)
            simulator = EpisodeSimulator(self.sim.source, path)
            with self.assertRaisesRegex(ExperimentError, "INVALID_ACTION"):
                simulator.episode(scenario("face_up", 9, "evaluation"))
            self.assertEqual(simulator.data.time, 0)


if __name__ == "__main__":
    unittest.main()
