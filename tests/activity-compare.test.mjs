import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  displayToMni152,
  layerValue,
  lensColor,
  lensFraction,
  lensIncludes,
  membership,
  mni152ToDisplay,
  parseKey,
  regionStats,
  surfaceSample,
  unpackActivity,
  voxelAt,
  voxelPoint,
} from "../src/activity-compare.ts";
import { voxelIndex } from "../src/imaging.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const manifest = JSON.parse(read("public/activity/manifest.json"));
const catalog = JSON.parse(read("scripts/activity-catalog.json"));
const pathways = JSON.parse(read("src/activity-pathways.json"));
const atlas = JSON.parse(read("src/atlas-manifest.json"));
const imaging = JSON.parse(read("public/imaging/manifest.json"));
const studies = JSON.parse(read("public/activity/studies.json"));
const { grid } = manifest;
const matrix = manifest.labels.mni305ToMni152;
const voxels = grid.shape.reduce((a, b) => a * b, 1);
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
function unpack(asset) {
  const packed = read(`public${asset.url}`);
  assert.equal(packed.byteLength, asset.bytes);
  const raw = gunzipSync(packed);
  assert.equal(raw.byteLength, asset.rawBytes);
  assert.equal(hash(raw), asset.sha256);
  return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
}
const labels = new Uint8Array(unpack(manifest.labels.asset));
const partIndex = (id) => manifest.labels.parts.findIndex((p) => p.id === id) + 1;
const overview = read("public/models/atlas.bin");
function surface(part) {
  const view = (offset, count) =>
    new Float32Array(overview.buffer.slice(overview.byteOffset + offset, overview.byteOffset + offset + count * 4));
  return {
    positions: view(part.offset, part.vertices * 3),
    normals: view(part.offset + part.vertices * 12, part.vertices * 3),
  };
}

test("comparison lenses partition A, B, and shared locations", () => {
  assert.equal(membership(0, 0), 0);
  assert.equal(membership(4, 0), 1);
  assert.equal(membership(0, 4), 2);
  assert.equal(membership(4, 4), 3);
  assert.ok(lensIncludes("a-only", 1) && !lensIncludes("a-only", 3));
  assert.ok(lensIncludes("b-only", 2) && !lensIncludes("b-only", 3));
  assert.ok(lensIncludes("shared", 3) && !lensIncludes("shared", 1));
  assert.ok(lensIncludes("a", 3) && lensIncludes("a", 1) && !lensIncludes("a", 2));
  assert.equal(lensColor("overlap", 0, 0), null);
  assert.deepEqual(lensColor("overlap", 5, 5)[0], [0x19, 0x9e, 0x70]);
  assert.deepEqual(lensColor("overlap", 5, 0)[0], [0xd9, 0x59, 0x26]);
  assert.deepEqual(lensColor("overlap", 0, 5)[0], [0x39, 0x87, 0xe5]);
  assert.equal(lensColor("shared", 5, 0), null);
  // Single-activity lenses fade in with strength but stay visible at threshold.
  assert.ok(lensColor("a", 2, 0, 8)[1] < lensColor("a", 8, 0, 8)[1]);
  assert.ok(lensColor("a", 0.1, 0, 8)[1] >= 0.55);
});

test("layers count only values at or above their threshold", () => {
  const values = new Int16Array([0, 250, 320, -500]);
  const layer = { kind: "volume", key: "x", values, threshold: 3 };
  assert.deepEqual([0, 1, 2, 3].map((i) => layerValue(layer, i, null)), [0, 0, 3.2, 0]);
  const regions = { kind: "regions", key: "p", parts: new Set(["aseg-18"]) };
  assert.equal(layerValue(regions, 0, "aseg-18"), 1);
  assert.equal(layerValue(regions, 0, "aseg-54"), 0);
  assert.equal(layerValue(null, 0, "aseg-18"), 0);
  const stats = regionStats(
    new Uint8Array([1, 1, 2, 0]),
    [{ id: "one" }, { id: "two" }],
    { kind: "volume", key: "a", values: new Int16Array([400, 0, 500, 900]), threshold: 3 },
    { kind: "volume", key: "b", values: new Int16Array([400, 400, 0, 900]), threshold: 3 },
  );
  assert.deepEqual(
    stats.map(({ id, voxels, a, b, shared, peakVoxel }) => ({ id, voxels, a, b, shared, peakVoxel })),
    [
      { id: "one", voxels: 2, a: 1, b: 2, shared: 1, peakVoxel: 0 },
      { id: "two", voxels: 1, a: 1, b: 0, shared: 0, peakVoxel: 2 },
    ],
  );
  assert.equal(lensFraction(stats[0], "b-only"), 0.5);
  assert.equal(lensFraction(stats[0], "shared"), 0.5);
  assert.equal(lensFraction(stats[1], "a-only"), 1);
});

test("renderer, MNI305, and MNI152 coordinates convert both ways", () => {
  for (const point of [[0, 0, 0], [-40, 10, -20], [55, -30, 70]]) {
    const back = displayToMni152(mni152ToDisplay(point, matrix), matrix);
    back.forEach((value, i) => assert.ok(Math.abs(value - point[i]) < 1e-6));
  }
  // Renderer [R, S, -A] holds MNI305 R, A, S; the documented transform adds about 1.5 mm in y.
  const shifted = displayToMni152([0, 0, 0], matrix);
  assert.ok(Math.abs(shifted[1] - 1.5496) < 1e-9);
  assert.deepEqual(voxelAt([-96, -132, -78], grid), [0, 0, 0]);
  assert.equal(voxelAt([500, 0, 0], grid), null);
  const index = voxelIndex([5, 7, 9], grid.shape);
  assert.deepEqual(voxelPoint(index, grid.shape), [5, 7, 9]);
  assert.deepEqual(parseKey("meta:music"), { source: "meta", id: "music" });
  assert.deepEqual(parseKey("ibc:ibc-100941"), { source: "ibc", id: "ibc-100941" });
  assert.equal(parseKey("meta:../x"), null);
  assert.equal(parseKey(null), null);
});

test("every catalogued activity has a checksummed, FDR-thresholded meta-analysis", () => {
  assert.deepEqual(manifest.grid.shape, imaging.grid.shape);
  assert.deepEqual(manifest.grid.origin, imaging.grid.origin);
  assert.deepEqual(
    manifest.activities.map((a) => a.id),
    catalog.activities.map((a) => a.id),
  );
  assert.ok(manifest.activities.length >= 50);
  for (const activity of manifest.activities) {
    assert.ok(catalog.categories.includes(activity.category), activity.id);
    assert.ok(activity.studies >= manifest.method.minimumStudies, activity.id);
    assert.equal(studies.lists[activity.id].length, activity.studies, activity.id);
    assert.equal(activity.asset.rawBytes, voxels * 5, activity.id);
    const maps = unpackActivity(unpack(activity.asset), voxels);
    for (const measure of ["consistency", "specificity"]) {
      const summary = activity.maps[measure];
      const values = maps[measure];
      let count = 0,
        minimum = Infinity;
      for (const value of values)
        if (value > 0) {
          count++;
          minimum = Math.min(minimum, value);
        }
      assert.equal(count, summary.voxels, `${activity.id} ${measure} voxel count`);
      if (!count) continue;
      // Stored values begin at the corrected cutoff; nothing below it is retained.
      assert.ok(Math.abs(minimum / 100 - summary.cutoff) <= 0.01, `${activity.id} ${measure} cutoff`);
      assert.ok(summary.cutoff > 2.5, `${activity.id} ${measure} corrected threshold`);
      assert.ok(Math.abs(values[voxelIndex(summary.peakVoxel, grid.shape)] / 100 - summary.peakZ) <= 0.011);
    }
    assert.ok(activity.maps.consistency.voxels > 500, `${activity.id} has consistent activation`);
    const peak = maps.proportion[voxelIndex(activity.peakProportionVoxel, grid.shape)];
    assert.ok(Math.abs(peak / 200 - activity.peakProportion) < 0.003);
  }
  for (const id of new Set(Object.values(studies.lists).flat()))
    assert.ok(studies.titles[id], `title for ${id}`);
});

test("activity maps land on the expected anatomy", () => {
  const strongest = (id, measure = "specificity") => {
    const activity = manifest.activities.find((a) => a.id === id);
    const maps = unpackActivity(unpack(activity.asset), voxels);
    const totals = new Map();
    maps[measure].forEach((value, i) => {
      if (value > 0 && labels[i]) {
        const part = manifest.labels.parts[labels[i] - 1].id;
        totals.set(part, (totals.get(part) ?? 0) + 1);
      }
    });
    return [...totals].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([part]) => part);
  };
  const music = strongest("music");
  assert.ok(music.some((p) => /superiortemporal|transversetemporal/.test(p)), music.join());
  const fear = strongest("fear");
  assert.ok(fear.includes("aseg-18") || fear.includes("aseg-54"), fear.join());
  const motor = strongest("finger-tapping");
  assert.ok(motor.some((p) => /precentral|postcentral|aseg-(8|47)/.test(p)), motor.join());
  const scenes = strongest("scenes");
  assert.ok(scenes.some((p) => /parahippocampal|lingual|isthmus|fusiform/.test(p)), scenes.join());
});

test("the label grid covers all 104 model parts at their known locations", () => {
  assert.equal(labels.length, voxels);
  assert.deepEqual(
    manifest.labels.parts.map((p) => p.id),
    atlas.parts.map((p) => p.id),
  );
  const present = new Set(labels);
  for (let i = 1; i <= atlas.parts.length; i++) assert.ok(present.has(i), atlas.parts[i - 1].id);
  const centroid = (id) => {
    const target = partIndex(id);
    const sum = [0, 0, 0];
    let n = 0;
    labels.forEach((label, i) => {
      if (label !== target) return;
      voxelPoint(i, grid.shape).forEach((v, k) => (sum[k] += grid.origin[k] + v * grid.spacing[k]));
      n++;
    });
    return sum.map((v) => v / n);
  };
  const near = (point, expected, tolerance) =>
    assert.ok(Math.hypot(...point.map((v, i) => v - expected[i])) < tolerance, `${point} vs ${expected}`);
  near(centroid("aseg-18"), [-24, -6, -19], 5); // left amygdala
  near(centroid("aseg-49"), [11, -18, 6], 5); // right thalamus
  near(centroid("rh-transversetemporal"), [46, -18, 9], 6); // Heschl's gyrus
});

test("3D surfaces sample the label grid of their own part", () => {
  const sampled = (part) => {
    const { positions, normals } = surface(part);
    const own = { kind: "regions", key: "x", parts: new Set() };
    const layer = {
      kind: "volume",
      key: "labels",
      values: Int16Array.from(labels, (label) => (label === partIndex(part.id) ? 100 : 0)),
      threshold: 1,
    };
    let hits = 0;
    const count = part.vertices;
    for (let i = 0; i < count; i++) {
      const p = [positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]];
      const n = [normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]];
      if (surfaceSample(layer, part.id, p, n, grid, matrix, part.kind === "cortex" ? 1 : -1) > 0) hits++;
    }
    assert.equal(surfaceSample(own, part.id, [0, 0, 0], [0, 0, 1], grid, matrix), 0);
    return hits / count;
  };
  const cortex = atlas.parts.filter((p) => p.kind === "cortex").map(sampled).sort((a, b) => a - b);
  assert.ok(cortex[Math.floor(cortex.length / 2)] > 0.7, `median cortical agreement ${cortex[34]}`);
  for (const id of ["aseg-10", "aseg-17", "aseg-18", "aseg-16", "aseg-12", "aseg-54"])
    assert.ok(sampled(atlas.parts.find((p) => p.id === id)) > 0.9, id);
});

test("evidence pathways name real model parts and cite their sources", () => {
  const ids = new Set(atlas.parts.map((p) => p.id));
  for (const pathway of pathways.pathways) {
    assert.ok(pathway.roles.some((role) => role.role === "damaged"));
    for (const role of pathway.roles) {
      assert.ok(role.parts.length > 0);
      role.parts.forEach((id) => assert.ok(ids.has(id), id));
      assert.ok(role.sources.length > 0);
      role.sources.forEach((source) => assert.match(source.url, /^https:\/\/doi\.org\/10\./));
    }
  }
});
