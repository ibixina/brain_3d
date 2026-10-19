"""Derive an independent cerebellar model from the published Diedrichsen label map."""
from pathlib import Path
import csv
import gzip
import hashlib
import io
import json
import urllib.request

import nibabel as nib
import numpy as np
from subregion_geometry import pack_surfaces

ROOT = Path(__file__).resolve().parents[1]
COMMIT = '6857dfa732de6dd60c94da2f84d0b15ccf316618'
BASE = f'https://raw.githubusercontent.com/DiedrichsenLab/cerebellar_atlases/{COMMIT}/'
FILES = {
    'atl-Anatom_space-MNISym_dseg.nii': '3749c701422f10d6b5153bfd467a2f115be485a065178e7d4ee89f48e1ccb5fa',
    'atl-Anatom.tsv': 'dc682c847972bd37badaa979526cf22a25bc79cdf50f4f49c107391c517fe7ad',
    'atlas_description.json': '90240cabe8f1fab75bcf9af0d1e8b287cab76d04233095b978b650d2cb1405c1',
    'README.md': 'f6c544b949f5a20059f9f154c93d892909f2a9bf6bba74396a9b15a5df55246e',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build():
    cache = ROOT / '.cache/subregions/cerebellum'
    out = ROOT / 'public/subregions'
    cache.mkdir(parents=True, exist_ok=True)
    out.mkdir(parents=True, exist_ok=True)
    inputs = {}
    for name, expected in FILES.items():
        path = cache / name
        url = BASE + ('' if name == 'README.md' else 'Diedrichsen_2009/') + name
        if not path.exists():
            urllib.request.urlretrieve(url, path)
        data = path.read_bytes()
        if sha256(data) != expected:
            raise ValueError(f'Cerebellar source checksum changed: {name}')
        inputs[name] = dict(url=url, sha256=expected, bytes=len(data))
    image = nib.load(cache / 'atl-Anatom_space-MNISym_dseg.nii')
    labels = image.get_fdata()
    if not np.isfinite(labels).all() or not np.array_equal(np.unique(labels), np.arange(35)):
        raise ValueError('Expected background and exactly 34 published labels')
    if any(np.take(labels, [0, -1], axis=axis).any() for axis in range(3)):
        raise ValueError('Source labels reach the image edge; do not silently cut surfaces')
    table = list(csv.DictReader(io.StringIO((cache / 'atl-Anatom.tsv').read_text()), delimiter='\t'))
    if [int(row['index']) for row in table] != list(range(1, 35)):
        raise ValueError('Unexpected cerebellar label table')
    entries = []
    for row in table:
        label = int(row['index'])
        side, key = row['name'].split('_', 1)
        hemisphere = 'midline' if side == 'Vermis' else side.lower()
        nucleus = label >= 29
        name = {'I_IV': 'Lobules I–IV', 'CrusI': 'Crus I', 'CrusII': 'Crus II',
                'Dentate': 'Dentate nucleus', 'Interposed': 'Interposed nuclei',
                'Fastigial': 'Fastigial nucleus'}.get(key, f'Lobule {key}')
        if side == 'Vermis':
            name = f'Vermis · {name}'
        description = 'Published lobular compartment. Its envelope does not resolve cellular layers or individual folds within the label.'
        if key == 'I_IV':
            description = 'Lobules I–IV share this source label; four separate lobular surfaces are not supplied.'
        elif nucleus:
            description = 'Published deep-nucleus compartment. Its envelope does not resolve cellular subtypes or internal functional territories.'
            if key == 'Interposed':
                description += ' Emboliform and globose are combined in the interposed label.'
        voxels = int((labels == label).sum())
        if voxels < 50:
            description = f'Only {voxels} labeled voxels remain in this published map. This tiny fragment does not establish the full anatomical extent. ' + description
        if side == 'Vermis' and key in ('CrusI', 'CrusII'):
            description += f' The source spelling {row["name"]} is retained; vermal terminology is protocol-specific.'
        rgb = [int(row['color'][i:i+2], 16) for i in (1, 3, 5)]
        color = '#' + ''.join(f'{round(value * 0.65 + 150 * 0.35):02x}' for value in rgb)
        entries.append(dict(id=f'cereb-{label}', key=row['name'], name=name,
                            **({'warning': 'Tiny source fragment'} if voxels < 50 else {}),
                            hemisphere=hemisphere, group='Deep nuclei' if nucleus else 'Vermis' if side == 'Vermis' else 'Lobular hemispheres',
                            kind='segmentation', source='published-label-map', label=label, channel=label,
                            aliases=['emboliform', 'globose'] if key == 'Interposed' else [],
                            sourceName=row['name'], sourceColor=row['color'], color=color, description=description))
    raw, parts, omitted, origin = pack_surfaces(image, labels, entries)
    if omitted:
        raise ValueError('A published label has no surface')
    compressed = gzip.compress(raw, mtime=0)
    source_bytes = (cache / 'atl-Anatom_space-MNISym_dseg.nii').read_bytes()
    (out / 'cerebellum.bin').write_bytes(raw)
    (out / 'cerebellum.mesh').write_bytes(compressed)
    (out / 'cerebellum-labels.nii.gz').write_bytes(gzip.compress(source_bytes, mtime=0))
    (out / 'cerebellum-labels.tsv').write_bytes((cache / 'atl-Anatom.tsv').read_bytes())
    manifest = dict(
        version=1, title='Cerebellar lobules and deep nuclei', checkedOn='2026-10-19', probabilityEvidence=False,
        relatedReading=dict(title='Related anatomy & circuitry',
                            scope='These notes explain regional organization and cellular circuits. The surfaces do not trace those fibers, cells, or task-specific circuits.',
                            links=[dict(id='cerebellum-organization', label='Lobes, nuclei & connections'),
                                   dict(id='cerebellar-circuit', label='Layers, cells & circuit explanation')]),
        parts=parts, omitted=[], compressedUrl='/subregions/cerebellum.mesh', rawUrl='/subregions/cerebellum.bin',
        source=dict(
            commit=COMMIT, files=inputs,
            documentation=f'https://github.com/DiedrichsenLab/cerebellar_atlases/tree/{COMMIT}/Diedrichsen_2009',
            protocol='https://www.diedrichsenlab.org/imaging/propatlas.htm',
            paper='https://doi.org/10.1016/j.neuroimage.2009.01.045',
            paperTitle='Diedrichsen et al. (2009), lobular atlas',
            otherStudies=[dict(title='Diedrichsen et al. (2011), deep nuclei', url='https://doi.org/10.1016/j.neuroimage.2010.10.035')],
            license='/licenses/diedrichsen-atlas-notice.txt', licenseTitle='Atlas attribution & reuse notice',
            attribution='Derived Diedrichsen Lab atlas data · CC BY (upstream version unspecified)',
            shape=list(image.shape), affine=image.affine.tolist(), spacingMm=list(map(float, image.header.get_zooms()[:3])),
            frame='MNI152NLin2009cSymC (MNISym), recentered independently; not registered to the fsaverage whole-brain model or bundled MRI templates',
            method='Published categorical dseg labels are used unchanged, including background. Marching cubes at 0.5 on each binary label mask; no additional smoothing or resampling. All disconnected components are retained. Display colors are softened from the supplied lookup table. Source probability distributions are not loaded or summarized in this viewer.',
            displayTransform='[R,S,-A], recentered for a standalone view', displayOrigin=origin,
            coverage='34 labels: 28 lobular compartments (including eight vermal labels) and six deep-nucleus compartments (three pairs). I–IV are combined. Interposed combines emboliform and globose. Tiny fastigial label fragments are not complete nuclei.',
        ),
        geometry=dict(bytes=len(raw), compressedBytes=len(compressed), sha256=sha256(raw), compressedSha256=sha256(compressed), triangles=sum(part['triangles'] for part in parts)),
    )
    serialized = json.dumps(manifest, indent=2) + '\n'
    (ROOT / 'src/cerebellum-subregions.json').write_text(serialized)
    (out / 'cerebellum-provenance.json').write_text(serialized)
    print(manifest['geometry'])
    print('Surfaces:',len(parts),'Vermis:',sum(p['hemisphere']=='midline' for p in parts))


if __name__ == '__main__':
    build()
