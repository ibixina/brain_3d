import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_subregion_evidence import summarize


class ProbabilityEvidenceTests(unittest.TestCase):
    def test_background_sibling_channels_and_first_channel_ties_compete(self):
        probs = np.array([
            [.4, .35, .25, 0], [.3, .4, .3, 0],
            [0, .5, .5, 0], [0, .25, .15, .6],
        ], dtype=np.float32).reshape(2, 2, 1, 4)
        entries = [dict(id='shown', channel=1, label=10, voxels=2),
                   dict(id='omitted', channel=2, label=20, voxels=0)]
        result = summarize(probs, np.eye(4), entries, '0,Background\n10,Shown\n20,Omitted\n30,Sibling\n')
        self.assertEqual(result['shown']['winningProbabilityBins'], [0, 1, 1, 0])
        self.assertEqual(result['shown']['peak']['index'], [1, 0, 0])
        self.assertTrue(result['shown']['peak']['selectedWins'])
        self.assertEqual(result['shown']['peak']['strongestOther']['channel'], 2)
        self.assertEqual(result['omitted']['winningProbabilityBins'], [0, 0, 0, 0])
        self.assertIsNone(result['omitted']['winningProbabilityRange'])
        self.assertEqual(result['omitted']['peak']['probability'], .5)
        self.assertFalse(result['omitted']['peak']['selectedWins'])
        self.assertEqual(result['omitted']['peak']['winnerChannel'], 1)

    def test_bin_boundaries_and_reflected_source_coordinates(self):
        probs = np.array([
            [.2, .25, .2, .2, .15], [.2, .5, .1, .1, .1],
            [.1, .75, .05, .05, .05],
        ], dtype=np.float32).reshape(3, 1, 1, 5)
        affine = np.diag([-.25, .25, .25, 1])
        affine[0, 3] = 45
        entry = dict(id='target', channel=1, label=1, voxels=3, maxProbability=.75)
        result = summarize(probs, affine, [entry], '0,Background\n1,Target\n2,A\n3,B\n4,C\n')['target']
        self.assertEqual(result['winningProbabilityBins'], [0, 1, 1, 1])
        self.assertEqual(result['peak']['rasMm'], [44.5, 0, 0])
        with self.assertRaises(ValueError):
            summarize(probs, affine, [{**entry, 'voxels': 2}], '0,B\n1,T\n2,A\n3,B\n4,C\n')
        with self.assertRaises(ValueError):
            summarize(probs, affine, [{**entry, 'maxProbability': 1}], '0,B\n1,T\n2,A\n3,B\n4,C\n')


if __name__ == '__main__':
    unittest.main()
