#!/usr/bin/env python3
"""Build lazy Xtract tract maps on Cerebra's 2-mm MNI152 display grid."""

import csv
import gzip
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".cache/pandora"
OUTPUT = ROOT / "public/tractography/xtract"
COMMIT = "2caf44296666c13aa5c4d7d1c88d14fe553d9553"
SOURCE_FILES = {
    "Xtract.nii.gz": "0cd04c6a41910fe1a25bf0e28a9ae3f18c912819bc51025aecd648d430fd11aa",
    "Xtract_info.csv": "4c113b30ecea7df2905fa56d43ae95f492b38fe505104acb77bf2287630bf314",
    "license.txt": "cbd5af318286b74656f145dff5091907cc23d6d8c9ad09e0291ec2497792ba41",
}
SOURCE_PATHS = {
    "Xtract.nii.gz": "Xtract/Xtract.nii.gz",
    "Xtract_info.csv": "Xtract/Xtract_info.csv",
    "license.txt": "license.txt",
}
SOURCE_BASE = (
    "https://raw.githubusercontent.com/MASILab/Pandora-WhiteMatterAtlas/"
    f"{COMMIT}"
)
GRID = {
    "shape": [97, 115, 97],
    "origin": [-96.0, -132.0, -78.0],
    "spacing": [2.0, 2.0, 2.0],
    "orientation": "RAS+",
    "order": "x-fastest (Fortran)",
    "space": "MNI152 standard space",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_bytes(name: str) -> bytes:
    path = SOURCE / name
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        request = Request(
            f"{SOURCE_BASE}/{SOURCE_PATHS[name]}",
            headers={"User-Agent": "Cerebra-Xtract-atlas-builder"},
        )
        with urlopen(request, timeout=120) as response:
            path.write_bytes(response.read())
    data = path.read_bytes()
    if sha256(data) != SOURCE_FILES[name]:
        raise ValueError(f"Pinned source checksum mismatch: {name}")
    return data


def display_name(source_name: str) -> str:
    # The pinned source CSV misspells “fasciculus” twice as “Fascile”.
    return source_name.replace("Fascile", "Fasciculus")


def main() -> None:
    nifti_bytes = source_bytes("Xtract.nii.gz")
    csv_bytes = source_bytes("Xtract_info.csv")
    license_bytes = source_bytes("license.txt")
    image = nib.load(str(SOURCE / "Xtract.nii.gz"))
    if image.shape != (193, 229, 193, 42):
        raise ValueError(f"Unexpected Xtract source shape: {image.shape}")
    if image.get_data_dtype() != np.dtype("float32"):
        raise ValueError(f"Unexpected Xtract dtype: {image.get_data_dtype()}")
    expected_affine = np.eye(4)
    expected_affine[:3, 3] = [-96, -132, -78]
    if not np.array_equal(image.affine, expected_affine):
        raise ValueError("Xtract source affine changed")

    data = np.asanyarray(image.dataobj)
    expected_grid = tuple(GRID["shape"])
    if tuple(data[::2, ::2, ::2, 0].shape) != expected_grid:
        raise ValueError("The 1-mm source cannot be sampled onto the declared 2-mm grid")

    rows = list(csv.DictReader(csv_bytes.decode("utf-8").splitlines()))
    if len(rows) != 42 or [int(row["ID"]) for row in rows] != list(range(42)):
        raise ValueError("Pinned Xtract metadata must contain 42 ordered pathways")

    OUTPUT.mkdir(parents=True, exist_ok=True)
    channel_dir = OUTPUT / "channels"
    channel_dir.mkdir(exist_ok=True)
    # Remove the earlier .gz extension: static dev servers may set Content-Encoding
    # for that suffix, causing fetch to decompress before our streaming decoder.
    for stale_asset in channel_dir.glob("*.u16.gz"):
        stale_asset.unlink()
    channels = []
    for row in rows:
        channel = int(row["ID"])
        source_name = row["Bundle Name"]
        key = row["File Name"]
        values = np.asarray(data[::2, ::2, ::2, channel], dtype=np.float32)
        if not np.isfinite(values).all() or values.min() < 0 or values.max() > 1:
            raise ValueError(f"Invalid probability values in {source_name}")
        encoded = np.rint(values * 65535).astype("<u2", copy=False)
        raw = encoded.tobytes(order="F")
        compressed = gzip.compress(raw, compresslevel=9, mtime=0)
        filename = f"{key}.u16.bin"
        (channel_dir / filename).write_bytes(compressed)
        peak_index = tuple(int(value) for value in np.unravel_index(
            int(values.ravel(order="F").argmax()), values.shape, order="F"
        ))
        counts = {name: int(row[column]) for name, column in (
            ("hcp", "#HCP"), ("blsa", "#BLSA"), ("vu", "#VU"), ("subjects", "#ALL")
        )}
        if counts["subjects"] != counts["hcp"] + counts["blsa"] + counts["vu"]:
            raise ValueError(f"Subject counts do not sum for {source_name}")
        channels.append({
            "channel": channel,
            "id": key,
            "name": display_name(source_name),
            "sourceName": source_name,
            "subjects": counts,
            "nonzeroVoxelsAt2mm": int(np.count_nonzero(values)),
            "peak": {
                "index": list(peak_index),
                "probability": float(values[peak_index]),
                "rasMm": [
                    GRID["origin"][axis] + peak_index[axis] * GRID["spacing"][axis]
                    for axis in range(3)
                ],
            },
            "asset": {
                "url": f"/tractography/xtract/channels/{filename}",
                "bytes": len(compressed),
                "rawBytes": len(raw),
                "sha256": sha256(raw),
                "compressedSha256": sha256(compressed),
            },
        })

    display_license = license_bytes.replace(b"\r\n", b"\n")
    (OUTPUT / "LICENSE.txt").write_bytes(display_license)
    manifest = {
        "version": 1,
        "checkedOn": "2026-11-26",
        "title": "Xtract population white-matter pathway atlas",
        "grid": GRID,
        "sourceGrid": {
            "shape": [193, 229, 193],
            "origin": [-96.0, -132.0, -78.0],
            "spacing": [1.0, 1.0, 1.0],
        },
        "encoding": {
            "dtype": "uint16",
            "byteOrder": "little-endian",
            "order": "x-fastest (Fortran)",
            "compression": "gzip",
            "scale": 65535,
            "displayThresholdDefaultPercent": 5,
            "method": "Source values are sampled at every second voxel; values are rounded to uint16 with maximum quantization error below 0.000008.",
        },
        "channels": channels,
        "source": {
            "repository": "https://github.com/MASILab/Pandora-WhiteMatterAtlas",
            "commit": COMMIT,
            "nifti": f"{SOURCE_BASE}/{SOURCE_PATHS['Xtract.nii.gz']}",
            "metadata": f"{SOURCE_BASE}/{SOURCE_PATHS['Xtract_info.csv']}",
            "licenseFile": f"{SOURCE_BASE}/{SOURCE_PATHS['license.txt']}",
            "license": "CC BY 4.0",
            "paper": "https://doi.org/10.1007/s12021-020-09497-1",
            "method": "https://fsl.fmrib.ox.ac.uk/fsl/docs/diffusion/xtract.html",
            "niftiSha256": sha256(nifti_bytes),
            "metadataSha256": sha256(csv_bytes),
            "licenseSha256": sha256(license_bytes),
            "licenseDisplaySha256": sha256(display_license),
        },
        "attribution": "Pandora white matter atlas: Hansen et al. (2021), derived from CC BY 4.0 source data. Cerebra's 2-mm grid and uint16 files are marked modifications.",
        "interpretation": "Each value is a voxelwise population overlap from diffusion-MRI tractography. Contributors vary by bundle and are listed per pathway. These maps do not trace individual axons or measure an individual's tract certainty. The MNI152 maps are shown independently and are not overlaid on Cerebra's ICBM152 2009c MRI or its surface meshes.",
    }
    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    total = sum(channel["asset"]["bytes"] for channel in channels)
    print(f"Built {len(channels)} Xtract pathways ({total:,} compressed channel bytes)")


if __name__ == "__main__":
    main()
