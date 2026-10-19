"""Pack probability-atlas winner labels in Cerebra's standalone mesh format."""
import nibabel as nib
import numpy as np
from skimage.measure import marching_cubes


def pack_surfaces(image, winners, entries):
    return pack_surface_sets([(image, winners, entries)])


def pack_surface_sets(sets):
    surfaces = []
    omitted = []
    for image, winners, entries in sets:
        for entry in entries:
            mask = winners == entry['channel']
            voxels = int(mask.sum())
            if not voxels:
                omitted.append({**entry, 'voxels': 0, 'reason': 'No maximum-probability winner voxels'})
                continue
            vertices, faces, _, _ = marching_cubes(mask.astype(np.float32), level=0.5)
            if np.linalg.det(image.affine[:3, :3]) < 0:
                faces = faces[:, [0, 2, 1]]
            ras = nib.affines.apply_affine(image.affine, vertices)
            display = ras[:, [0, 2, 1]]
            display[:, 2] *= -1
            surfaces.append((entry, display, faces, voxels))
    all_vertices = np.concatenate([vertices for _, vertices, _, _ in surfaces])
    origin = (all_vertices.min(axis=0) + all_vertices.max(axis=0)) / 2
    blob = bytearray()
    parts = []
    for entry, vertices, faces, voxels in surfaces:
        vertices = vertices - origin + np.array([0, 5, 10])
        normals = np.zeros_like(vertices)
        cross = np.cross(vertices[faces[:, 1]] - vertices[faces[:, 0]],
                         vertices[faces[:, 2]] - vertices[faces[:, 0]])
        for corner in range(3):
            np.add.at(normals, faces[:, corner], cross)
        normals /= np.maximum(np.linalg.norm(normals, axis=1, keepdims=True), 1e-30)
        arrays = [vertices.astype('<f4'), normals.astype('<f4'),
                  np.ones(len(vertices), dtype='<f4'), faces.astype('<u4')]
        parts.append({**entry, 'offset': len(blob), 'vertices': len(vertices),
                      'triangles': len(faces), 'voxels': voxels,
                      'center': vertices.mean(axis=0).round(3).tolist()})
        blob.extend(b''.join(array.tobytes() for array in arrays))
    return bytes(blob), parts, omitted, origin.tolist()
