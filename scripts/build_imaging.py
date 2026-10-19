"""Build compact, aligned browser volumes from public MRI and IBC statistical maps."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import gzip, hashlib, json, re, urllib.request, zipfile
import nibabel as nib
import numpy as np
from nibabel.processing import resample_from_to

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/imaging'
OUT = ROOT / 'public/imaging'
OUT.mkdir(parents=True, exist_ok=True)
SHAPE = (97, 115, 97)
AFFINE = np.array([[2,0,0,-96],[0,2,0,-132],[0,0,2,-78],[0,0,0,1]], dtype=float)
MNI_URL = 'https://www.bic.mni.mcgill.ca/~vfonov/icbm/2009/mni_icbm152_nlin_asym_09c_nifti.zip'
MNI_SOURCE = 'https://www.bic.mni.mcgill.ca/ServicesAtlases/ICBM152NLin2009'
IBC_SOURCE = 'https://neurovault.org/collections/4438/'
provenance = []
checksums_path = ROOT / 'scripts/imaging-checksums.json'
expected = json.loads(checksums_path.read_text()) if checksums_path.exists() else {}

def download(name, url):
    path = CACHE / name
    if not path.exists():
        request = urllib.request.Request(url, headers={'User-Agent': 'Cerebra educational atlas/1.0'})
        with urllib.request.urlopen(request, timeout=120) as response: path.write_bytes(response.read())
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    if name in expected and digest != expected[name]: raise ValueError(f'Checksum changed: {name}')
    provenance.append({'file':name,'url':url,'sha256':digest})
    return path

def encode(data, name, dtype):
    raw = np.asarray(data, dtype=dtype).tobytes(order='F')
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    (OUT / f'{name}.volume').write_bytes(packed)
    return {'url':f'/imaging/{name}.volume','bytes':len(packed),'rawBytes':len(raw), 'sha256':hashlib.sha256(raw).hexdigest(), 'dtype':dtype}

archive = download('icbm-2009c.zip', MNI_URL)
scans = []
with zipfile.ZipFile(archive) as z:
    (OUT/'MNI-LICENSE.txt').write_bytes(z.read('COPYING'))
    maskfile = next(n for n in z.namelist() if n.endswith('09c_mask.nii') and 't1_' in n)
    mask_image = nib.Nifti1Image.from_bytes(z.read(maskfile))
    native_mask = mask_image.get_fdata() > .5
    mask = resample_from_to(mask_image, (SHAPE,AFFINE), order=0).get_fdata() > .5
    for name,title,description in [
      ('t1','T1-weighted MRI','White matter is generally brighter than gray matter; cerebrospinal fluid is dark. Explore structural boundaries and cortical folds.'),
      ('t2','T2-weighted MRI','Fluid is bright in this contrast. Compare the ventricles and tissue boundaries against the T1-weighted template.'),
      ('pd','Proton-density MRI','A complementary tissue contrast influenced by mobile proton density and acquisition settings. This is a weighted image, not a quantitative water map.')]:
        member = next(n for n in z.namelist() if n.endswith(f'_{name}_tal_nlin_asym_09c.nii'))
        image = nib.Nifti1Image.from_bytes(z.read(member))
        values = image.get_fdata()
        values[~native_mask] = 0
        ceiling = float(np.percentile(values[native_mask],99.8))
        scaled = np.round(np.clip(values / ceiling,0,1)*255).astype('u1')
        scans.append({'id':name,'title':title,'description':description,'kind':'Population MRI template','source':MNI_SOURCE,'original':MNI_URL,'nativeResolution':1,'displayResolution':1,'grid':{'shape':list(image.shape),'origin':[-96,-132,-78],'spacing':[1,1,1],'orientation':'RAS+','space':'ICBM152 2009c asymmetric'},'members':152,'intensity':'Arbitrary grayscale, scaled for display','asset':encode(scaled,name,'u1')})

metadata = json.loads((ROOT/'scripts/imaging-map-sources.json').read_text())
# Select the earliest uploaded example for every distinct contrast in participant sub-01.
unique = {}
for m in sorted(metadata,key=lambda m:m['id']):
    if m['name'].startswith('sub-01_'):
        unique.setdefault(m['name'].split('_',2)[2],m)

task_names = {
 'standard localizer fMRI task paradigm':('ArchiStandard','Language & calculation'),
 'spatial localizer fMRI task paradigm':('ArchiSpatial','Space & action'),
 'Social localizer fMRI task paradigm':('ArchiSocial','Social cognition'),
 'emotional localizer fMRI task paradigm':('ArchiEmotional','Faces & emotion'),
 'language processing fMRI task paradigm':('HcpLanguage','Language & calculation'),
 'social cognition (theory of mind) fMRI task paradigm':('HcpSocial','Social cognition'),
 'gambling fMRI task paradigm':('HcpGambling','Reward & decisions'),
 'motor fMRI task paradigm':('HcpMotor','Movement'),
 'emotion processing fMRI task paradigm':('HcpEmotion','Faces & emotion'),
 'relational processing fMRI task paradigm':('HcpRelational','Reasoning'),
 'working memory fMRI task paradigm':('HcpWm','Working memory & vision'),
 'synatcting and semantic fMRI task paradigm':('RSVPLanguage','Reading & syntax')}
import csv
contrasts = list(csv.DictReader((OUT/'ibc-contrasts.tsv').open(),delimiter='\t'))
lookup = {(r['task'],r['contrast']):r for r in contrasts}

def make_map(item):
    key,m = item
    task,domain = task_names[m['cognitive_paradigm_cogatlas']]
    row = lookup.get((task,key),{})
    positive = row.get('positive label') or key.split('-')[0].replace('_',' ')
    negative = row.get('negative label') or ('fixation' if '-' not in key else key.split('-',1)[1].replace('_',' '))
    if task == 'HcpMotor' and key.endswith('-avg'): negative = 'the other movement conditions, averaged'
    if task == 'HcpWm' and key.endswith('-avg'):
        categories = {'body':'body images', 'face':'face images', 'place':'place images', 'tools':'tool images'}
        negative = ', '.join(v for k,v in categories.items() if k != key.split('-')[0])
    name = f'ibc-{m["id"]}'
    path = download(f'{name}.nii.gz',m['file'].replace('http:','https:'))
    image = nib.load(path)
    values = resample_from_to(image,(SHAPE,AFFINE),order=1).get_fdata()
    values = np.nan_to_num(values,nan=0,posinf=0,neginf=0)
    values[~mask] = 0
    scaled = np.rint(np.clip(values*100,-32767,32767)).astype('<i2')
    if not np.count_nonzero(scaled): raise ValueError(f'Empty statistical map: {name}')
    peak = np.unravel_index(np.argmax(values),SHAPE)
    record = {'id':name,'imageId':m['id'],'title':(positive[0].upper()+positive[1:]).replace('_',' '),'task':task,'domain':domain,
      'contrast':key,'positive':positive.replace('_',' '),'negative':negative.replace('_',' '),
      'description':f'Compare {positive.replace("_"," ")} with {negative.replace("_"," ")}.',
      'participant':'sub-01','session':re.search(r'ses-\d+',m['name']).group(0),
      'analysisLevel':m['analysis_level'],'subjects':m['number_of_subjects'],'statistic':m['map_type'],
      'source':f'https://neurovault.org/images/{m["id"]}/','original':m['file'].replace('http:','https:'),'collection':IBC_SOURCE,
      'protocol':f'https://individual-brain-charting.github.io/docs/tasks.html#{task.lower()}',
      'sourceName':m['name'],'nativeShape':list(image.shape),'nativeAffine':image.affine.tolist(),
      'peakVoxel':[int(v) for v in peak],'peakZ':round(float(values[peak]),2),'minZ':round(float(values.min()),2),
      'maxZ':round(float(values.max()),2),'scale':.01,'asset':encode(scaled,name,'<i2')}
    print(name,task,key,record['asset']['bytes'],flush=True)
    return record

with ThreadPoolExecutor(max_workers=4) as pool:
    maps = list(pool.map(make_map,unique.items()))
manifest = {'checkedOn':'2026-10-18','grid':{'shape':list(SHAPE),'origin':[-96,-132,-78],'spacing':[2,2,2],'orientation':'RAS+','order':'x-fastest (Fortran)','space':'MNI coordinates; ICBM152 2009c asymmetric background'},
 'scans':scans,'maps':maps,'provenance':sorted(provenance,key=lambda p:p['file']),
 'processing':'MRI kept at 1 mm, brain-masked and scaled to uint8. Z maps linearly resampled to the shared 2 mm grid, brain-masked, and quantized at 0.01 Z per int16 unit. No inferential threshold is applied to stored maps.'}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2))
checksums_path.write_text(json.dumps({p['file']:p['sha256'] for p in sorted(provenance,key=lambda p:p['file'])},indent=2))
print('BUILT',len(scans),'SCANS',len(maps),'MAPS',sum(m['asset']['bytes'] for m in maps),'bytes',flush=True)
