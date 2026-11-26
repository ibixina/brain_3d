import { assetUrl } from "./asset-url.ts";
import { planeDimensions, voxelIndex, type Grid, type Plane, type Point3 } from "./imaging.ts";

export type ProbabilityEncoding = { slope: number; intercept: number };
export type ProbabilityValues = Uint8Array | Float32Array;
export type ProbabilitySliceSource = { grid: Grid; encoding: ProbabilityEncoding };

export type ProbabilityAsset = {
  url: string;
  bytes: number;
  rawBytes: number;
  sha256: string;
  compressedSha256: string;
};
export type CerebellarProbability = {
  version: number;
  kind: string;
  checkedOn: string;
  grid: Grid;
  encoding: { dtype: string; order: string; slope: number; intercept: number; displayEndpointTolerance: number };
  labels: ProbabilityAsset;
  entries: Record<string, {
    label: number;
    channel: number;
    sourceName: string;
    asset: ProbabilityAsset;
    positiveVoxels: number;
    categoricalVoxels: number;
    peak: { index: Point3; storedValue: number; categoricalLabel: number };
  }>;
  source: {
    url: string;
    documentation: string;
    studies: { title: string; url: string }[];
    license: string;
  };
  method: string;
  interpretation: string;
};

export const cerebellarProbabilityUrl = "/subregions/cerebellum-probability/manifest.json";

export async function loadProbabilityBytes(asset: ProbabilityAsset, signal: AbortSignal) {
  const response = await fetch(assetUrl(asset.url), { signal });
  if (!response.ok || !response.body) throw new Error("Probability data unavailable");
  const buffer = await new Response(response.body.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  if (buffer.byteLength !== asset.rawBytes) throw new Error("Incomplete probability data");
  return new Uint8Array(buffer);
}

export function sourceProbability(stored: number, encoding: ProbabilityEncoding) {
  return Math.max(0, Math.min(1, stored * encoding.slope + encoding.intercept));
}

// All planes use neurological orientation: R to the right, A up (axial) or S up.
export function probabilitySlice(plane: Plane, point: Point3, data: ProbabilitySliceSource,
  values: ProbabilityValues, labels: Uint8Array, selectedLabel: number, flipHorizontal = false) {
  const [horizontal, vertical] = planeDimensions[plane];
  const width = data.grid.shape[horizontal], height = data.grid.shape[vertical];
  const pixels = new Uint8ClampedArray(width * height * 4);
  const voxel = [...point];
  for (let y = 0; y < height; y++) {
    voxel[vertical] = height - 1 - y;
    for (let x = 0; x < width; x++) {
      voxel[horizontal] = flipHorizontal ? width - 1 - x : x;
      const offset = voxelIndex(voxel, data.grid.shape);
      const p = sourceProbability(values[offset], data.encoding);
      let rgb = labels[offset] ? [35, 49, 61] : [11, 20, 30];
      if (p > 0) rgb = [33 + p * 209, 82 + p * 125, 107 - p * 5];
      if (labels[offset] === selectedLabel) {
        const edge = [horizontal, vertical].some((axis) => [-1, 1].some((step) => {
          const neighbor = [...voxel];
          neighbor[axis] += step;
          return neighbor[axis] < 0 || neighbor[axis] >= data.grid.shape[axis] ||
            labels[voxelIndex(neighbor, data.grid.shape)] !== selectedLabel;
        }));
        if (edge) rgb = [217, 235, 235];
      }
      const pixel = (y * width + x) * 4;
      pixels.set([...rgb, 255], pixel);
    }
  }
  return { pixels, width, height };
}

export function moveProbabilityPoint(point: Point3, plane: Plane, key: string, shape: number[], flipHorizontal = false): Point3 | null {
  const [horizontal, vertical] = planeDimensions[plane];
  const left = flipHorizontal ? 1 : -1, right = flipHorizontal ? -1 : 1;
  const delta = key === "ArrowLeft" ? [horizontal, left] : key === "ArrowRight" ? [horizontal, right] :
    key === "ArrowUp" ? [vertical, 1] : key === "ArrowDown" ? [vertical, -1] : null;
  if (!delta) return null;
  const next = [...point] as Point3;
  next[delta[0]] = Math.max(0, Math.min(shape[delta[0]] - 1, next[delta[0]] + delta[1]));
  return next;
}

export function probabilityPointAt(point: Point3, plane: Plane, u: number, v: number, shape: number[], flipHorizontal = false): Point3 {
  const [horizontal, vertical] = planeDimensions[plane];
  const next = [...point] as Point3;
  const atPixel = (fraction: number, size: number) => Math.max(0, Math.min(size - 1, Math.floor(fraction * size)));
  const x = atPixel(u, shape[horizontal]);
  next[horizontal] = flipHorizontal ? shape[horizontal] - 1 - x : x;
  next[vertical] = shape[vertical] - 1 - atPixel(v, shape[vertical]);
  return next;
}
