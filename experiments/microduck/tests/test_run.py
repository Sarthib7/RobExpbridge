import copy
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from memory import ExperimentError, file_digest, seal, write_once
from train import validate_artifact
from test_memory import CONTEXT

def training_artifact(folder, *, seed=7, start='e' * 64):
    folder.mkdir()
    (folder / 'final.pt').write_bytes(b'local validator fixture, never loaded as a checkpoint')
    (folder / 'policy.onnx').write_bytes(b'local validator fixture, never executed')
    artifact = seal({'schemaVersion': 1, 'kind': 'microduck-training-artifact', 'complete': True, 'context': copy.deepcopy(CONTEXT), 'seed': seed, 'numEnvs': 4, 'iterations': 1, 'startIteration': 0, 'trainingSteps': 96, 'trainingSeconds': 1.0, 'priorTrainingSteps': 0, 'priorTrainingSeconds': 0.0, 'startCheckpointSha256': start, 'snapshotSha256': None, 'alpha': 0, 'resumeMode': 'resume', 'device': 'test-only-device-label', 'checkpointFile': 'final.pt', 'checkpointSha256': file_digest(folder / 'final.pt'), 'policyFile': 'policy.onnx', 'policySha256': file_digest(folder / 'policy.onnx')})
    write_once(folder / 'artifact.json', artifact)
    return artifact

class RunTests(unittest.TestCase):

    def test_tampered_training_artifact_is_rejected_before_loading(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'a'
            training_artifact(root)
            self.assertEqual(validate_artifact(root)['trainingSteps'], 96)
            (root / 'final.pt').write_bytes(b'changed')
            with self.assertRaisesRegex(ExperimentError, 'INTEGRITY'):
                validate_artifact(root)

    def test_no_cuda_is_an_error_not_a_success_receipt(self):
        source = os.environ.get('MICRODUCK_SOURCE')
        if not source:
            raise RuntimeError('MICRODUCK_SOURCE required')
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder) / 'attempt'
            command = [sys.executable, str(Path(__file__).resolve().parents[1] / 'train.py'), '--source', source, '--output', str(output), '--seed', '7', '--num-envs', '4', '--iterations', '1']
            result = subprocess.run(command, capture_output=True, text=True, timeout=30, env={**os.environ, 'CUDA_VISIBLE_DEVICES': ''})
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('CUDA_TRAINING_UNAVAILABLE', result.stderr)
            self.assertFalse(output.exists())
if __name__ == '__main__':
    unittest.main()
