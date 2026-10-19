"""Summarize pinned source probabilities without modifying atlas surfaces."""
from pathlib import Path
import gzip
import hashlib
import json
import zipfile

import nibabel as nib
import numpy as np
from hippo_amygdala_source import load_source

ROOT = Path(__file__).resolve().parents[1]
KINDS = ['brainstem', 'thalamus', 'amygdala', 'hippocampus']
BINS = [0, 0.25, 0.5, 0.75, 1]


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def summarize(probs, affine, entries, names):
    winners = probs.argmax(axis=3)
    rows = [line.split(',') for line in names.splitlines() if line.strip()]
    result = {}
    for entry in entries:
        channel = entry['channel']
        values = probs[..., channel]
        mask_values = values[winners == channel]
        if mask_values.size != entry['voxels']:
            raise ValueError(f"Winner count changed for {entry['id']}")
        index = tuple(int(i) for i in np.unravel_index(values.argmax(), values.shape))
        peak = float(values[index])
        if 'maxProbability' in entry and peak != entry['maxProbability']:
            raise ValueError('Peak probability changed')
        sample = probs[index].copy()
        sample[channel] = -np.inf
        other = int(sample.argmax())
        counts = np.histogram(mask_values, [-np.inf, *BINS[1:-1], np.inf])[0]
        result[entry['id']] = dict(
            channel=channel, label=entry['label'], voxels=int(mask_values.size),
            winningProbabilityBins=counts.tolist(),
            winningProbabilityRange=[float(mask_values.min()), float(mask_values.max())] if mask_values.size else None,
            peak=dict(
                probability=peak, index=list(index),
                rasMm=nib.affines.apply_affine(affine, index).tolist(),
                selectedWins=bool(winners[index] == channel),
                winnerChannel=int(winners[index]),
                strongestOther=dict(channel=other, label=int(rows[other][0]),
                                    sourceName=rows[other][1], probability=float(probs[index][other])),
            ),
        )
    return result


def load_single(kind, source):
    stem = 'Brainstem' if kind == 'brainstem' else 'Thalamus'
    archive = ROOT / f'.cache/subregions/{stem}.zip'
    if sha256(archive.read_bytes()) != source['archiveSha256']:
        raise ValueError('Source archive checksum changed')
    with zipfile.ZipFile(archive) as files:
        names = files.read(f'{stem}Probs.MNIsymSpace.names.txt').decode()
        raw = files.read(f'{stem}Probs.MNIsymSpace.nii.gz')
    if names != source['names'] or sha256(raw) != source['niftiSha256']:
        raise ValueError('Source NIfTI or channel table changed')
    image = nib.Nifti1Image.from_bytes(gzip.decompress(raw))
    probs = image.get_fdata(dtype=np.float32)
    if (list(image.shape) != source['shape']
            or not np.array_equal(image.affine, source['affine'])
            or not np.isfinite(probs).all()
            or probs.min() < -1e-6 or probs.max() > 1 + 1e-6
            or not np.allclose(probs.sum(axis=3), 1, atol=1e-6, rtol=0)):
        raise ValueError('Invalid source probabilities or frame')
    return image, probs, names


def build():
    atlases = {kind: json.loads((ROOT / f'src/{kind}-subregions.json').read_text()) for kind in KINDS}
    records = {kind: {} for kind in KINDS}
    for kind in ['brainstem', 'thalamus']:
        atlas = atlases[kind]
        image, probs, names = load_single(kind, atlas['source'])
        entries = atlas['parts'] + atlas.get('omitted', [])
        records[kind] = summarize(probs, image.affine, entries, names)
        del probs, image
    for side in ['left', 'right']:
        image, probs, names, volume = load_source(side)
        for kind in ['amygdala', 'hippocampus']:
            atlas = atlases[kind]
            if volume != atlas['source']['volumes'][side] or names != atlas['source']['names']:
                raise ValueError('Pinned hippocampus/amygdala source changed')
            entries = [part for part in atlas['parts'] if part['hemisphere'] == side]
            records[kind].update(summarize(probs, image.affine, entries, names))
        del probs, image
    for kind, atlas in atlases.items():
        source = atlas['source']
        output = dict(
            version=1, kind=kind, checkedOn='2026-10-19', binEdges=BINS,
            method='Cerebra-derived statistics from unmodified float32 source probabilities. Winner assignment compares every channel, including unknown/background and sibling structures; ties use first source channel. Bins are [0,.25), [.25,.5), [.5,.75), [.75,1], with floating-point tolerance retained in end bins. Peak is the first C-order maximum of the selected channel over its entire grid, not necessarily a winning voxel. Strongest other excludes only that channel. Indices are zero-based in the original grid; RAS is source millimeters, not the recentered display. No resampling, probability thresholding, or calibration of boundary accuracy.',
            source=dict(
                manifest=f'/subregions/{kind}-provenance.json',
                manifestSha256=sha256((ROOT / f'src/{kind}-subregions.json').read_bytes()),
                archiveSha256=source['archiveSha256'],
                niftiSha256={side: volume['sha256'] for side, volume in source['volumes'].items()} if 'volumes' in source else {'both': source['niftiSha256']},
                documentation=source['documentation'], paper=source['paper'], license=source['license'],
                attribution='Modified FreeSurfer data. All or portions obtained under license from The General Hospital Corporation (MGH); full terms retained in the linked license.',
            ),
            entries=records[kind],
        )
        path = ROOT / f'public/subregions/{kind}-evidence.json'
        path.write_text(json.dumps(output, indent=2) + '\n')
        print(kind, len(output['entries']), path.stat().st_size, 'bytes')


if __name__ == '__main__':
    build()
