"""Build independent amygdala winner surfaces from the pinned FreeSurfer atlas."""
from pathlib import Path
import gzip
import json

from scipy.ndimage import label as connected_components
from subregion_geometry import pack_surface_sets
from hippo_amygdala_source import URL, SHA, load_source, sha256

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/subregions'

# Names and abbreviations follow Table 2 of Saygin, Kliemann et al. (2017).
LABELS = [
    (7001, 'Lateral-nucleus', 'Lateral nucleus', 'La', '#8db8d1',
     'Beside the basal nucleus in the source protocol. Individual neurons and connections are not resolved.'),
    (7003, 'Basal-nucleus', 'Basal nucleus', 'Ba', '#d5a6a0',
     'Borders the lateral nucleus in the source protocol. Internal subdivisions are not separated here.'),
    (7008, 'Accessory-Basal-nucleus', 'Accessory basal nucleus', 'AB', '#d5b27f',
     'Medial to the basal nucleus in the source protocol. This is a distinct label, not an extra copy of the basal nucleus.'),
    (7010, 'Anterior-amygdaloid-area-AAA', 'Anterior amygdaloid area', 'AAA', '#b8bf83',
     'An anterior amygdala area in this protocol; the nine labels include areas as well as nuclei.'),
    (7005, 'Central-nucleus', 'Central nucleus', 'Ce', '#c5a6d2',
     'A single central-nucleus label. Its internal subdivisions and output pathways are not modeled.'),
    (7006, 'Medial-nucleus', 'Medial nucleus', 'Me', '#a6c5ab',
     'Only 17 voxels win this label on each side of the downloaded atlas. This tiny fragment does not establish the full anatomical extent of the medial nucleus.'),
    (7007, 'Cortical-nucleus', 'Cortical nucleus', 'Co', '#c9b8a0',
     'A single cortical-nucleus label; constituent subnuclei and cellular layers are not separated.'),
    (7009, 'Corticoamygdaloid-transitio', 'Corticoamygdaloid transition area', 'CAT', '#a2b8c9',
     'Along the medial amygdala border in this protocol. This transition-area label is distinct from the hippocampal–amygdala transition area (HATA).'),
    (7015, 'Paralaminar-nucleus', 'Paralaminar nucleus', 'PL', '#80bdb3',
     'Inferior to the basal nucleus in the source protocol. The surface does not resolve its constituent cells.'),
]


def build():
    OUT.mkdir(parents=True, exist_ok=True)
    volumes = {}
    names = ''

    def sets():
        nonlocal names
        for side in ['left', 'right']:
            image, probs, names, volume = load_source(side)
            rows = [line.split(',') for line in names.splitlines() if line.strip()]
            if rows[21:] != [[str(item[0]), item[1]] for item in LABELS]:
                raise ValueError('Unexpected amygdala label names or channel order')
            volumes[side] = volume
            winners = probs.argmax(axis=3)
            entries = []
            for channel, (code, source_name, name, abbreviation, color, description) in enumerate(LABELS, start=21):
                _, components = connected_components(winners == channel)
                entries.append(dict(
                    id=f'amyg-{side}-{code}', key=source_name, name=name,
                    abbreviation=abbreviation, sourceName=source_name,
                    hemisphere=side, group='Amygdala', color=color,
                    kind='segmentation', source='probability-atlas', label=code,
                    channel=channel, description=description,
                    maxProbability=float(probs[..., channel].max()),
                    voxelConnectedComponents6=int(components),
                ))
            del probs
            yield image, winners, entries

    raw, parts, omitted, origin = pack_surface_sets(sets())
    if omitted:
        raise ValueError('Expected all nine amygdala labels to have winner voxels')
    if volumes['left']['probabilityArraySha256'] != volumes['right']['probabilityArraySha256']:
        raise ValueError('Expected symmetric probability arrays in this pinned download')
    compressed = gzip.compress(raw, mtime=0)
    (OUT / 'amygdala.bin').write_bytes(raw)
    (OUT / 'amygdala.mesh').write_bytes(compressed)
    manifest = dict(
        version=1, title='Amygdala atlas subregions', checkedOn='2026-10-19',
        parts=parts, omitted=omitted, compressedUrl='/subregions/amygdala.mesh',
        rawUrl='/subregions/amygdala.bin',
        source=dict(
            url=URL, archiveSha256=SHA, volumes=volumes, names=names,
            includedChannels=list(range(21, 30)), excludedChannels=list(range(1, 21)),
            documentation='https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace',
            protocol='https://surfer.nmr.mgh.harvard.edu/fswiki/HippocampalSubfieldsAndNucleiOfAmygdala',
            paper='https://doi.org/10.1016/j.neuroimage.2017.04.046',
            labelDefinitions='https://www.nmr.mgh.harvard.edu/~iglesias/pdf/AmygdalaAtlas.pdf#page=37',
            license='/licenses/freesurfer.txt', spacingMm=[0.25, 0.25, 0.25],
            frame='Approximately MNI-ICBM152 2009c symmetric; not registered to the fsaverage whole-brain model',
            method='Maximum-probability label per voxel across all 30 channels, including unknown/background and hippocampal channels; only channels 21–29 are surfaced; marching cubes at 0.5 on each binary label; no additional smoothing or resampling; disconnected components retained; winding corrected for reflected source affine',
            displayTransform='[R,S,-A], recentered for a standalone view', displayOrigin=origin,
            scope='Nine amygdala labels per side, including two areas; hippocampal labels are excluded from display, not from winner competition. The two supplied grids contain identical probability arrays with reflected left/right affines.',
        ),
        geometry=dict(bytes=len(raw), compressedBytes=len(compressed), sha256=sha256(raw),
                      compressedSha256=sha256(compressed), triangles=sum(p['triangles'] for p in parts)),
    )
    serialized = json.dumps(manifest, indent=2) + '\n'
    (ROOT / 'src/amygdala-subregions.json').write_text(serialized)
    (OUT / 'amygdala-provenance.json').write_text(serialized)
    print(manifest['geometry'])
    print('Surfaces:', len(parts))
    print('Voxels / components:', [(p['hemisphere'], p['abbreviation'], p['voxels'], p['voxelConnectedComponents6']) for p in parts])


if __name__ == '__main__':
    build()
