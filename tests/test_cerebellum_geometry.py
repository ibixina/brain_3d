"""Check packed geometry against the retained original categorical NIfTI."""
from pathlib import Path
import gzip
import json
import unittest

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]


class CerebellumGeometry(unittest.TestCase):
    def test_source_counts_and_every_vertex_match_native_boundary_cubes(self):
        atlas = json.loads((ROOT / 'src/cerebellum-subregions.json').read_text())
        image = nib.Nifti1Image.from_bytes(gzip.decompress((ROOT / 'public/subregions/cerebellum-labels.nii.gz').read_bytes()))
        labels = np.asarray(image.dataobj)
        raw = (ROOT / 'public/subregions/cerebellum.bin').read_bytes()
        inverse = np.linalg.inv(image.affine)
        for part in atlas['parts']:
            with self.subTest(label=part['label']):
                self.assertEqual(int((labels == part['label']).sum()), part['voxels'])
                display = np.frombuffer(raw, dtype='<f4', count=part['vertices'] * 3, offset=part['offset']).reshape(-1, 3)
                original = display + np.array(atlas['source']['displayOrigin']) - [0, 5, 10]
                ras = original[:, [0, 2, 1]].copy()
                ras[:, 1] *= -1
                index = nib.affines.apply_affine(inverse, ras)
                np.testing.assert_allclose(index * 2, np.round(index * 2), atol=1e-5)
                low = np.floor(index + 1e-6).astype(int)
                high = np.ceil(index - 1e-6).astype(int)
                fractional_axes = np.sum(low != high, axis=1)
                self.assertTrue(np.all(np.isin(fractional_axes, [1, 3])))
                edge = fractional_axes == 1
                inside_low = labels[tuple(low[edge].T)] == part['label']
                inside_high = labels[tuple(high[edge].T)] == part['label']
                self.assertTrue(np.all(inside_low != inside_high))
                # Lewiner's ambiguous cases can add vertices inside a boundary cube.
                for lo, hi in zip(low[~edge], high[~edge]):
                    corners = labels[lo[0]:hi[0]+1, lo[1]:hi[1]+1, lo[2]:hi[2]+1]
                    self.assertTrue(np.any(corners == part['label']))
                    self.assertTrue(np.any(corners != part['label']))
        self.assertEqual(sum(part['voxels'] for part in atlas['parts']), int(np.count_nonzero(labels)))


if __name__ == '__main__':
    unittest.main()
