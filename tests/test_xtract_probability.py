import gzip
import hashlib
import json
import unittest
from pathlib import Path

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public/tractography/xtract/manifest.json"
SOURCE = ROOT / ".cache/pandora/Xtract.nii.gz"


class XtractProbabilityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.manifest = json.loads(MANIFEST.read_text())
        cls.image = nib.load(str(SOURCE))
        cls.proxy = cls.image.dataobj

    def test_all_42_maps_are_exact_sampled_and_quantized_source_values(self):
        self.assertEqual(self.image.shape, (193, 229, 193, 42))
        for channel in self.manifest["channels"]:
            with self.subTest(pathway=channel["id"]):
                index = channel["channel"]
                sampled = np.asarray(
                    self.proxy[::2, ::2, ::2, index], dtype=np.float32
                )
                packed = (
                    ROOT / "public" / channel["asset"]["url"].lstrip("/")
                ).read_bytes()
                raw = gzip.decompress(packed)
                encoded = np.frombuffer(raw, dtype="<u2").reshape(
                    self.manifest["grid"]["shape"], order="F"
                )
                expected = np.rint(sampled * 65535).astype("<u2")
                np.testing.assert_array_equal(encoded, expected)
                peak = np.unravel_index(
                    np.argmax(sampled.ravel(order="F")), sampled.shape, order="F"
                )
                self.assertEqual(list(peak), channel["peak"]["index"])
                self.assertAlmostEqual(
                    float(sampled[peak]), channel["peak"]["probability"], places=7
                )

    def test_pinned_source_inputs_match_manifest_checksums(self):
        source = self.manifest["source"]
        inputs = (
            (SOURCE, source["niftiSha256"]),
            (ROOT / ".cache/pandora/Xtract_info.csv", source["metadataSha256"]),
            (ROOT / ".cache/pandora/license.txt", source["licenseSha256"]),
        )
        for path, expected in inputs:
            with self.subTest(path=path.name):
                self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), expected)
        public_license = ROOT / "public/tractography/xtract/LICENSE.txt"
        self.assertEqual(
            hashlib.sha256(public_license.read_bytes()).hexdigest(),
            source["licenseDisplaySha256"],
        )
        self.assertEqual(
            public_license.read_bytes(),
            (ROOT / ".cache/pandora/license.txt").read_bytes().replace(b"\r\n", b"\n"),
        )


if __name__ == "__main__":
    unittest.main()
