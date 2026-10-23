"""Build coordinate-based activity meta-analyses and an anatomical label grid for comparisons.

Inputs are the pinned NeuroQuery corpus (BSD-3-Clause) and the pinned fsaverage files used by
build_atlas.py. Each catalogue activity is compared with every other corpus study using NiMARE's
multilevel kernel density chi-square analysis (10 mm kernel), then corrected with Benjamini-Hochberg
FDR at q < 0.01. Run with Python 3.12 and scripts/requirements-activity.txt.
"""

from pathlib import Path
import gzip, hashlib, json, logging, tarfile, time, urllib.request, warnings
import nibabel as nib
import numpy as np
import pandas as pd
import scipy.sparse as sp
from scipy.spatial import cKDTree

warnings.filterwarnings("ignore")
logging.getLogger("nimare").setLevel(logging.ERROR)
from nimare.correct import FDRCorrector  # noqa: E402
from nimare.dataset import Dataset  # noqa: E402
from nimare.meta.cbma import MKDAChi2  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache" / "activity"
ATLAS_CACHE = ROOT / ".cache" / "atlas"
OUT = ROOT / "public" / "activity"
CACHE.mkdir(parents=True, exist_ok=True)
ATLAS_CACHE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)

NQ_COMMIT = "4580f86267fb7c14ac1f601e298cbed898d79f2d"
NQ = f"https://raw.githubusercontent.com/neuroquery/neuroquery_data/{NQ_COMMIT}/"
NQ_FILES = {
    "nq_coordinates.tsv.gz": "data/data-neuroquery_version-1_coordinates.tsv.gz",
    "nq_metadata.tsv.gz": "data/data-neuroquery_version-1_metadata.tsv.gz",
    "nq_vocabulary.txt": "data/data-neuroquery_version-1_vocab-neuroquery156521_vocabulary.txt",
    "nq_abstract.npz": "data/data-neuroquery_version-1_vocab-neuroquery156521_source-abstract_type-count_features.npz",
    "nq_title.npz": "data/data-neuroquery_version-1_vocab-neuroquery156521_source-title_type-count_features.npz",
    "nq_keywords.npz": "data/data-neuroquery_version-1_vocab-neuroquery156521_source-keywords_type-count_features.npz",
    "nq_LICENSE": "LICENSE",
}
MNE = "https://raw.githubusercontent.com/mne-tools/mne-testing-data/33ef2a6f6345a1adf8764f8f63725f0ed9e4bb92/subjects/fsaverage/"
FSAVERAGE6 = "https://osf.io/jzxyr/download"
SHAPE = (97, 115, 97)
AFFINE = np.array([[2, 0, 0, -96], [0, 2, 0, -132], [0, 0, 2, -78], [0, 0, 0, 1]], dtype=float)
# NiMARE's MNI152 2 mm template grid starts three voxels inside the shared imaging grid.
NIMARE_OFFSET = 3
# FreeSurfer's MNI305 (fsaverage) to MNI152 transform:
# https://surfer.nmr.mgh.harvard.edu/fswiki/CoordinateSystems (section 8).
MNI305_TO_152 = np.array(
    [
        [0.9975, -0.0073, 0.0176, -0.0429],
        [0.0146, 1.0009, -0.0024, 1.5496],
        [-0.0130, -0.0093, 0.9971, 1.1840],
        [0, 0, 0, 1],
    ]
)
KERNEL_MM = 10
FDR_Q = 0.01
MIN_STUDIES = 30

checksums_path = ROOT / "scripts" / "activity-checksums.json"
expected = json.loads(checksums_path.read_text()) if checksums_path.exists() else {}
atlas_expected = json.loads((ROOT / "scripts" / "source-checksums.json").read_text())
provenance = []


def fetch(name, url, folder=CACHE, known=None):
    path = folder / name
    if not path.exists():
        request = urllib.request.Request(url, headers={"User-Agent": "Cerebra educational atlas/1.0"})
        with urllib.request.urlopen(request, timeout=300) as response:
            path.write_bytes(response.read())
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    reference = (known or expected).get(name)
    if reference and digest != reference:
        raise ValueError(f"Input checksum mismatch: {name}")
    provenance.append({"file": name, "url": url, "sha256": digest})
    return path


def encode(blocks, name):
    raw = b"".join(np.asarray(block, dtype=dtype).tobytes(order="F") for block, dtype in blocks)
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    (OUT / name).write_bytes(packed)
    return {
        "url": f"/activity/{name}",
        "bytes": len(packed),
        "rawBytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
    }


def label_grid(parts):
    """Assign each shared 2 mm MNI152 voxel to an atlas part, via fsaverage (MNI305) labels."""
    aseg_path = fetch("aseg.mgz", MNE + "mri/aseg.mgz", ATLAS_CACHE, atlas_expected)
    archive = fetch("fsaverage6.tar.gz", FSAVERAGE6, ATLAS_CACHE, atlas_expected)
    image = nib.load(aseg_path)
    aseg = np.asarray(image.dataobj)
    to_voxel = np.linalg.inv(image.affine) @ np.linalg.inv(MNI305_TO_152)
    index = np.indices(SHAPE).reshape(3, -1).T
    centers = nib.affines.apply_affine(AFFINE, index)
    # Majority label of eight 1 mm subsamples inside each 2 mm voxel.
    samples = []
    for offset in np.array(np.meshgrid([-0.5, 0.5], [-0.5, 0.5], [-0.5, 0.5])).reshape(3, -1).T:
        voxel = np.rint(nib.affines.apply_affine(to_voxel, centers + offset)).astype(int)
        inside = np.all((voxel >= 0) & (voxel < aseg.shape), axis=1)
        values = np.zeros(len(voxel), dtype=np.int32)
        values[inside] = aseg[tuple(voxel[inside].T)]
        samples.append(values)
    samples = np.stack(samples)
    candidates = np.unique(samples)
    counts = np.stack([(samples == value).sum(axis=0) for value in candidates])
    labels = candidates[np.argmax(counts, axis=0)]
    lookup = {}
    for number, part in enumerate(parts, start=1):
        if part["source"] == "aseg":
            lookup[part["label"]] = number
    grid = np.zeros(len(labels), dtype=np.uint8)
    for value, number in lookup.items():
        grid[labels == value] = number
    # Cortical ribbon voxels (aseg 3/42) take the Desikan-Killiany label of the nearest pial vertex.
    with tarfile.open(archive) as tar:
        for hemi, side, ribbon in [("left", "lh", 3), ("right", "rh", 42)]:
            pial_name = f"hi_pial_{hemi}.gii.gz"
            surface_path = ATLAS_CACHE / pial_name
            if not surface_path.exists():
                surface_path.write_bytes(tar.extractfile(f"pial_{hemi}.gii.gz").read())
            surface = nib.load(surface_path)
            vertices = surface.darrays[0].data
            annot = fetch(f"{side}.aparc.annot", MNE + f"label/{side}.aparc.annot", ATLAS_CACHE, atlas_expected)
            vertex_labels, _, names = nib.freesurfer.read_annot(annot)
            vertex_labels = vertex_labels[: len(vertices)]
            numbers = {
                index: next((n for n, p in enumerate(parts, 1) if p["id"] == f"{side}-{name.decode()}"), 0)
                for index, name in enumerate(names)
            }
            numbers[-1] = 0
            mask = labels == ribbon
            mni305 = nib.affines.apply_affine(np.linalg.inv(MNI305_TO_152), centers[mask])
            _, nearest = cKDTree(vertices).query(mni305)
            grid[mask] = np.array([numbers[int(v)] for v in vertex_labels[nearest]], dtype=np.uint8)
    return grid.reshape(SHAPE)


def selections(paths, catalog, metadata):
    """Studies whose title, abstract, or keywords contain any of an activity's terms."""
    vocabulary = {term.strip(): i for i, term in enumerate(paths["nq_vocabulary.txt"].read_text().splitlines())}
    features = [sp.load_npz(paths[f"nq_{source}.npz"]).tocsc() for source in ["abstract", "title", "keywords"]]
    chosen = {}
    for activity in catalog["activities"]:
        selected = np.zeros(len(metadata), dtype=bool)
        for term in activity["terms"]:
            column = vocabulary[term]
            selected |= np.asarray(sum((matrix[:, column] > 0).astype(np.int32) for matrix in features).todense()).ravel() > 0
        chosen[activity["id"]] = selected
    return chosen


def write_studies(metadata, chosen):
    lists = {key: [int(pmid) for pmid in metadata.id[selected]] for key, selected in chosen.items()}
    used = sorted({pmid for pmids in lists.values() for pmid in pmids})
    titles = dict(zip(metadata.id.astype(int), metadata.title))
    (OUT / "studies.json").write_text(
        json.dumps({"lists": lists, "titles": {str(pmid): titles[pmid] for pmid in used}}, separators=(",", ":"), ensure_ascii=False)
    )


def build(studies_only=False):
    started = time.time()
    paths = {name: fetch(name, NQ + remote) for name, remote in NQ_FILES.items()}
    (ROOT / "public" / "licenses" / "neuroquery-data.txt").write_bytes(paths["nq_LICENSE"].read_bytes())
    catalog = json.loads((ROOT / "scripts" / "activity-catalog.json").read_text())
    atlas = json.loads((ROOT / "src" / "atlas-manifest.json").read_text())
    coordinates = pd.read_csv(paths["nq_coordinates.tsv.gz"], sep="\t")
    metadata = pd.read_csv(paths["nq_metadata.tsv.gz"], sep="\t")
    chosen = selections(paths, catalog, metadata)
    write_studies(metadata, chosen)
    if studies_only:
        return
    studies = {}
    for pmid, rows in coordinates.groupby("id"):
        studies[str(pmid)] = {
            "contrasts": {
                "1": {"coords": {"space": "MNI", "x": rows.x.tolist(), "y": rows.y.tolist(), "z": rows.z.tolist()}}
            }
        }
    dataset = Dataset(studies)
    ids = np.array([f"{pmid}-1" for pmid in metadata.id])
    print(f"corpus {len(ids)} studies, {len(coordinates)} coordinates", flush=True)

    grid = label_grid(atlas["parts"])
    labels_asset = encode([(grid, "u1")], "labels.volume")
    template_mask = np.zeros(SHAPE, dtype=bool)

    records = []
    for activity in catalog["activities"]:
        selected = chosen[activity["id"]]
        count = int(selected.sum())
        if count < MIN_STUDIES:
            raise ValueError(f"{activity['id']} has only {count} studies")
        result = MKDAChi2(kernel__r=KERNEL_MM).fit(dataset.slice(ids[selected].tolist()), dataset.slice(ids[~selected].tolist()))
        corrected = FDRCorrector(method="indep", alpha=FDR_Q).transform(result)
        volumes = {}
        for key, name in [
            ("z_desc-uniformity", "zU"),
            ("p_desc-uniformity_level-voxel_corr-FDR_method-indep", "qU"),
            ("z_desc-association", "zA"),
            ("p_desc-association_level-voxel_corr-FDR_method-indep", "qA"),
            ("prob_desc-AgF", "pAgF"),
        ]:
            data = corrected.get_map(key, return_type="image").get_fdata()
            padded = np.zeros(SHAPE)
            o = NIMARE_OFFSET
            padded[o : o + data.shape[0], o : o + data.shape[1], o : o + data.shape[2]] = data
            volumes[name] = np.nan_to_num(padded)
        if not template_mask.any():
            template_mask = volumes["pAgF"] > 0
        summary = {}
        stored = []
        for test, z_key, q_key in [("consistency", "zU", "qU"), ("specificity", "zA", "qA")]:
            significant = (volumes[q_key] < FDR_Q) & (volumes[z_key] > 0)
            z = np.where(significant, volumes[z_key], 0)
            stored.append((np.rint(np.clip(z * 100, 0, 32767)), "<i2"))
            peak = np.unravel_index(np.argmax(z), SHAPE)
            summary[test] = {
                "voxels": int(significant.sum()),
                "cutoff": round(float(z[significant].min()), 2) if significant.any() else None,
                "peakVoxel": [int(v) for v in peak],
                "peakZ": round(float(z[peak]), 2),
            }
        proportion = volumes["pAgF"]
        stored.append((np.rint(np.clip(proportion * 200, 0, 255)), "u1"))
        peak = np.unravel_index(np.argmax(proportion), SHAPE)
        asset = encode(stored, f"{activity['id']}.maps")
        records.append(
            {
                **activity,
                "kind": "meta-analysis",
                "studies": count,
                "maps": summary,
                "peakProportion": round(float(proportion[peak]), 3),
                "peakProportionVoxel": [int(v) for v in peak],
                "asset": asset,
            }
        )
        print(
            f"{activity['id']}: {count} studies, {summary['consistency']['voxels']} consistent, "
            f"{summary['specificity']['voxels']} specific voxels, {asset['bytes']} bytes, {time.time() - started:.0f}s",
            flush=True,
        )

    parts = [{"id": p["id"], "name": p["name"], "hemisphere": p["hemisphere"], "group": p["group"]} for p in atlas["parts"]]
    manifest = {
        "checkedOn": catalog["checkedOn"],
        "grid": {
            "shape": list(SHAPE),
            "origin": [-96, -132, -78],
            "spacing": [2, 2, 2],
            "orientation": "RAS+",
            "order": "x-fastest (Fortran)",
            "space": "MNI152 (NiMARE 2 mm template grid, padded to the shared imaging grid)",
        },
        "layout": [
            {"name": "consistency", "dtype": "<i2", "scale": 0.01, "meaning": "FDR-significant positive uniformity z; zero elsewhere"},
            {"name": "specificity", "dtype": "<i2", "scale": 0.01, "meaning": "FDR-significant positive association z; zero elsewhere"},
            {"name": "proportion", "dtype": "u1", "scale": 0.005, "meaning": "Proportion of selected studies with a reported peak within 10 mm"},
        ],
        "method": {
            "corpus": (
                "NeuroQuery version 1 corpus: 13,459 articles with extracted peak coordinates. The corpus treats all "
                "coordinates as MNI, although some articles report Talairach coordinates (differences of up to about 1 cm)."
            ),
            "corpusSource": f"https://github.com/neuroquery/neuroquery_data/tree/{NQ_COMMIT}",
            "corpusLicense": "BSD-3-Clause",
            "corpusReference": "https://doi.org/10.7554/eLife.53385",
            "selection": catalog["selection"],
            "estimator": f"NiMARE MKDAChi2, binary {KERNEL_MM} mm spheres; selected studies compared with all remaining corpus studies",
            "correction": f"Benjamini-Hochberg FDR, q < {FDR_Q}, two-sided; positive effects retained",
            "software": "NiMARE 0.22.1",
            "softwareReference": "https://doi.org/10.52294/001c.87681",
            "minimumStudies": MIN_STUDIES,
        },
        "labels": {
            "asset": labels_asset,
            "parts": parts,
            "method": (
                "fsaverage aseg labels (MNI305) mapped to the 2 mm MNI152 grid with FreeSurfer's "
                "MNI305-to-MNI152 matrix, using the majority of eight 1 mm subsamples. Cortical ribbon voxels "
                "take the Desikan-Killiany label of the nearest fsaverage6 pial vertex."
            ),
            "mni305ToMni152": MNI305_TO_152.tolist(),
        },
        "activities": records,
        "sources": sorted(provenance, key=lambda item: item["file"]),
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
    checksums_path.write_text(
        json.dumps({p["file"]: p["sha256"] for p in sorted(provenance, key=lambda item: item["file"]) if p["file"].startswith("nq_")}, indent=2)
        + "\n"
    )
    print("BUILT", len(records), "activities", sum(r["asset"]["bytes"] for r in records), "bytes", flush=True)


if __name__ == "__main__":
    import sys

    build(studies_only="--studies" in sys.argv)
