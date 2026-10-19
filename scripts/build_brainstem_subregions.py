"""Derive standalone surfaces from FreeSurfer's documented MNI probability atlas."""

from pathlib import Path
import gzip
import hashlib
import json
import urllib.request
import zipfile

import nibabel as nib
import numpy as np
from subregion_geometry import pack_surfaces

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache/subregions"
OUT = ROOT / "public/subregions"
URL = (
    "https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace"
    "?action=AttachFile&do=get&target=Brainstem.zip"
)
SHA = "f6ad672136102669955ee803f27c188a5e172a326a61fb9818d12fb4707fe5c2"
ENTRIES = [
    (1, 175, "medulla", "Medulla oblongata", "#bca5d4",
     "The lower brainstem compartment, continuing toward the spinal cord. "
     "Internal nuclei and individual fiber pathways are not segmented."),
    (2, 174, "pons", "Pons", "#d7b977",
     "The middle brainstem compartment. Its outer surface does not distinguish "
     "pontine nuclei, cranial-nerve nuclei, or individual tracts."),
    (3, 178, "scp", "Superior cerebellar peduncles", "#87b6c9",
     "The atlas groups the superior cerebellar peduncle territory into one label. "
     "Its paired portions are not individual reconstructed axons."),
    (4, 173, "midbrain", "Midbrain", "#a3bd96",
     "The upper brainstem compartment. Substantia nigra, red nuclei, colliculi, "
     "and other internal subdivisions are not individually modeled."),
]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    archive = CACHE / "Brainstem.zip"
    if not archive.exists():
        urllib.request.urlretrieve(URL, archive)
    if sha256(archive.read_bytes()) != SHA:
        raise ValueError("Brainstem source archive checksum changed")
    with zipfile.ZipFile(archive) as source:
        names = source.read("BrainstemProbs.MNIsymSpace.names.txt").decode()
        if names.splitlines() != [
            "0,Background", "175,Medulla", "174,Pons", "178,SCP", "173,Midbrain"
        ]:
            raise ValueError("Unexpected probability-channel order")
        image_bytes = source.read("BrainstemProbs.MNIsymSpace.nii.gz")
        image = nib.Nifti1Image.from_bytes(gzip.decompress(image_bytes))
    probs = image.get_fdata(dtype=np.float32)
    if not np.isfinite(probs).all() or not np.allclose(probs.sum(axis=3), 1, atol=1e-6):
        raise ValueError("Invalid label probabilities")
    entries = [dict(
        id=key, key=key, name=name,
        hemisphere="bilateral" if key == "scp" else "midline", group="Brainstem",
        kind="segmentation", source="probability-atlas", color=color,
        label=label, channel=channel, description=description,
    ) for channel, label, key, name, color, description in ENTRIES]
    raw, parts, omitted, origin = pack_surfaces(image, probs.argmax(axis=3), entries)
    if omitted:
        raise ValueError("A brainstem source label has no winner surface")
    compressed = gzip.compress(raw, mtime=0)
    (OUT / "brainstem.bin").write_bytes(raw)
    (OUT / "brainstem.mesh").write_bytes(compressed)
    manifest = dict(
        version=1, title="Brainstem atlas subregions", checkedOn="2026-10-19",
        parts=parts, compressedUrl="/subregions/brainstem.mesh",
        rawUrl="/subregions/brainstem.bin",
        source=dict(
            url=URL, archiveSha256=SHA, niftiSha256=sha256(image_bytes), names=names,
            documentation="https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace",
            protocol="https://surfer.nmr.mgh.harvard.edu/fswiki/BrainstemSubstructures",
            paper="https://doi.org/10.1016/j.neuroimage.2015.02.065",
            license="/licenses/freesurfer.txt", shape=list(image.shape),
            affine=image.affine.tolist(),
            spacingMm=list(map(float, image.header.get_zooms()[:3])),
            frame="Approximately MNI-ICBM152 2009c symmetric; not registered to the fsaverage whole-brain model",
            method="Maximum-probability label per voxel, including background; marching cubes at 0.5 on each binary label; no additional smoothing or resampling; disconnected components retained",
            displayTransform="[R,S,-A], recentered for a standalone view",
            displayOrigin=origin,
        ),
        geometry=dict(
            bytes=len(raw), compressedBytes=len(compressed), sha256=sha256(raw),
            compressedSha256=sha256(compressed),
            triangles=sum(part["triangles"] for part in parts),
        ),
    )
    serialized = json.dumps(manifest, indent=2) + "\n"
    (ROOT / "src/brainstem-subregions.json").write_text(serialized)
    (OUT / "brainstem-provenance.json").write_text(serialized)
    print(manifest["geometry"])


if __name__ == "__main__":
    build()
