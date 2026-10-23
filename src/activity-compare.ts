import type { Grid, Point3 } from "./imaging";

export type Measure = "consistency" | "specificity";
export type Lens = "overlap" | "a" | "b" | "a-only" | "b-only" | "shared";
export type MetaSummary = {
  voxels: number;
  cutoff: number | null;
  peakVoxel: Point3;
  peakZ: number;
};
export type MetaActivity = {
  id: string;
  title: string;
  category: string;
  terms: string[];
  description: string;
  kind: "meta-analysis";
  studies: number;
  maps: Record<Measure, MetaSummary>;
  peakProportion: number;
  peakProportionVoxel: Point3;
  asset: { url: string; bytes: number; rawBytes: number; sha256: string };
};
export type ActivityManifest = {
  checkedOn: string;
  grid: Grid;
  method: Record<string, string | number>;
  labels: {
    asset: { url: string; bytes: number; rawBytes: number; sha256: string };
    parts: { id: string; name: string; hemisphere: string; group: string }[];
    method: string;
    mni305ToMni152: number[][];
  };
  activities: MetaActivity[];
};
export type PathwayRole = {
  role: "damaged" | "route";
  parts: string[];
  label: string;
  text: string;
  sources: { label: string; url: string }[];
};
export type Pathway = {
  id: string;
  title: string;
  category: string;
  description: string;
  summary: string;
  roles: PathwayRole[];
  caution: string;
};

/** One loaded side of a comparison, expressed on the shared 2 mm grid. */
export type Layer =
  | {
      kind: "volume";
      key: string;
      /** Statistic in 0.01 units; values at or above the threshold count as active. */
      values: Int16Array;
      threshold: number;
      proportion?: Uint8Array;
    }
  | { kind: "regions"; key: string; parts: Set<string> };

export const lensLabels: Record<Lens, string> = {
  overlap: "Overlap",
  a: "A",
  b: "B",
  "a-only": "Only A",
  "b-only": "Only B",
  shared: "Shared",
};
// Validated as a three-slot categorical set on the dark surface (all-pairs CVD ΔE ≥ 9.4).
export const comparisonColors = {
  a: "#d95926",
  b: "#3987e5",
  shared: "#199e70",
};

const LEFT = 1,
  RIGHT = 2;

/** Strength (in z units, or 1 for pathway membership) of a layer at a voxel. */
export function layerValue(
  layer: Layer | null,
  voxel: number,
  part: string | null,
): number {
  if (!layer) return 0;
  if (layer.kind === "regions") return part && layer.parts.has(part) ? 1 : 0;
  const value = layer.values[voxel] * 0.01;
  return value >= layer.threshold && value > 0 ? value : 0;
}

/** Bit flags: 1 = active in A, 2 = active in B. */
export function membership(a: number, b: number) {
  return (a > 0 ? LEFT : 0) | (b > 0 ? RIGHT : 0);
}

export function lensIncludes(lens: Lens, flags: number) {
  switch (lens) {
    case "overlap":
      return flags !== 0;
    case "a":
      return (flags & LEFT) !== 0;
    case "b":
      return (flags & RIGHT) !== 0;
    case "a-only":
      return flags === LEFT;
    case "b-only":
      return flags === RIGHT;
    case "shared":
      return flags === (LEFT | RIGHT);
  }
}

function hexColor(hex: string) {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}
const rgb = {
  a: hexColor(comparisonColors.a),
  b: hexColor(comparisonColors.b),
  shared: hexColor(comparisonColors.shared),
};

/**
 * Display color (0-255 RGB) and opacity for one location, or null when the lens hides it.
 * Single-activity lenses use one hue whose opacity rises with strength.
 */
export function lensColor(
  lens: Lens,
  a: number,
  b: number,
  scaleA = 8,
  scaleB = 8,
): [number[], number] | null {
  const flags = membership(a, b);
  if (!lensIncludes(lens, flags)) return null;
  const strength = (value: number, scale: number) =>
    0.55 + 0.45 * Math.min(1, value / Math.max(scale, 0.01));
  if (lens === "a") return [rgb.a, strength(a, scaleA)];
  if (lens === "b") return [rgb.b, strength(b, scaleB)];
  if (flags === (LEFT | RIGHT))
    return [rgb.shared, Math.max(strength(a, scaleA), strength(b, scaleB))];
  return flags === LEFT
    ? [rgb.a, strength(a, scaleA)]
    : [rgb.b, strength(b, scaleB)];
}

export type RegionStat = {
  id: string;
  voxels: number;
  a: number;
  b: number;
  shared: number;
  peakA: number;
  peakB: number;
  peakVoxel: number;
};

/** Count active voxels within each labelled atlas part. */
export function regionStats(
  labels: Uint8Array,
  parts: { id: string }[],
  a: Layer | null,
  b: Layer | null,
): RegionStat[] {
  const stats = parts.map((part) => ({
    id: part.id,
    voxels: 0,
    a: 0,
    b: 0,
    shared: 0,
    peakA: 0,
    peakB: 0,
    peakVoxel: -1,
    best: -1,
  }));
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label) continue;
    const stat = stats[label - 1];
    stat.voxels++;
    const va = layerValue(a, i, stat.id),
      vb = layerValue(b, i, stat.id);
    if (va > 0) stat.a++;
    if (vb > 0) stat.b++;
    if (va > 0 && vb > 0) stat.shared++;
    if (va > stat.peakA) stat.peakA = va;
    if (vb > stat.peakB) stat.peakB = vb;
    const score = Math.max(va, vb);
    if (score > stat.best) {
      stat.best = score;
      stat.peakVoxel = i;
    }
  }
  return stats.map(({ best: _best, ...stat }) => stat);
}

/** Fraction of a part's voxels matching a lens, used to rank parts in the inspector. */
export function lensFraction(stat: RegionStat, lens: Lens) {
  if (!stat.voxels) return 0;
  const onlyA = stat.a - stat.shared,
    onlyB = stat.b - stat.shared;
  const count = {
    overlap: stat.a + stat.b - stat.shared,
    a: stat.a,
    b: stat.b,
    "a-only": onlyA,
    "b-only": onlyB,
    shared: stat.shared,
  }[lens];
  return count / stat.voxels;
}

export function lensVolume(
  stats: RegionStat[],
  lens: Lens,
  voxelVolume = 8,
) {
  let voxels = 0;
  for (const stat of stats) voxels += lensFraction(stat, lens) * stat.voxels;
  return (voxels * voxelVolume) / 1000;
}

// FreeSurfer MNI305 (fsaverage) to MNI152 affine; the renderer stores [R, S, -A].
export function displayToMni152(point: number[], matrix: number[][]): Point3 {
  const mni305 = [point[0], -point[2], point[1]];
  return [0, 1, 2].map(
    (row) =>
      matrix[row][0] * mni305[0] +
      matrix[row][1] * mni305[1] +
      matrix[row][2] * mni305[2] +
      matrix[row][3],
  ) as Point3;
}
export function mni152ToDisplay(point: number[], matrix: number[][]): Point3 {
  const [[a, b, c, x], [d, e, f, y], [g, h, i, z]] = matrix;
  const p = [point[0] - x, point[1] - y, point[2] - z];
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  const inv = [
    [(e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det],
    [(f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det],
    [(d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det],
  ];
  const mni305 = inv.map(
    (row) => row[0] * p[0] + row[1] * p[1] + row[2] * p[2],
  );
  return [mni305[0], mni305[2], -mni305[1]];
}
export function voxelAt(world: number[], grid: Grid): Point3 | null {
  const voxel = world.map((value, i) =>
    Math.round((value - grid.origin[i]) / grid.spacing[i]),
  );
  return voxel.every((value, i) => value >= 0 && value < grid.shape[i])
    ? (voxel as Point3)
    : null;
}
export function voxelPoint(index: number, shape: number[]): Point3 {
  const x = index % shape[0];
  const y = Math.floor(index / shape[0]) % shape[1];
  const z = Math.floor(index / (shape[0] * shape[1]));
  return [x, y, z];
}

/**
 * Largest layer value along a short inward segment beneath a surface vertex.
 * Cortical normals point outward; the stored segmentation-surface normals point inward,
 * so `outward` is -1 for those surfaces.
 */
export function surfaceSample(
  layer: Layer | null,
  part: string,
  position: number[],
  normal: number[],
  grid: Grid,
  matrix: number[][],
  outward = 1,
  depths = [0, 1, 2, 3],
) {
  if (!layer) return 0;
  if (layer.kind === "regions") return layer.parts.has(part) ? 1 : 0;
  let best = 0;
  const [sx, sy, sz] = grid.shape;
  const [m0, m1, m2] = matrix;
  for (const step of depths) {
    // Inlined displayToMni152 and voxelAt: this runs for every vertex at every depth.
    const depth = step * outward;
    const r = position[0] - normal[0] * depth,
      s = position[1] - normal[1] * depth,
      a = -(position[2] - normal[2] * depth);
    const x = Math.round(
      (m0[0] * r + m0[1] * a + m0[2] * s + m0[3] - grid.origin[0]) / grid.spacing[0],
    );
    const y = Math.round(
      (m1[0] * r + m1[1] * a + m1[2] * s + m1[3] - grid.origin[1]) / grid.spacing[1],
    );
    const z = Math.round(
      (m2[0] * r + m2[1] * a + m2[2] * s + m2[3] - grid.origin[2]) / grid.spacing[2],
    );
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) continue;
    const value = layerValue(layer, x + sx * (y + sy * z), part);
    if (value > best) best = value;
  }
  return best;
}

export function unpackActivity(buffer: ArrayBuffer, voxels: number) {
  return {
    consistency: new Int16Array(buffer, 0, voxels),
    specificity: new Int16Array(buffer, voxels * 2, voxels),
    proportion: new Uint8Array(buffer, voxels * 4, voxels),
  };
}

export type ActivityKey = `${"meta" | "ibc" | "pathway"}:${string}`;
export function parseKey(key: string | null): {
  source: "meta" | "ibc" | "pathway";
  id: string;
} | null {
  const match = key?.match(/^(meta|ibc|pathway):([\w-]+)$/);
  return match
    ? { source: match[1] as "meta" | "ibc" | "pathway", id: match[2] }
    : null;
}
