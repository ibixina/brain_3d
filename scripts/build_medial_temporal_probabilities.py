"""Split the pinned hippocampus/amygdala probabilities into lazy native channels."""
import gc
import gzip
import json
from pathlib import Path
import numpy as np
from hippo_amygdala_source import load_source, sha256

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/subregions/medial-temporal-probability'


def compressed_asset(name, values):
    raw = values.tobytes(order='F')
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    (OUT / name).write_bytes(packed)
    return dict(url=f'/subregions/medial-temporal-probability/{name}', bytes=len(packed),
                rawBytes=len(raw), sha256=sha256(raw), compressedSha256=sha256(packed))


def grid(image):
    affine = image.affine
    return dict(shape=list(image.shape[:3]), origin=affine[:3, 3].tolist(),
                spacing=[float(affine[i, i]) for i in range(3)],
                orientation='RAS in source voxel coordinates; right-side x axis is reflected',
                space='MNI-ICBM152 2009c symmetric')


def build():
    atlases = {kind: json.loads((ROOT / f'src/{kind}-subregions.json').read_text())
               for kind in ('hippocampus', 'amygdala')}
    source_atlas = atlases['hippocampus']
    amygdala_source = atlases['amygdala']['source']
    if any(source_atlas['source'][key] != amygdala_source[key]
           for key in ('url', 'archiveSha256', 'names', 'volumes')):
        raise ValueError('Both subregion atlases must share the exact pinned source volumes')
    OUT.mkdir(parents=True, exist_ok=True)
    left_image, left, names, left_volume = load_source('left')
    if names != source_atlas['source']['names'] or names != amygdala_source['names']:
        raise ValueError('Subregion source channel names changed')
    np.testing.assert_array_equal(left_image.affine, source_atlas['source']['volumes']['left']['affine'])
    if left_image.dataobj.slope != 1 or left_image.dataobj.inter != 0:
        raise ValueError('Unexpected source probability scaling')
    shape = list(left.shape[:3])
    winners = np.argmax(left, axis=3).astype(np.uint8)
    categories = [dict(channel=i, label=int(line[0]), sourceName=line[1],
                       structure='unknown' if i == 0 else 'hippocampus' if i <= 20 else 'amygdala')
                  for i, line in enumerate(row.split(',') for row in names.splitlines() if row.strip())]
    context = compressed_asset('winner-channels.u8.gz', np.asfortranarray(winners))
    channels = {}
    manifests = {}
    for kind, atlas in atlases.items():
        entries = {}
        for part in atlas['parts']:
            channel = int(part['channel'])
            if channel not in channels:
                values = np.asfortranarray(left[..., channel], dtype='<f4')
                channels[channel] = compressed_asset(f'channel-{channel}.f32.gz', values)
            values = left[..., channel]
            categorical_voxels = int(np.count_nonzero(winners == channel))
            if categorical_voxels != part['voxels']:
                raise ValueError(f"Winner count changed for {part['id']}")
            index = tuple(map(int, np.unravel_index(int(np.argmax(values)), shape)))
            probability = float(values[index])
            winner = int(winners[index])
            affine = np.asarray(atlas['source']['volumes'][part['hemisphere']]['affine'])
            entries[part['id']] = dict(
                channel=channel,
                label=int(part['label']),
                sourceName=part['sourceName'],
                asset=channels[channel],
                positiveVoxels=int(np.count_nonzero(values > 0)),
                categoricalVoxels=categorical_voxels,
                peak=dict(index=list(index), probability=probability,
                          rasMm=(affine[:3, :3] @ np.asarray(index) + affine[:3, 3]).tolist(),
                          selectedWins=winner == channel, winnerChannel=winner,
                          winnerSourceName=categories[winner]['sourceName']),
            )
        manifests[kind] = dict(
            version=1,
            kind=kind,
            checkedOn='2026-11-26',
            grids={'left': grid(left_image)},
            encoding=dict(dtype='float32', byteOrder='little-endian', order='x-fastest',
                          slope=1, intercept=0, displayRange=[0, 1],
                          sourceRange=left_volume['probabilityRange']),
            context=dict(asset=context, dtype='uint8 channel index', method='Argmax over all 30 source channels; source channel order resolves ties.'),
            categories=categories,
            entries=entries,
            source=dict(archiveSha256=atlas['source']['archiveSha256'],
                        niftiSha256={side: atlas['source']['volumes'][side]['sha256'] for side in ('left', 'right')},
                        probabilityArraySha256=left_volume['probabilityArraySha256'],
                        documentation=atlas['source']['documentation'], paper=atlas['source']['paper'],
                        protocol=atlas['source']['protocol'], license=atlas['source']['license']),
            method='Each selected source float32 probability channel is preserved byte-for-byte and losslessly gzip-compressed in x-fastest order. Both source hemisphere arrays have identical probability values with reflected RAS affines; one channel file is shared while the selected side supplies its own affine. The categorical context is derived from the argmax over all 30 channels, including Unknown/background and both anatomical atlases. No probability interpolation, resampling, thresholding, renormalization, or additional quantization is applied. The color display clamps tiny floating-point excursions to [0,1].',
            interpretation='These are population-atlas label probabilities, not MRI intensities, an individual scan, task activation, or calibrated certainty about an individual boundary. The source atlas combines a protocol based on high-resolution ex vivo human MRI with in vivo training scans; these displayed template coordinates do not register to Cerebra’s whole-brain model or bundled MRI templates.',
        )
    left_grid = manifests['hippocampus']['grids']['left']
    del values, left, left_image, winners
    gc.collect()
    right_image, right_values, right_names, right_volume = load_source('right')
    np.testing.assert_array_equal(right_image.affine, source_atlas['source']['volumes']['right']['affine'])
    if names != right_names or left_volume['probabilityArraySha256'] != right_volume['probabilityArraySha256']:
        raise ValueError('Mirrored source channels are expected to have identical probability values')
    for manifest in manifests.values():
        manifest['grids']['right'] = grid(right_image)
        if manifest['grids']['right']['shape'] != left_grid['shape']:
            raise ValueError('Source hemisphere grid shapes differ')
    del right_values, right_image
    gc.collect()
    for kind, manifest in manifests.items():
        path = ROOT / f'public/subregions/{kind}-probability/manifest.json'
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(manifest, indent=2) + '\n')
        print(kind, 'parts:', len(manifest['entries']), 'manifest:', path.stat().st_size)
    print('Unique channels:', len(channels), 'total compressed:', sum(item['bytes'] for item in channels.values()),
          'largest:', max(item['bytes'] for item in channels.values()),
          'shared winner context:', context['bytes'])


if __name__ == '__main__':
    build()
