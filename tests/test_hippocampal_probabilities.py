"""Compare released probability slices with the pinned FreeSurfer NIfTI."""
from pathlib import Path
import hashlib
import gzip
import json
import sys
import unittest

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.cache/subregions/HippoAmyg.zip'
sys.path.insert(0, str(ROOT / 'scripts'))
from hippo_amygdala_source import load_source


class HippocampalProbabilities(unittest.TestCase):
    def test_bundled_channels_and_context_are_hash_checked(self):
        manifest = json.loads((ROOT / 'public/subregions/hippocampus-probability/manifest.json').read_text())
        self.assertEqual(manifest['source']['archiveSha256'], json.loads(
            (ROOT / 'src/hippocampus-subregions.json').read_text())['source']['archiveSha256'])
        context = np.frombuffer(gzip.decompress((ROOT / 'public' / manifest['context']['asset']['url'].lstrip('/')).read_bytes()), dtype=np.uint8)
        self.assertEqual(context.size, int(np.prod(manifest['grids']['left']['shape'])))
        self.assertEqual(len(manifest['entries']), 40)
        unique = {}
        for entry in manifest['entries'].values():
            self.assertEqual(entry['asset']['rawBytes'], context.size * 4)
            unique[entry['channel']] = entry['asset']
        self.assertEqual(len(unique), 20)
        for asset in unique.values():
            packed = (ROOT / 'public' / asset['url'].lstrip('/')).read_bytes()
            raw = gzip.decompress(packed)
            self.assertEqual(len(raw), asset['rawBytes'])
            self.assertEqual(hashlib.sha256(raw).hexdigest(), asset['sha256'])
            self.assertEqual(hashlib.sha256(packed).hexdigest(), asset['compressedSha256'])
            self.assertEqual(len(raw), 164 * 224 * 196 * 4)

    @unittest.skipUnless(SOURCE.exists(), 'Run build_hippocampal_probabilities.py to retain the source archive')
    def test_each_released_native_float_channel_matches_the_pinned_source(self):
        manifest = json.loads((ROOT / 'public/subregions/hippocampus-probability/manifest.json').read_text())
        atlas = json.loads((ROOT / 'src/hippocampus-subregions.json').read_text())
        for side in ('left', 'right'):
            with self.subTest(side=side):
                image, probs, _, _ = load_source(side)
                grid = manifest['grids'][side]
                np.testing.assert_array_equal(image.affine[:3, 3], grid['origin'])
                np.testing.assert_array_equal(np.diag(image.affine[:3, :3]), grid['spacing'])
                np.testing.assert_array_equal(image.shape[:3], grid['shape'])
                parts = (part for part in atlas['parts'] if part['hemisphere'] == side)
                checked = set()
                winners = np.argmax(probs, axis=3).astype(np.uint8)
                packed_context = np.frombuffer(gzip.decompress(
                    (ROOT / 'public' / manifest['context']['asset']['url'].lstrip('/')).read_bytes()), dtype=np.uint8)
                np.testing.assert_array_equal(packed_context, winners.ravel(order='F'))
                for part in parts:
                    channel = part['channel']
                    if channel in checked:
                        continue
                    checked.add(channel)
                    entry = manifest['entries'][part['id']]
                    source = probs[..., channel]
                    values = np.frombuffer(gzip.decompress(
                        (ROOT / 'public' / entry['asset']['url'].lstrip('/')).read_bytes()), dtype='<f4')
                    np.testing.assert_array_equal(values, source.ravel(order='F'))
                    self.assertEqual(entry['categoricalVoxels'], int(np.count_nonzero(winners == channel)))
                    self.assertEqual(entry['positiveVoxels'], int(np.count_nonzero(source > 0)))
                del probs, image


if __name__ == '__main__':
    unittest.main()
