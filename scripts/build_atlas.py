"""Reproduce browser meshes from versioned FreeSurfer/Nilearn reference data."""

from pathlib import Path
import gzip, hashlib, json, tarfile, urllib.request
from concurrent.futures import ThreadPoolExecutor
import nibabel as nib
import numpy as np
from scipy.ndimage import gaussian_filter
from skimage.measure import marching_cubes

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "atlas"
OUT = ROOT / "public" / "models"
CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
NILEARN = "https://raw.githubusercontent.com/nilearn/nilearn/0.12.1/nilearn/datasets/data/fsaverage5/"
MNE = "https://raw.githubusercontent.com/mne-tools/mne-testing-data/33ef2a6f6345a1adf8764f8f63725f0ed9e4bb92/subjects/fsaverage/"
provenance = []
EXPECTED = json.loads((ROOT / "scripts" / "source-checksums.json").read_text())


def fetch(name, url):
    path = CACHE / name
    if not path.exists():
        urllib.request.urlretrieve(url, path)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if digest != EXPECTED[name]:
        raise ValueError(f"Input checksum mismatch: {name}")
    provenance.append({"file": name, "url": url, "sha256": digest})
    return path


jobs = [
    (f"{kind}_{h}.gii.gz", NILEARN + f"{kind}_{h}.gii.gz")
    for kind in ["pial", "sulc"]
    for h in ["left", "right"]
]
jobs += [(f"{h}.aparc.annot", MNE + f"label/{h}.aparc.annot") for h in ["lh", "rh"]]
jobs += [("aseg.mgz", MNE + "mri/aseg.mgz")]
with ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(lambda job: fetch(*job), jobs))

lobes = {
    "Frontal": [
        "caudalmiddlefrontal",
        "frontalpole",
        "lateralorbitofrontal",
        "medialorbitofrontal",
        "paracentral",
        "parsopercularis",
        "parsorbitalis",
        "parstriangularis",
        "precentral",
        "rostralmiddlefrontal",
        "superiorfrontal",
    ],
    "Parietal": [
        "inferiorparietal",
        "postcentral",
        "precuneus",
        "superiorparietal",
        "supramarginal",
    ],
    "Temporal": [
        "bankssts",
        "entorhinal",
        "fusiform",
        "inferiortemporal",
        "middletemporal",
        "parahippocampal",
        "superiortemporal",
        "temporalpole",
        "transversetemporal",
    ],
    "Occipital": ["cuneus", "lateraloccipital", "lingual", "pericalcarine"],
    "Limbic": [
        "caudalanteriorcingulate",
        "isthmuscingulate",
        "posteriorcingulate",
        "rostralanteriorcingulate",
    ],
    "Insula": ["insula"],
}
names = {
    "bankssts": "Banks of the superior temporal sulcus",
    "caudalanteriorcingulate": "Caudal anterior cingulate",
    "caudalmiddlefrontal": "Caudal middle frontal gyrus",
    "cuneus": "Cuneus",
    "entorhinal": "Entorhinal cortex",
    "frontalpole": "Frontal pole",
    "fusiform": "Fusiform gyrus",
    "inferiorparietal": "Inferior parietal lobule",
    "inferiortemporal": "Inferior temporal gyrus",
    "insula": "Insular cortex",
    "isthmuscingulate": "Isthmus of the cingulate",
    "lateraloccipital": "Lateral occipital cortex",
    "lateralorbitofrontal": "Lateral orbitofrontal cortex",
    "lingual": "Lingual gyrus",
    "medialorbitofrontal": "Medial orbitofrontal cortex",
    "middletemporal": "Middle temporal gyrus",
    "paracentral": "Paracentral lobule",
    "parahippocampal": "Parahippocampal gyrus",
    "parsopercularis": "Pars opercularis",
    "parsorbitalis": "Pars orbitalis",
    "parstriangularis": "Pars triangularis",
    "pericalcarine": "Pericalcarine cortex",
    "postcentral": "Postcentral gyrus",
    "posteriorcingulate": "Posterior cingulate cortex",
    "precentral": "Precentral gyrus",
    "precuneus": "Precuneus",
    "rostralanteriorcingulate": "Rostral anterior cingulate",
    "rostralmiddlefrontal": "Rostral middle frontal gyrus",
    "superiorfrontal": "Superior frontal gyrus",
    "superiorparietal": "Superior parietal lobule",
    "superiortemporal": "Superior temporal gyrus",
    "supramarginal": "Supramarginal gyrus",
    "temporalpole": "Temporal pole",
    "transversetemporal": "Transverse temporal gyrus",
}
colors = {
    "Frontal": "#a5bc90",
    "Parietal": "#d7bc7a",
    "Temporal": "#c7927a",
    "Occipital": "#b2a2cc",
    "Limbic": "#82b7ae",
    "Insula": "#bdad80",
    "Deep structures": "#d3a391",
    "Cerebellum": "#b8a6a0",
    "Brainstem": "#b6ac82",
    "Ventricles": "#85bfd3",
    "White matter": "#e1dac3",
}
archive = fetch("fsaverage6.tar.gz", "https://osf.io/jzxyr/download")
with tarfile.open(archive) as tar:
    for name in [
        "pial_left.gii.gz",
        "pial_right.gii.gz",
        "sulc_left.gii.gz",
        "sulc_right.gii.gz",
    ]:
        (CACHE / ("hi_" + name)).write_bytes(tar.extractfile(name).read())
parts = []
blob = bytearray()


def normals(v, f):
    n = np.zeros_like(v)
    face = np.cross(v[f[:, 1]] - v[f[:, 0]], v[f[:, 2]] - v[f[:, 0]])
    for i in range(3):
        np.add.at(n, f[:, i], face)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-30)


def pack(v, f, n, s):
    # All typed arrays are aligned to four bytes for direct browser views.
    arrays = [
        np.asarray(v, dtype="<f4"),
        np.asarray(n, dtype="<f4"),
        np.asarray(s, dtype="<f4"),
        np.asarray(f, dtype="<u4"),
    ]
    return b"".join(x.tobytes() for x in arrays)


def encode(v, f, n=None, s=None):
    # FreeSurfer surface RAS -> right-handed renderer: x=right, y=superior, z=anterior.
    v = np.asarray(v, dtype=np.float32)[:, [0, 2, 1]]
    v[:, 2] *= -1  # z points posterior; anterior is toward -z.
    if n is None:
        n = normals(v, f)
    else:
        n = n[:, [0, 2, 1]].copy()
        n[:, 2] *= -1
    if s is None:
        s = np.ones(len(v), dtype=np.float32)
    return pack(v, f, n, s), v


def add(part, v, f, n=None, s=None, detail=None):
    data, v = encode(v, f, n, s)
    if detail is not None:
        dv, df, dn, ds = detail
        detail_data, _ = encode(dv, df, dn, ds)
        filename = part["id"] + ".bin"
        (OUT / filename).write_bytes(detail_data)
        part["detail"] = {
            "url": "/models/" + filename,
            "vertices": len(dv),
            "triangles": len(df),
        }
    part.update(
        offset=len(blob),
        vertices=len(v),
        triangles=len(f),
        center=np.round(v.mean(axis=0), 3).tolist(),
    )
    blob.extend(data)
    parts.append(part)


for hemi, side in [("left", "lh"), ("right", "rh")]:
    surface = nib.load(CACHE / f"pial_{hemi}.gii.gz")
    v, f = surface.darrays[0].data, surface.darrays[1].data
    n = normals(v, f)
    sulc = nib.load(CACHE / f"sulc_{hemi}.gii.gz").darrays[0].data
    shade = np.clip(0.87 - sulc * 0.13, 0.54, 1.0)
    labels, ctab, rawnames = nib.freesurfer.read_annot(CACHE / f"{side}.aparc.annot")
    assert len(labels) == 163842 and len(v) == 10242
    high = nib.load(CACHE / f"hi_pial_{hemi}.gii.gz")
    hv, hf = high.darrays[0].data, high.darrays[1].data
    hn = normals(hv, hf)
    hs = np.clip(
        0.87 - nib.load(CACHE / f"hi_sulc_{hemi}.gii.gz").darrays[0].data * 0.13,
        0.54,
        1.0,
    )
    hfl = labels[hf]
    high_face_label = np.where(hfl[:, 1] == hfl[:, 2], hfl[:, 1], hfl[:, 0])
    labels = labels[: len(v)]
    fl = labels[f]
    # Assign each complete triangle to one parcel, without gaps or duplicated faces.
    face_label = np.where(fl[:, 1] == fl[:, 2], fl[:, 1], fl[:, 0])
    for idx, raw in enumerate(rawnames):
        key = raw.decode()
        if key not in names:
            continue
        sf = f[face_label == idx]
        used, inverse = np.unique(sf, return_inverse=True)
        hsf = hf[high_face_label == idx]
        hused, hinverse = np.unique(hsf, return_inverse=True)
        detail = (hv[hused], hinverse.reshape(-1, 3), hn[hused], hs[hused])
        group = next(k for k, values in lobes.items() if key in values)
        add(
            {
                "id": f"{side}-{key}",
                "key": key,
                "name": names[key],
                "hemisphere": hemi,
                "group": group,
                "color": colors[group],
                "kind": "cortex",
                "source": "dk",
            },
            v[used],
            inverse.reshape(-1, 3),
            n[used],
            shade[used],
            detail=detail,
        )

labels = {
    2: ("Cerebral white matter", "White matter", "left"),
    4: ("Lateral ventricle", "Ventricles", "left"),
    5: ("Inferior lateral ventricle", "Ventricles", "left"),
    7: ("Cerebellar white matter", "White matter", "left"),
    8: ("Cerebellar cortex", "Cerebellum", "left"),
    10: ("Thalamus", "Deep structures", "left"),
    11: ("Caudate nucleus", "Deep structures", "left"),
    12: ("Putamen", "Deep structures", "left"),
    13: ("Globus pallidus", "Deep structures", "left"),
    14: ("Third ventricle", "Ventricles", "midline"),
    15: ("Fourth ventricle", "Ventricles", "midline"),
    16: ("Brainstem", "Brainstem", "midline"),
    17: ("Hippocampus", "Deep structures", "left"),
    18: ("Amygdala", "Deep structures", "left"),
    26: ("Nucleus accumbens", "Deep structures", "left"),
    28: ("Ventral diencephalon", "Deep structures", "left"),
    31: ("Choroid plexus", "Ventricles", "left"),
    41: ("Cerebral white matter", "White matter", "right"),
    43: ("Lateral ventricle", "Ventricles", "right"),
    44: ("Inferior lateral ventricle", "Ventricles", "right"),
    46: ("Cerebellar white matter", "White matter", "right"),
    47: ("Cerebellar cortex", "Cerebellum", "right"),
    49: ("Thalamus", "Deep structures", "right"),
    50: ("Caudate nucleus", "Deep structures", "right"),
    51: ("Putamen", "Deep structures", "right"),
    52: ("Globus pallidus", "Deep structures", "right"),
    53: ("Hippocampus", "Deep structures", "right"),
    54: ("Amygdala", "Deep structures", "right"),
    58: ("Nucleus accumbens", "Deep structures", "right"),
    60: ("Ventral diencephalon", "Deep structures", "right"),
    63: ("Choroid plexus", "Ventricles", "right"),
    251: ("Corpus callosum · posterior", "White matter", "midline"),
    252: ("Corpus callosum · mid-posterior", "White matter", "midline"),
    253: ("Corpus callosum · central", "White matter", "midline"),
    254: ("Corpus callosum · mid-anterior", "White matter", "midline"),
    255: ("Corpus callosum · anterior", "White matter", "midline"),
}
img = nib.load(CACHE / "aseg.mgz")
seg = np.asarray(img.dataobj)
transform = img.header.get_vox2ras_tkr()
for value, (name, group, hemi) in labels.items():
    mask = seg == value
    if mask.sum() < 20:
        continue
    indices = np.argwhere(mask)
    lo = np.maximum(indices.min(axis=0) - 2, 0)
    hi = np.minimum(indices.max(axis=0) + 3, mask.shape)
    crop = mask[tuple(slice(a, b) for a, b in zip(lo, hi))].astype(np.float32)
    crop = gaussian_filter(crop, 0.65)
    step = 2 if mask.sum() > 1000 else 1
    v, f, _, _ = marching_cubes(crop, 0.45, step_size=step, allow_degenerate=False)
    v = nib.affines.apply_affine(transform, v + lo)
    # marching_cubes normals face inward by default with this segmentation.
    f = f[:, [0, 2, 1]]
    dv, df, _, _ = marching_cubes(crop, 0.45, step_size=1, allow_degenerate=False)
    dv = nib.affines.apply_affine(transform, dv + lo)
    df = df[:, [0, 2, 1]]
    key = name.lower().replace(" · ", "-").replace(" ", "-")
    add(
        {
            "id": f"aseg-{value}",
            "key": key,
            "name": name,
            "hemisphere": hemi,
            "group": group,
            "color": colors[group],
            "kind": "segmentation",
            "source": "aseg",
            "label": value,
        },
        v,
        f,
        detail=(dv, df, None, None),
    )

(OUT / "atlas.bin").write_bytes(blob)
(OUT / "atlas.mesh").write_bytes(gzip.compress(bytes(blob), compresslevel=9, mtime=0))
manifest = {
    "version": 1,
    "coordinateSystem": "FreeSurfer surface RAS; display transform [R,S,-A]",
    "parts": parts,
    "groups": colors,
    "totalTriangles": sum(p["triangles"] for p in parts),
    "sources": sorted(provenance, key=lambda x: x["file"]),
}
manifest_json = json.dumps(manifest, separators=(",", ":"))
(OUT / "atlas.json").write_text(manifest_json)
(ROOT / "src" / "atlas-manifest.json").write_text(manifest_json)
print(
    json.dumps(
        {
            "parts": len(parts),
            "triangles": manifest["totalTriangles"],
            "bytes": len(blob),
        }
    )
)
