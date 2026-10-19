"""Derive standalone surfaces from FreeSurfer's documented MNI probability atlas."""

from pathlib import Path
import gzip
import hashlib
import json
import urllib.request
import zipfile

import nibabel as nib
import numpy as np
from skimage.measure import marching_cubes

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
    labels = probs.argmax(axis=3)
    surfaces = []
    for channel, *_ in ENTRIES:
        vertices, faces, _, _ = marching_cubes(
            (labels == channel).astype(np.float32), level=0.5
        )
        ras = nib.affines.apply_affine(image.affine, vertices)
        display = ras[:, [0, 2, 1]]
        display[:, 2] *= -1
        surfaces.append((display, faces))
    all_vertices = np.concatenate([vertices for vertices, _ in surfaces])
    origin = (all_vertices.min(axis=0) + all_vertices.max(axis=0)) / 2
    blob = bytearray()
    parts = []
    for entry, (vertices, faces) in zip(ENTRIES, surfaces):
        channel, label, key, name, color, description = entry
        vertices = vertices - origin + np.array([0, 5, 10])
        normals = np.zeros_like(vertices)
        cross = np.cross(
            vertices[faces[:, 1]] - vertices[faces[:, 0]],
            vertices[faces[:, 2]] - vertices[faces[:, 0]],
        )
        for corner in range(3):
            np.add.at(normals, faces[:, corner], cross)
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-30)
        arrays = [
            vertices.astype("<f4"), normals.astype("<f4"),
            np.ones(len(vertices), dtype="<f4"), faces.astype("<u4"),
        ]
        parts.append(dict(
            id=key, key=key, name=name, hemisphere="bilateral" if key == "scp" else "midline", group="Brainstem",
            kind="segmentation", source="probability-atlas", color=color,
            label=label, channel=channel, description=description, offset=len(blob),
            vertices=len(vertices), triangles=len(faces),
            voxels=int((labels == channel).sum()),
            center=vertices.mean(axis=0).round(3).tolist(),
        ))
        blob.extend(b"".join(array.tobytes() for array in arrays))
    raw = bytes(blob)
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
            displayOrigin=origin.tolist(),
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
