"""Build independently framed winner surfaces from the pinned FreeSurfer atlas."""
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
CACHE = ROOT / '.cache/subregions'
OUT = ROOT / 'public/subregions'
URL = ('https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace'
       '?action=AttachFile&do=get&target=Thalamus.zip')
SHA = 'd00485eb94ffebe642e11aaf19130b5d95f6773c93631b38e8e9c44e341006fb'
# Expanded names follow the original study's Table 2; source codes are retained.
NAMES = {
    'AV': ('Anteroventral', 'Anterior'),
    'LD': ('Laterodorsal', 'Lateral'),
    'LP': ('Lateral posterior', 'Lateral'),
    'VA': ('Ventral anterior', 'Ventral'),
    'VAmc': ('Ventral anterior magnocellular', 'Ventral'),
    'VLa': ('Ventral lateral anterior', 'Ventral'),
    'VLp': ('Ventral lateral posterior', 'Ventral'),
    'VPL': ('Ventral posterolateral', 'Ventral'),
    'VM': ('Ventromedial', 'Ventral'),
    'CeM': ('Central medial', 'Intralaminar'),
    'CL': ('Central lateral', 'Intralaminar'),
    'Pc': ('Paracentral', 'Intralaminar'),
    'CM': ('Centromedian', 'Intralaminar'),
    'Pf': ('Parafascicular', 'Intralaminar'),
    'Pt': ('Paratenial', 'Medial'),
    'MV(Re)': ('Reuniens (medial ventral)', 'Medial'),
    'MDm': ('Mediodorsal, medial magnocellular', 'Medial'),
    'MDl': ('Mediodorsal, lateral parvocellular', 'Medial'),
    'LGN': ('Lateral geniculate', 'Posterior'),
    'MGN': ('Medial geniculate', 'Posterior'),
    'L-Sg': ('Limitans (suprageniculate)', 'Posterior'),
    'PuA': ('Pulvinar anterior', 'Posterior'),
    'PuM': ('Pulvinar medial', 'Posterior'),
    'PuL': ('Pulvinar lateral', 'Posterior'),
    'PuI': ('Pulvinar inferior', 'Posterior'),
    'R': ('Reticular', 'Reticular'),
}
COLORS = {'Anterior': '#d5b27f', 'Lateral': '#a6c5ab', 'Ventral': '#8db8d1',
          'Intralaminar': '#c5a6d2', 'Medial': '#d5a6a0',
          'Posterior': '#b8bf83', 'Reticular': '#c9b8a0'}
CONVENTIONS = {
    'AV': 'This protocol also groups anterior medial and anterior dorsal territory within AV.',
    'VPL': 'This protocol includes ventral posteromedial (VPM) territory within VPL.',
    'LGN': 'This label is included here; the main thalamus-proper mesh excludes geniculate bodies.',
    'MGN': 'This label is included here; the main thalamus-proper mesh excludes geniculate bodies.',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    archive = CACHE / 'Thalamus.zip'
    if not archive.exists():
        urllib.request.urlretrieve(URL, archive)
    if sha256(archive.read_bytes()) != SHA:
        raise ValueError('Thalamic source archive checksum changed')
    with zipfile.ZipFile(archive) as source:
        names = source.read('ThalamusProbs.MNIsymSpace.names.txt').decode()
        image_bytes = source.read('ThalamusProbs.MNIsymSpace.nii.gz')
        image = nib.Nifti1Image.from_bytes(gzip.decompress(image_bytes))
    rows = [line.split(',') for line in names.splitlines() if line.strip()]
    if len(rows) != 53 or rows[0] != ['0', 'Unknown']:
        raise ValueError('Unexpected thalamic channel table')
    probs = image.get_fdata(dtype=np.float32)
    if not np.isfinite(probs).all() or not np.allclose(probs.sum(axis=3), 1, atol=1e-6):
        raise ValueError('Invalid label probabilities')
    entries = []
    for channel, (label, source_name) in enumerate(rows[1:], start=1):
        side, code = source_name.split('-', 1)
        name, group = NAMES[code]
        description = (f'{group}-group label in this atlas. '
                       + CONVENTIONS.get(code, 'Individual cells and connections are not represented.'))
        entries.append(dict(id=f'thal-{label}', key=code, name=name,
                            abbreviation=code, sourceName=source_name,
                            hemisphere=side.lower(), group=group, color=COLORS[group],
                            kind='segmentation', source='probability-atlas',
                            label=int(label), channel=channel, description=description))
    for entry in entries:
        if entry['key'] == 'VPL':
            entry['aliases'] = ['VPM', 'ventral posteromedial']
        elif entry['key'] == 'AV':
            entry['aliases'] = ['anteromedial', 'anterior medial', 'anterodorsal', 'anterior dorsal']
    raw, parts, omitted, origin = pack_surfaces(image, probs.argmax(axis=3), entries)
    for entry in omitted:
        entry['maxProbability'] = float(probs[..., entry['channel']].max())
    compressed = gzip.compress(raw, mtime=0)
    (OUT / 'thalamus.bin').write_bytes(raw)
    (OUT / 'thalamus.mesh').write_bytes(compressed)
    manifest = dict(
        version=1, title='Thalamic atlas subregions', checkedOn='2026-10-19',
        parts=parts, omitted=omitted, compressedUrl='/subregions/thalamus.mesh',
        rawUrl='/subregions/thalamus.bin',
        source=dict(
            url=URL, archiveSha256=SHA, niftiSha256=sha256(image_bytes), names=names,
            documentation='https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace',
            protocol='https://surfer.nmr.mgh.harvard.edu/fswiki/ThalamicNuclei',
            paper='https://doi.org/10.1016/j.neuroimage.2018.08.012',
            labelDefinitions='https://arxiv.org/html/1806.08634v1#Sx2.T2',
            license='/licenses/freesurfer.txt', shape=list(image.shape),
            affine=image.affine.tolist(), spacingMm=list(map(float, image.header.get_zooms()[:3])),
            frame='Approximately MNI-ICBM152 2009c symmetric; not registered to the fsaverage whole-brain model',
            method='Maximum-probability label per voxel, including unknown/background; marching cubes at 0.5 on each binary label; no additional smoothing or resampling; disconnected components retained; zero-winner labels omitted',
            displayTransform='[R,S,-A], recentered for a standalone view', displayOrigin=origin,
        ),
        geometry=dict(bytes=len(raw), compressedBytes=len(compressed), sha256=sha256(raw),
                      compressedSha256=sha256(compressed), triangles=sum(p['triangles'] for p in parts)),
    )
    serialized = json.dumps(manifest, indent=2) + '\n'
    (ROOT / 'src/thalamus-subregions.json').write_text(serialized)
    (OUT / 'thalamus-provenance.json').write_text(serialized)
    print(manifest['geometry'])
    print('Surfaces:', len(parts), 'labels without winner voxels:', len(omitted))


if __name__ == '__main__':
    build()
