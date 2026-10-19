import { assetUrl } from "./asset-url.ts";

export type Point3 = [number, number, number];
export type Plane = "axial" | "coronal" | "sagittal";
export type Grid = {
  shape: number[];
  origin: number[];
  spacing: number[];
  orientation: string;
  space: string;
};
export type VolumeAsset = {
  url: string;
  bytes: number;
  rawBytes: number;
  dtype: string;
  sha256: string;
};
export type Scan = {
  id: string;
  title: string;
  description: string;
  kind: string;
  source: string;
  original: string;
  nativeResolution: number;
  displayResolution: number;
  members: number;
  intensity: string;
  grid: Grid;
  asset: VolumeAsset;
};
export type ActivityMap = {
  id: string;
  imageId: number;
  title: string;
  task: string;
  domain: string;
  contrast: string;
  positive: string;
  negative: string;
  description: string;
  participant: string;
  session: string;
  analysisLevel: string;
  subjects: number;
  statistic: string;
  source: string;
  original: string;
  collection: string;
  protocol: string;
  sourceName: string;
  peakVoxel: Point3;
  peakZ: number;
  minZ: number;
  maxZ: number;
  scale: number;
  asset: VolumeAsset;
};
export type ImagingManifest = {
  checkedOn: string;
  grid: Grid;
  scans: Scan[];
  maps: ActivityMap[];
  processing: string;
};
export type Contrast = {
  id: string;
  task?: string;
  positive: string;
  negative: string;
  tags: string[];
};
export type Protocol = {
  id: string;
  title: string;
  domains: string[];
  source: string;
  contrasts: Contrast[];
};
export type ProtocolIndex = {
  checkedOn: string;
  protocols: Protocol[];
  contrasts: Contrast[];
  hcp: {
    id: number;
    name: string;
    source: string;
    subjects: number;
    statistic: string;
    contrast: string | null;
    analysisLevel: string | null;
  }[];
};
export type Volume = Uint8Array | Int16Array;
export type Polarity = "both" | "positive" | "negative";

export const planes: Plane[] = ["axial", "coronal", "sagittal"];
export const planeAxis: Record<Plane, number> = {
  axial: 2,
  coronal: 1,
  sagittal: 0,
};
export const planeDimensions: Record<Plane, [number, number]> = {
  axial: [0, 1],
  coronal: [0, 2],
  sagittal: [1, 2],
};
export const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
export function voxelIndex(point: number[], shape: number[]) {
  return point[0] + shape[0] * (point[1] + shape[1] * point[2]);
}
export function worldPoint(point: number[], grid: Grid): Point3 {
  return point.map((n, i) => grid.origin[i] + n * grid.spacing[i]) as Point3;
}
export function pointOnSlice(
  plane: Plane,
  u: number,
  v: number,
  point: Point3,
  grid: Grid,
): Point3 {
  const next = [...point] as Point3;
  const [horizontal, vertical] = planeDimensions[plane];
  next[horizontal] = clamp(
    Math.round(u * (grid.shape[horizontal] - 1)),
    0,
    grid.shape[horizontal] - 1,
  );
  next[vertical] = clamp(
    Math.round((1 - v) * (grid.shape[vertical] - 1)),
    0,
    grid.shape[vertical] - 1,
  );
  return next;
}
export function activityColor(
  z: number,
  threshold: number,
  maximum: number,
  polarity: Polarity,
): number[] | null {
  if (
    !Number.isFinite(z) ||
    z === 0 ||
    Math.abs(z) < threshold ||
    (polarity === "positive" && z < 0) ||
    (polarity === "negative" && z > 0)
  )
    return null;
  const t = clamp(
    (Math.abs(z) - threshold) / Math.max(maximum - threshold, 0.01),
    0,
    1,
  );
  return z > 0
    ? [244 + 11 * t, 112 + 126 * t, 52 + 65 * t]
    : [49 + 60 * t, 126 + 100 * t, 229 + 22 * t];
}
export function slicePixels(
  plane: Plane,
  point: Point3,
  grid: Grid,
  scan: Volume,
  overlay: Volume | null,
  options: {
    contrast: number;
    threshold: number;
    maximum: number;
    opacity: number;
    polarity: Polarity;
    backgroundGrid?: Grid;
  },
) {
  const [horizontal, vertical] = planeDimensions[plane];
  const background = options.backgroundGrid ?? grid;
  const width = background.shape[horizontal],
    height = background.shape[vertical];
  const pixels = new Uint8ClampedArray(width * height * 4);
  const world = worldPoint(point, grid);
  const voxel = world.map((value, i) =>
    Math.round((value - background.origin[i]) / background.spacing[i]),
  );
  const overlayVoxel = [...point];
  for (let y = 0; y < height; y++) {
    voxel[vertical] = height - 1 - y;
    for (let x = 0; x < width; x++) {
      voxel[horizontal] = x;
      overlayVoxel[horizontal] = clamp(
        Math.round(
          (background.origin[horizontal] +
            x * background.spacing[horizontal] -
            grid.origin[horizontal]) /
            grid.spacing[horizontal],
        ),
        0,
        grid.shape[horizontal] - 1,
      );
      overlayVoxel[vertical] = clamp(
        Math.round(
          (background.origin[vertical] +
            voxel[vertical] * background.spacing[vertical] -
            grid.origin[vertical]) /
            grid.spacing[vertical],
        ),
        0,
        grid.shape[vertical] - 1,
      );
      const offset = voxelIndex(voxel, background.shape),
        overlayOffset = voxelIndex(overlayVoxel, grid.shape),
        pixel = (y * width + x) * 4;
      const gray = scan[offset]
        ? clamp((scan[offset] - 127.5) * options.contrast + 127.5, 0, 255)
        : 0;
      const color = overlay
        ? activityColor(
            overlay[overlayOffset] * 0.01,
            options.threshold,
            options.maximum,
            options.polarity,
          )
        : null;
      for (let c = 0; c < 3; c++)
        pixels[pixel + c] = color
          ? gray * (1 - options.opacity) + color[c] * options.opacity
          : gray;
      pixels[pixel + 3] = 255;
    }
  }
  return { pixels, width, height };
}

const volumeCaches = {
  anatomy: new Map<string, Promise<Volume>>(),
  activity: new Map<string, Promise<Volume>>(),
};
export async function loadVolume(asset: VolumeAsset): Promise<Volume> {
  const cache =
    asset.dtype === "u1" ? volumeCaches.anatomy : volumeCaches.activity;
  const existing = cache.get(asset.url);
  if (existing) {
    cache.delete(asset.url);
    cache.set(asset.url, existing);
    return existing;
  }
  const pending = (async () => {
    const response = await fetch(assetUrl(asset.url));
    if (!response.ok || !response.body)
      throw new Error("The scan could not be loaded. Please retry.");
    if (!("DecompressionStream" in window))
      throw new Error(
        "This viewer needs a browser with native gzip support. Use a recent version of Chrome, Firefox, Safari, or Edge.",
      );
    const buffer = await new Response(
      response.body.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
    if (buffer.byteLength !== asset.rawBytes)
      throw new Error("The scan file is incomplete. Please retry.");
    return asset.dtype === "u1"
      ? new Uint8Array(buffer)
      : new Int16Array(buffer);
  })();
  cache.set(asset.url, pending);
  if (cache.size > 2) cache.delete(cache.keys().next().value!);
  try {
    return await pending;
  } catch (error) {
    cache.delete(asset.url);
    throw error;
  }
}
export function matchesQuery(query: string, values: (string | string[])[]) {
  const haystack = values.flat().join(" ").toLowerCase().replaceAll("_", " ");
  return query
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .split(/\s+/)
    .every((term) => haystack.includes(term));
}
