import { planeAxis, planeDimensions, voxelIndex, type Grid, type Plane, type Point3 } from "./imaging.ts";

export const xtractCallosalGuideStops: Record<string, number> = {
  fma: 0,
  fmi: 4,
};

export type XtractEntry = {
  channel: number;
  id: string;
  name: string;
  sourceName: string;
  subjects: { hcp: number; blsa: number; vu: number; subjects: number };
  nonzeroVoxelsAt2mm: number;
  peak: { index: Point3; probability: number; rasMm: Point3 };
  asset: {
    url: string;
    bytes: number;
    rawBytes: number;
    sha256: string;
    compressedSha256: string;
  };
};

export type XtractManifest = {
  version: number;
  checkedOn: string;
  title: string;
  grid: Grid;
  sourceGrid: { shape: number[]; origin: number[]; spacing: number[] };
  encoding: { dtype: string; byteOrder: string; order: string; scale: number; displayThresholdDefaultPercent: number; method: string };
  channels: XtractEntry[];
  source: { repository: string; commit: string; nifti: string; metadata: string; licenseFile: string; license: string; paper: string; method: string; niftiSha256: string; metadataSha256: string; licenseSha256: string };
  attribution: string;
  interpretation: string;
};

export function xtractMapSlice(
  plane: Plane,
  point: Point3,
  grid: Grid,
  values: Uint16Array,
  minimumPercent: number,
  scale: number,
) {
  const [horizontal, vertical] = planeDimensions[plane];
  const axis = planeAxis[plane];
  const width = grid.shape[horizontal];
  const height = grid.shape[vertical];
  const pixels = new Uint8ClampedArray(width * height * 4);
  const voxel = [...point] as Point3;
  for (let y = 0; y < height; y++) {
    voxel[vertical] = height - 1 - y;
    for (let x = 0; x < width; x++) {
      voxel[horizontal] = x;
      const value = values[voxelIndex(voxel, grid.shape)];
      const percent = (value / scale) * 100;
      const pixel = (y * width + x) * 4;
      if (value === 0 || percent < minimumPercent) {
        pixels.set([7, 14, 23, 255], pixel);
        continue;
      }
      const intensity = Math.max(0, Math.min(1, (percent - minimumPercent) / Math.max(1, 100 - minimumPercent)));
      pixels.set([
        Math.round(56 + intensity * 181),
        Math.round(110 + intensity * 113),
        Math.round(170 - intensity * 63),
        255,
      ], pixel);
    }
  }
  return { pixels, width, height, axis };
}
