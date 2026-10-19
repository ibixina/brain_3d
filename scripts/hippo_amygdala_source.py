"""Read the pinned FreeSurfer hippocampus/amygdala probability grids."""
from pathlib import Path
import gzip
import hashlib
import urllib.request
import zipfile

import nibabel as nib
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
URL = ('https://surfer.nmr.mgh.harvard.edu/fswiki/SubfieldAtlasesICBMspace'
       '?action=AttachFile&do=get&target=HippoAmyg.zip')
SHA = '3bedb212780716a9ff5547eb28f5f3018270982f085c892303eb547cb4a85811'
NIFTI_SHA = {
    'left': 'a79d5f88acfa21684a6f8c1e78da21e74ccbf152e68fb845fde048f451c4474e',
    'right': '4d20bb95435afc9a139279ae2a159d8dfbf3f1b1de0d07d901ff6cf08570e5a3',
}


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def load_source(side):
    filename = f'HippoAmygProbs.MNIsymSpace.{side}.nii.gz'
    archive = ROOT / '.cache/subregions/HippoAmyg.zip'
    archive.parent.mkdir(parents=True, exist_ok=True)
    if not archive.exists():
        urllib.request.urlretrieve(URL, archive)
    if sha256(archive.read_bytes()) != SHA:
        raise ValueError('Hippocampus/amygdala source archive checksum changed')
    with zipfile.ZipFile(archive) as source:
        names = source.read('HippoAmygProbs.MNIsymSpace.names.txt').decode()
        image_bytes = source.read(filename)
    if sha256(image_bytes) != NIFTI_SHA[side]:
        raise ValueError('Source NIfTI checksum changed')
    rows = [line.split(',') for line in names.splitlines() if line.strip()]
    if len(rows) != 30 or rows[0] != ['0', 'Unknown']:
        raise ValueError('Unexpected hippocampus/amygdala channel table')
    image = nib.Nifti1Image.from_bytes(gzip.decompress(image_bytes))
    probs = image.get_fdata(dtype=np.float32)
    if (not np.isfinite(probs).all() or probs.min() < -1e-6
            or probs.max() > 1 + 1e-6
            or not np.allclose(probs.sum(axis=3), 1, atol=1e-6, rtol=0)):
        raise ValueError('Invalid label probabilities')
    probability_hash = hashlib.sha256()
    for channel in range(probs.shape[3]):
        probability_hash.update(np.ascontiguousarray(probs[..., channel]).tobytes())
    volume = dict(filename=filename, sha256=NIFTI_SHA[side], shape=list(image.shape),
                  affine=image.affine.tolist(), probabilityArraySha256=probability_hash.hexdigest(),
                  probabilityRange=[float(probs.min()), float(probs.max())])
    return image, probs, names, volume
