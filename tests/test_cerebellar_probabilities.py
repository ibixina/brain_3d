"""Independently compare every output voxel to the original pinned NIfTI."""
from pathlib import Path
import gzip
import hashlib
import json
import unittest

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / '.cache/subregions/cerebellum/atl-Anatom_space-MNISym_probseg.nii'


class CerebellarProbabilities(unittest.TestCase):
    @unittest.skipUnless(SOURCE.exists(), 'Run build_cerebellar_probabilities.py to retain the original source audit input')
    def test_every_channel_is_lossless_native_source_with_original_scaling(self):
        manifest = json.loads((ROOT / 'public/subregions/cerebellum-probability/manifest.json').read_text())
        self.assertEqual(hashlib.sha256(SOURCE.read_bytes()).hexdigest(), manifest['source']['sha256'])
        image = nib.load(SOURCE)
        raw = image.dataobj.get_unscaled()
        self.assertEqual(image.dataobj.slope, manifest['encoding']['slope'])
        self.assertEqual(image.dataobj.inter, manifest['encoding']['intercept'])
        for entry in manifest['entries'].values():
            with self.subTest(label=entry['label']):
                values = np.frombuffer(gzip.decompress((ROOT / 'public' / entry['asset']['url'].lstrip('/')).read_bytes()), dtype='uint8').reshape(raw.shape[:3], order='F')
                np.testing.assert_array_equal(values, raw[..., entry['channel']])
                peak = list(map(int, np.unravel_index(values.argmax(), values.shape)))
                self.assertEqual(peak, entry['peak']['index'])
        original_labels = nib.Nifti1Image.from_bytes(gzip.decompress((ROOT / 'public/subregions/cerebellum-labels.nii.gz').read_bytes())).get_fdata()
        packed = np.frombuffer(gzip.decompress((ROOT / 'public/subregions/cerebellum-probability/labels.u8.gz').read_bytes()),dtype='uint8').reshape(raw.shape[:3],order='F')
        np.testing.assert_array_equal(packed,original_labels)


if __name__ == '__main__':
    unittest.main()
