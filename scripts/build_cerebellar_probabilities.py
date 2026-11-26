"""Split the pinned atlas into lossless, independently requested native channels."""
from pathlib import Path
import gzip
import hashlib
import json
import urllib.request

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
NAME = 'atl-Anatom_space-MNISym_probseg.nii'
SOURCE_SHA = 'df9525c4f57be8b2c577dc61b16e765898aa6fa3b79c77a78f925c5f3e8214ff'


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def build():
    atlas = json.loads((ROOT / 'src/cerebellum-subregions.json').read_text())
    url = f'https://raw.githubusercontent.com/DiedrichsenLab/cerebellar_atlases/{atlas["source"]["commit"]}/Diedrichsen_2009/{NAME}'
    path = ROOT / '.cache/subregions/cerebellum' / NAME
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, path)
    if sha256(path.read_bytes()) != SOURCE_SHA:
        raise ValueError('Source probability checksum changed')
    image = nib.load(path)
    raw = image.dataobj.get_unscaled()
    scale, intercept = float(image.dataobj.slope), float(image.dataobj.inter)
    shape = atlas['source']['shape']
    if raw.shape != (*shape, 34) or raw.dtype != np.dtype('uint8') or intercept != 0:
        raise ValueError('Unexpected source layout or scaling')
    np.testing.assert_array_equal(image.affine, atlas['source']['affine'])
    if not 0 < scale * 255 <= 1.000001:
        raise ValueError('Unexpected probability units')
    labels_image = nib.Nifti1Image.from_bytes(gzip.decompress((ROOT / 'public/subregions/cerebellum-labels.nii.gz').read_bytes()))
    labels = np.asarray(labels_image.dataobj).astype('uint8')
    out = ROOT / 'public/subregions/cerebellum-probability'
    out.mkdir(parents=True, exist_ok=True)

    def asset(name, values):
        data = values.tobytes(order='F')
        compressed = gzip.compress(data, mtime=0)
        (out / name).write_bytes(compressed)
        return dict(url=f'/subregions/cerebellum-probability/{name}', bytes=len(compressed),
                    rawBytes=len(data), sha256=sha256(data), compressedSha256=sha256(compressed))

    entries = {}
    for part in atlas['parts']:
        channel = part['label'] - 1
        values = raw[..., channel]
        # C-array first maximum is an explicit, reproducible tie rule.
        peak = list(map(int, np.unravel_index(values.argmax(), shape)))
        entries[part['id']] = dict(
            label=part['label'], channel=channel, sourceName=part['sourceName'],
            asset=asset(f'{part["label"]}.u8.gz', values),
            positiveVoxels=int(np.count_nonzero(values)), categoricalVoxels=part['voxels'],
            peak=dict(index=peak, storedValue=int(values[tuple(peak)]), categoricalLabel=int(labels[tuple(peak)])),
        )
    manifest = dict(
        version=1, kind='cerebellum', checkedOn='2026-10-19',
        grid=dict(shape=shape, origin=image.affine[:3, 3].tolist(), spacing=[1, 1, 1],
                  orientation='RAS', space='MNI152NLin2009cSymC (MNISym)'),
        encoding=dict(dtype='uint8', order='x-fastest', slope=scale, intercept=intercept,
                      displayEndpointTolerance=1e-6),
        labels=asset('labels.u8.gz', labels), entries=entries,
        source=dict(url=url, sha256=SOURCE_SHA, bytes=path.stat().st_size,
                    commit=atlas['source']['commit'], documentation=atlas['source']['documentation'],
                    studies=[dict(title=atlas['source']['paperTitle'], url=atlas['source']['paper']), *atlas['source']['otherStudies']],
                    license=atlas['source']['license'],
                    categoricalSha256=atlas['source']['files']['atl-Anatom_space-MNISym_dseg.nii']['sha256'],
                    lookupSha256=atlas['source']['files']['atl-Anatom.tsv']['sha256'],
                    permissionSha256=atlas['source']['files']['README.md']['sha256']),
        method='Native uint8 probability channels are separated and losslessly gzip-compressed in x-fastest order. Source slope and intercept are retained; no interpolation, resampling, thresholding, renormalization, or new quantization. Coordinates and sampling stay in the original 1 mm grid. Peak uses the first maximum in C-array order. The published categorical volume is shown independently, not recomputed. Rounded endpoint scaling slightly above 1 is clamped only for display.',
        interpretation='Lobular channels (1–28) and nuclear channels (29–34) derive from different participant groups. There is no background probability channel. Values must not be renormalized together or used to invent a background probability. The categorical map can say background at a label’s probability peak. The images show atlas label probabilities, not MRI intensities, task activation, individual anatomy, or an accuracy score.',
    )
    (out / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('Channels:', len(entries), 'total compressed:', sum(item['asset']['bytes'] for item in entries.values()),
          'largest:', max(item['asset']['bytes'] for item in entries.values()), 'context:', manifest['labels']['bytes'])


if __name__ == '__main__':
    build()
