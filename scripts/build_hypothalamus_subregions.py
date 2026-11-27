"""Build a standalone surface viewer from Neudorfer et al.'s MNI152b label map."""
from pathlib import Path
import csv
import gzip
import hashlib
import json
import urllib.request

import nibabel as nib
import numpy as np
from scipy import ndimage
from subregion_geometry import pack_surfaces

ROOT = Path(__file__).resolve().parents[1]
RECORD = 'https://zenodo.org/records/3942115'
FILES = {
    'MNI152b_atlas_labels_0.5mm.nii.gz': ('d94c770945b19b0a3f13ab43c5140e01', '.cache/MNI152b_atlas_labels_0.5mm.nii.gz'),
    'Volumes_names-labels.csv': ('b6f3d1a221d77ccd129c4e73864c2e25', '.cache/Volumes_names-labels.csv'),
    'README.txt': ('a18e3d04e217db39165b6c1086bdbe95', '.cache/README.txt'),
}
NAMES = {
    'anterior commissure': ('Anterior commissure', 'Nearby white matter'),
    'diagonal band of Broca': ('Diagonal band of Broca', 'Nearby basal forebrain'),
    'fornix': ('Fornix', 'Nearby white matter'),
    'mammillothalamic tract': ('Mammillothalamic tract', 'Nearby white matter'),
    'mammillary bodies': ('Mammillary bodies', 'Nearby hypothalamic-region structure'),
    'subthalamic nucleus': ('Subthalamic nucleus', 'Nearby gray matter'),
    'substantia nigra': ('Substantia nigra', 'Nearby gray matter'),
    'red nucleus': ('Red nucleus', 'Nearby gray matter'),
    'medial preoptic nucleus': ('Medial preoptic nucleus', 'Hypothalamus'),
    'paraventricular nucleus': ('Paraventricular nucleus', 'Hypothalamus'),
    'dorsal periventricular hypothalamic nucleus': ('Dorsal periventricular nucleus', 'Hypothalamus'),
    'lateral hypothalamus': ('Lateral hypothalamus', 'Hypothalamus'),
    'ventromedial hypothalamus': ('Ventromedial hypothalamus', 'Hypothalamus'),
    'arcuate hypothalamic nucleus': ('Arcuate nucleus', 'Hypothalamus'),
    'periventricular hypothalamic nucleus': ('Periventricular nucleus', 'Hypothalamus'),
    'bed nucleus of the stria terminalis': ('Bed nucleus of the stria terminalis', 'Nearby basal forebrain'),
    'nucleus basalis of Meynert': ('Nucleus basalis of Meynert', 'Nearby basal forebrain'),
    'dorsomedial hypothalamic nucleus': ('Dorsomedial nucleus', 'Hypothalamus'),
    'zona incerta': ('Zona incerta', 'Nearby gray matter'),
    'inferior thalamic peduncle': ('Inferior thalamic peduncle', 'Nearby white matter'),
    'supraoptic hypothalamic nucleus': ('Supraoptic nucleus', 'Hypothalamus'),
    'suprachiasmatic hypothalamic nucleus': ('Suprachiasmatic nucleus', 'Hypothalamus'),
    'tuberomammillary hypothalamic nucleus': ('Tuberomammillary nucleus', 'Hypothalamus'),
    'posterior hypotahalamic nucleus': ('Posterior hypothalamic nucleus', 'Hypothalamus'),
    'anterior hypothalamic area': ('Anterior hypothalamic area', 'Hypothalamus'),
}
COLORS = ['#dc9c78', '#d2a767', '#80a9bc', '#aa92bc', '#77aa94', '#d18383']


def md5(data):
    return hashlib.md5(data).hexdigest()


def build():
    files = {}
    for name, (expected, relative) in FILES.items():
        path = ROOT / relative
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            urllib.request.urlretrieve(f'https://zenodo.org/api/records/3942115/files/{name}/content', path)
        data = path.read_bytes()
        if md5(data) != expected:
            raise ValueError(f'Pinned hypothalamus source changed: {name}')
        files[name] = dict(url=f'https://zenodo.org/api/records/3942115/files/{name}/content', md5=expected, bytes=len(data))
    image = nib.load(ROOT / FILES['MNI152b_atlas_labels_0.5mm.nii.gz'][1])
    labels = np.asarray(image.dataobj, dtype=np.uint8)
    if labels.shape != (394, 466, 378) or set(np.unique(labels)) != {0, *range(1, 11), *range(13, 39), *range(41, 55)}:
        raise ValueError(f'Unexpected source label grid or IDs: {labels.shape}, {np.unique(labels)}')
    table = list(csv.DictReader((ROOT / FILES['Volumes_names-labels.csv'][1]).read_text().splitlines()))
    if len(table) != 50 or len({int(row['Label']) for row in table}) != 50:
        raise ValueError('Expected 50 distinct lateralized source label IDs')
    entries = []
    for index, row in enumerate(table):
        label = int(row['Label'])
        source_name = row['Name'].strip()
        name, group = NAMES[source_name]
        side = row['Hemisphere']
        source_hemisphere = row['Abbreviation'].strip().split('_', 1)[0]
        if source_hemisphere != {'left': 'L', 'right': 'R'}[side]:
            raise ValueError(f'Source abbreviation and side disagree for {label}')
        description = (
            f'{name}, {side} side. One of 13 hypothalamic labels in the published population-template atlas.'
            if group == 'Hypothalamus' else
            f'{name}, {side} side. One of 12 structures adjacent to the hypothalamic region in the published population-template atlas.'
        )
        if source_name == 'posterior hypotahalamic nucleus':
            description += ' The display spelling is corrected; the exact source spelling is retained in provenance.'
        aliases = []
        for term in [source_name, row['Abbreviation'].strip()]:
            if term.lower() != name.lower():
                aliases.append(term)
        aliases += {
            'Suprachiasmatic nucleus': ['SCN'], 'Paraventricular nucleus': ['PVN', 'PVH'],
            'Supraoptic nucleus': ['SON'], 'Arcuate nucleus': ['ARC', 'AN'],
            'Dorsomedial nucleus': ['DMH'], 'Ventromedial nucleus': ['VMH'],
        }.get(name, [])
        entries.append(dict(id=f'hypo-{label}', key=row['Abbreviation'].strip(), name=name,
                            abbreviation=row['Abbreviation'].strip().split('_', 1)[1],
                            sourceName=source_name, sourceAbbreviation=row['Abbreviation'].strip(),
                            hemisphere=side, group=group, aliases=sorted(set(aliases)),
                            kind='segmentation', source='neudorfer-2020', label=label, channel=label,
                            color=COLORS[index % len(COLORS)], description=description))
    surface_labels = labels.copy()
    red_nucleus_left = surface_labels == 18
    components, component_count = ndimage.label(
        red_nucleus_left, structure=ndimage.generate_binary_structure(3, 1)
    )
    component_sizes = np.bincount(components.ravel())[1:]
    if component_count != 3 or sorted(component_sizes.tolist()) != [2, 27, 2285]:
        raise ValueError(f'Unexpected detached red-nucleus source fragments: {component_sizes}')
    keep_component = int(np.argmax(component_sizes)) + 1
    excluded = red_nucleus_left & (components != keep_component)
    surface_labels[excluded] = 0
    red_entry = next(entry for entry in entries if entry['label'] == 18)
    red_entry.update(sourceVoxels=2314, excludedSourceFragments=[27, 2], warning='Detached source fragments excluded')
    red_entry['description'] += ' The supplied left label also contains detached 27- and 2-voxel fragments, including a fragment reaching the image boundary. Only the largest face-connected component (2,285 voxels) is surfaced; the source values remain unmodified in provenance.'
    raw, parts, omitted, origin = pack_surfaces(image, surface_labels, entries)
    if omitted:
        raise ValueError(f'Published label IDs unexpectedly lack surfaces: {[item["label"] for item in omitted]}')
    compressed = gzip.compress(raw, mtime=0)
    public = ROOT / 'public/subregions'
    public.mkdir(parents=True, exist_ok=True)
    (public / 'hypothalamus.bin').write_bytes(raw)
    (public / 'hypothalamus.mesh').write_bytes(compressed)
    atlas = dict(
        version=1, title='Human hypothalamic-region atlas', checkedOn='2026-11-27', probabilityEvidence=False,
        relatedReading=dict(title='Related anatomy & systems',
            scope='The atlas provides population-template labels for hypothalamic and adjacent structures. These notes discuss their regional context and selected systems; they do not add cell or pathway geometry.',
            links=[dict(id='hypothalamic-anatomy', label='Hypothalamic anatomy & boundaries'),
                   dict(id='hypothalamic-systems', label='Hypothalamic systems & experiments')]),
        parts=parts, omitted=[], compressedUrl='/subregions/hypothalamus.mesh', rawUrl='/subregions/hypothalamus.bin',
        source=dict(
            documentation=RECORD,
            protocol=RECORD,
            paper='https://doi.org/10.1038/s41597-020-00644-6',
            paperTitle='Neudorfer et al. (2020), high-resolution hypothalamic-region atlas',
            license='/licenses/cc-by-4.0-legalcode.html', licenseTitle='Creative Commons Attribution 4.0 International',
            attribution='Modified Neudorfer et al. atlas derivatives · CC BY 4.0',
            files=files, labelTableUrl=f'{RECORD}/files/Volumes_names-labels.csv',
            labelDefinitions=f'{RECORD}/files/Volumes_names-labels.csv',
            labelDefinitionsTitle='Published label names and lateralized IDs (CSV)',
            shape=list(image.shape), affine=image.affine.tolist(), spacingMm=list(map(float, image.header.get_zooms()[:3])),
            frame='MNI152b population-template space from 990 HCP subjects; recentered independently for inspection, not registered to the whole-brain surface model or bundled MRI templates',
            method='The source categorical label map is retained unchanged. Marching cubes at 0.5 on its 50 label IDs; no smoothing, resampling, or decimation. One documented source anomaly is excluded from display geometry: the left red-nucleus label has face-connected components of 2, 27, and 2,285 voxels, with the 2-voxel component reaching the template edge; only its largest component is surfaced. The original label map and all IDs remain available from the source record. The generated meshes are not the authors’ participant segmentation pipeline.',
            displayTransform='Source RAS transformed to [R,S,-A], then recentered for a standalone view', displayOrigin=origin,
            coverage='50 lateralized source labels: 13 hypothalamic structures and 12 adjacent structures per side. This is one population-template segmentation, not a complete account of hypothalamic nomenclature or individual anatomy.',
            sourceAuthors='Neudorfer, Germann, Elias, Gramer, Boutet & Lozano (2020)',
            sourceRecord='https://doi.org/10.5281/zenodo.3942115',
        ),
        geometry=dict(bytes=len(raw), compressedBytes=len(compressed), sha256=hashlib.sha256(raw).hexdigest(),
                      compressedSha256=hashlib.sha256(compressed).hexdigest(), triangles=sum(part['triangles'] for part in parts)),
    )
    (ROOT / 'src/hypothalamus-subregions.json').write_text(json.dumps(atlas, indent=2) + '\n')
    (public / 'hypothalamus-provenance.json').write_text(json.dumps(atlas, indent=2) + '\n')
    print(json.dumps(dict(geometry=atlas['geometry'], parts=len(parts), groups={g: sum(p['group'] == g for p in parts) for g in sorted({p['group'] for p in parts})}), indent=2))


if __name__ == '__main__':
    build()
