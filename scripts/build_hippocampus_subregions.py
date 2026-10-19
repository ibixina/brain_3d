"""Build independent hippocampal winner surfaces from the pinned FreeSurfer atlas."""
from pathlib import Path
import gzip
import json

from scipy.ndimage import label as connected_components
from subregion_geometry import pack_surface_sets
from hippo_amygdala_source import URL, SHA, load_source, sha256

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/subregions'
LABELS = [
    (226, 'Hippocampal_tail', 'Hippocampal tail', 'Tail', '#a6c5ab',
     'Posterior tail compartment. This source does not divide the tail into individual CA fields.'),
    (236, 'subiculum-body', 'Subiculum — body', 'Subicular territories', '#d5a6a0',
     'Body-level subiculum label. This atlas compartment does not resolve its individual neurons or cellular layers.'),
    (238, 'CA1-body', 'CA1 — body', 'CA fields', '#8db8d1',
     'Body-level CA1 label; its hippocampal molecular-layer compartment is labeled separately. Individual pyramidal neurons are not reconstructed.'),
    (235, 'subiculum-head', 'Subiculum — head', 'Subicular territories', '#d5a6a0',
     'Head-level subiculum label. This atlas compartment does not resolve its individual neurons or cellular layers.'),
    (215, 'hippocampal-fissure', 'Hippocampal fissure', 'Fluid space', '#9fc8d5',
     'A fissure-space label rather than neural tissue. Its solid display encloses the winning mask; it is not a tract or a fluid-flow simulation.'),
    (233, 'presubiculum-head', 'Presubiculum — head', 'Subicular territories', '#c5a6d2',
     'Head-level presubiculum label, distinct from subiculum and parasubiculum in this protocol. Its internal layers are not separated.'),
    (201, 'alveus', 'Alveus', 'White matter', '#c9b8a0',
     'White-matter compartment along the hippocampus. A surface envelope does not reconstruct individual axons.'),
    (237, 'CA1-head', 'CA1 — head', 'CA fields', '#8db8d1',
     'Head-level CA1 label; its hippocampal molecular-layer compartment is labeled separately. Individual pyramidal neurons are not reconstructed.'),
    (234, 'presubiculum-body', 'Presubiculum — body', 'Subicular territories', '#c5a6d2',
     'Body-level presubiculum label, distinct from subiculum and parasubiculum in this protocol. Its internal layers are not separated.'),
    (203, 'parasubiculum', 'Parasubiculum', 'Subicular territories', '#b8bf83',
     'A neighboring subicular territory, supplied as one label without separate head/body portions in this download.'),
    (245, 'molecular_layer_HP-head', 'Hippocampal molecular layer — head', 'Layer labels', '#a2b8c9',
     'Head-level hippocampal molecular-layer label. An atlas compartment, without individually resolved cells or synapses.'),
    (246, 'molecular_layer_HP-body', 'Hippocampal molecular layer — body', 'Layer labels', '#a2b8c9',
     'Body-level hippocampal molecular-layer label. An atlas compartment, without individually resolved cells or synapses.'),
    (243, 'GC-ML-DG-head', 'Dentate gyrus — head', 'Layer labels', '#a895c5',
     'Dentate-gyrus source label GC-ML-DG at head level. A protocol grouping, without individually reconstructed granule cells or complete circuit fibers.'),
    (240, 'CA3-body', 'CA2/3 — body', 'CA fields', '#d5b27f',
     'The source name is CA3-body. The current protocol includes CA2 within CA3; no independent CA2 boundary is provided.'),
    (244, 'GC-ML-DG-body', 'Dentate gyrus — body', 'Layer labels', '#a895c5',
     'Dentate-gyrus source label GC-ML-DG at body level. A protocol grouping, without individually reconstructed granule cells or complete circuit fibers.'),
    (241, 'CA4-head', 'CA4 — head', 'CA fields', '#cfa58d',
     'Head-level CA4/hilar label within the dentate region. A protocol-defined compartment, not a complete map of hilar cell types.'),
    (242, 'CA4-body', 'CA4 — body', 'CA fields', '#cfa58d',
     'Body-level CA4/hilar label within the dentate region. A protocol-defined compartment, not a complete map of hilar cell types.'),
    (212, 'fimbria', 'Fimbria', 'White matter', '#d3c8af',
     'White-matter compartment continuing toward the fornix. Individual fibers and the full fornix are not reconstructed.'),
    (239, 'CA3-head', 'CA2/3 — head', 'CA fields', '#d5b27f',
     'The source name is CA3-head. The current protocol includes CA2 within CA3; no independent CA2 boundary is provided.'),
    (211, 'HATA', 'Hippocampal–amygdala transition area', 'Transition area', '#80bdb3',
     'The HATA source label, distinct from the amygdala atlas’s corticoamygdaloid transition area (CAT). This area is not a tract reconstruction.'),
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
            if rows[1:21] != [[str(item[0]), item[1]] for item in LABELS]:
                raise ValueError('Unexpected hippocampal label names or channel order')
            volumes[side] = volume
            winners = probs.argmax(axis=3)
            entries = []
            for channel, (code, source_name, name, group, color, description) in enumerate(LABELS, start=1):
                _, components = connected_components(winners == channel)
                entry = dict(
                    id=f'hipp-{side}-{code}', key=source_name, name=name,
                    sourceName=source_name, hemisphere=side, group=group,
                    color=color, kind='segmentation', source='probability-atlas',
                    label=code, channel=channel, description=description,
                    maxProbability=float(probs[..., channel].max()),
                    voxelConnectedComponents6=int(components),
                )
                if source_name.startswith('GC-ML-DG'):
                    entry['abbreviation'] = 'GC-ML-DG'
                elif source_name == 'HATA':
                    entry['abbreviation'] = 'HATA'
                entries.append(entry)
            del probs
            yield image, winners, entries

    raw, parts, omitted, origin = pack_surface_sets(sets())
    if omitted:
        raise ValueError('Expected all 20 hippocampal labels to have winner voxels')
    if volumes['left']['probabilityArraySha256'] != volumes['right']['probabilityArraySha256']:
        raise ValueError('Expected symmetric probability arrays in this pinned download')
    assets = []
    compressed_parts = []
    for side in ['left', 'right']:
        side_parts = [part for part in parts if part['hemisphere'] == side]
        start = side_parts[0]['offset']
        size = sum(part['vertices'] * 28 + part['triangles'] * 12 for part in side_parts)
        side_raw = raw[start:start + size]
        side_compressed = gzip.compress(side_raw, mtime=0)
        for part in side_parts:
            part['offset'] -= start
        compressed_url = f'/subregions/hippocampus-{side}.mesh'
        raw_url = f'/subregions/hippocampus-{side}.bin'
        (ROOT / 'public' / compressed_url.lstrip('/')).write_bytes(side_compressed)
        (ROOT / 'public' / raw_url.lstrip('/')).write_bytes(side_raw)
        assets.append(dict(
            hemisphere=side, compressedUrl=compressed_url, rawUrl=raw_url,
            geometry=dict(bytes=len(side_raw), compressedBytes=len(side_compressed),
                          sha256=sha256(side_raw), compressedSha256=sha256(side_compressed),
                          triangles=sum(part['triangles'] for part in side_parts)),
        ))
        compressed_parts.append(side_compressed)
    compressed = b''.join(compressed_parts)
    manifest = dict(
        version=1, title='Hippocampal atlas subregions', checkedOn='2026-10-19',
        parts=parts, omitted=omitted, assets=assets,
        compressedUrl=assets[0]['compressedUrl'], rawUrl=assets[0]['rawUrl'],
        source=dict(
            url=URL, archiveSha256=SHA, volumes=volumes, names=names,
            includedChannels=list(range(1, 21)), excludedChannels=list(range(21, 30)),
            documentation='https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace',
            protocol='https://surfer.nmr.mgh.harvard.edu/fswiki/HippocampalSubfieldsAndNucleiOfAmygdala',
            paper='https://doi.org/10.1016/j.neuroimage.2015.04.042',
            labelDefinitions='https://www.nmr.mgh.harvard.edu/~iglesias/pdf/subfieldsNeuroimage2015preprint.pdf#page=7',
            license='/licenses/freesurfer.txt', spacingMm=[0.25, 0.25, 0.25],
            frame='Approximately MNI-ICBM152 2009c symmetric; not registered to the fsaverage whole-brain model',
            method='Maximum-probability label per voxel across all 30 channels, including unknown/background and amygdala channels; only channels 1–20 are surfaced; marching cubes at 0.5 on each binary label; no additional smoothing or resampling; disconnected components retained; winding corrected for reflected source affine',
            displayTransform='[R,S,-A], recentered for a standalone view', displayOrigin=origin,
            scope='20 hippocampal labels per side, including white matter, layer, transition-area, tail and fissure-space labels, not 20 cellular subfields. Source CA3 includes CA2 under the current protocol. The download adds head/body and GC-ML-DG naming; it is not an unchanged copy of the original 2015 label set. Amygdala channels are excluded from display, not winner competition. The two supplied grids contain identical probability arrays with reflected left/right affines.',
        ),
        geometry=dict(bytes=len(raw), compressedBytes=len(compressed), sha256=sha256(raw),
                      compressedSha256=sha256(compressed), triangles=sum(p['triangles'] for p in parts),
                      hashScope='Concatenated asset bytes in assets order; each asset also has its own hashes'),
    )
    serialized = json.dumps(manifest, indent=2) + '\n'
    (ROOT / 'src/hippocampus-subregions.json').write_text(serialized)
    (OUT / 'hippocampus-provenance.json').write_text(serialized)
    print(manifest['geometry'])
    print('Surfaces:', len(parts))
    print('Voxels / components:', [(p['hemisphere'], p['sourceName'], p['voxels'], p['voxelConnectedComponents6']) for p in parts])


if __name__ == '__main__':
    build()
