import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import {
  activityColor,
  matchesQuery,
  pointOnSlice,
  slicePixels,
  voxelIndex,
  worldPoint,
} from "../src/imaging.ts";
import { datasets, modalities } from "../src/imaging-resources.ts";
const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const manifest = JSON.parse(read("public/imaging/manifest.json"));
const index = JSON.parse(read("public/imaging/protocols.json"));
const sources = JSON.parse(read("scripts/imaging-map-sources.json"));
const voxelCount = manifest.grid.shape.reduce((a, b) => a * b, 1);
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
function unpack(asset) {
  const packed = read(`public${asset.url}`);
  assert.equal(packed.byteLength, asset.bytes);
  const raw = gunzipSync(packed);
  assert.equal(raw.byteLength, asset.rawBytes);
  assert.equal(hash(raw), asset.sha256);
  return raw;
}

test("three measured MRI templates retain native 1 mm anatomy alongside the shared 2 mm coordinate grid", () => {
  assert.deepEqual(manifest.grid.shape, [97, 115, 97]);
  assert.deepEqual(manifest.grid.origin, [-96, -132, -78]);
  assert.deepEqual(manifest.grid.spacing, [2, 2, 2]);
  assert.equal(manifest.grid.orientation, "RAS+");
  assert.deepEqual(
    manifest.scans.map((s) => s.id),
    ["t1", "t2", "pd"],
  );
  const sums = [];
  for (const scan of manifest.scans) {
    const raw = unpack(scan.asset);
    assert.equal(raw.byteLength, 193 * 229 * 193);
    assert.deepEqual(scan.grid.shape, [193, 229, 193]);
    assert.deepEqual(scan.grid.spacing, [1, 1, 1]);
    assert.equal(scan.asset.dtype, "u1");
    assert.equal(scan.members, 152);
    assert.equal(scan.nativeResolution, 1);
    assert.equal(scan.displayResolution, 1);
    assert.equal(raw[0], 0);
    assert.ok(raw.some((n) => n === 255));
    sums.push(raw.reduce((sum, n) => sum + n, 0));
  }
  assert.equal(new Set(sums).size, 3);
});
test("all 117 local activation volumes retain signed Z values, exact checksums, and coherent peaks", () => {
  assert.equal(manifest.maps.length, 117);
  assert.equal(new Set(manifest.maps.map((m) => m.id)).size, 117);
  assert.equal(new Set(manifest.maps.map((m) => m.task)).size, 12);
  for (const map of manifest.maps) {
    const raw = unpack(map.asset);
    assert.equal(raw.byteLength, voxelCount * 2);
    assert.equal(map.asset.dtype, "<i2");
    assert.equal(map.scale, 0.01);
    assert.equal(map.statistic, "Z map");
    assert.equal(map.subjects, 1);
    assert.equal(map.analysisLevel, "single-subject");
    assert.equal(map.participant, "sub-01");
    let min = 0,
      max = 0,
      nonzero = 0;
    for (let i = 0; i < raw.length; i += 2) {
      const value = raw.readInt16LE(i);
      min = Math.min(min, value);
      max = Math.max(max, value);
      if (value) nonzero++;
    }
    assert.ok(nonzero > 1000, map.id);
    assert.ok(min < 0 && max > 0, map.id);
    assert.ok(Math.abs(min * 0.01 - map.minZ) <= 0.011, map.id);
    assert.ok(Math.abs(max * 0.01 - map.maxZ) <= 0.011, map.id);
    assert.ok(
      Math.abs(
        raw.readInt16LE(voxelIndex(map.peakVoxel, manifest.grid.shape) * 2) *
          0.01 -
          map.peakZ,
      ) <= 0.011,
      map.id,
    );
    assert.equal(new URL(map.source).hostname, "neurovault.org");
    assert.match(
      map.original,
      /^https:\/\/neurovault.org\/media\/images\/4438\//,
    );
  }
  assert.ok(
    manifest.maps.reduce((sum, m) => sum + m.asset.bytes, 0) < 40_000_000,
  );
});
test("local examples correspond to retained public source records and pinned checksums", () => {
  const checks = JSON.parse(read("scripts/imaging-checksums.json"));
  assert.equal(sources.length, 117);
  assert.equal(manifest.provenance.length, 118);
  assert.equal(Object.keys(checks).length, 118);
  for (const map of manifest.maps) {
    const original = sources.find((s) => s.id === map.imageId);
    assert.ok(original);
    assert.equal(original.name, map.sourceName);
    assert.equal(original.file.replace("http:", "https:"), map.original);
    const input = manifest.provenance.find(
      (p) => p.file === map.id + ".nii.gz",
    );
    assert.equal(input.sha256, checks[input.file]);
  }
  assert.ok(read("public/imaging/MNI-LICENSE.txt").includes("Louis Collins"));
});
test("research compilation retains its complete bounded source snapshots and distinct HCP cohort", () => {
  assert.equal(index.protocols.length, 87);
  assert.equal(index.contrasts.length, 799);
  assert.equal(index.hcp.length, 48);
  assert.equal(new Set(index.protocols.map((p) => p.id)).size, 87);
  for (const protocol of index.protocols) {
    assert.ok(protocol.domains.length);
    assert.equal(
      new URL(protocol.source).hostname,
      "individual-brain-charting.github.io",
    );
  }
  for (const contrast of index.contrasts) {
    assert.ok(
      contrast.task && contrast.id && contrast.positive && contrast.negative,
    );
    assert.ok(Array.isArray(contrast.tags));
  }
  for (const image of index.hcp) {
    assert.equal(image.subjects, 486);
    assert.ok(["Z map", "T map"].includes(image.statistic));
    assert.equal(new URL(image.source).hostname, "www.neurovault.org");
  }
  assert.equal(index.hcp.filter((m) => m.statistic === "Z map").length, 47);
  assert.equal(index.hcp.filter((m) => m.statistic === "T map").length, 1);
  assert.equal(modalities.length, 15);
  assert.equal(datasets.length, 20);
  assert.equal(index.sources.length, 3);
  assert.match(index.contrastCodeCommit, /^[a-f0-9]{40}$/);
});
test("slice navigation preserves physical left/right, selected plane, and world coordinates", () => {
  const grid = {
    shape: [3, 4, 5],
    origin: [-2, -4, -6],
    spacing: [2, 2, 2],
    orientation: "RAS+",
    space: "test",
  };
  assert.deepEqual(worldPoint([1, 2, 3], grid), [0, 0, 0]);
  assert.equal(voxelIndex([2, 3, 4], grid.shape), 59);
  assert.deepEqual(pointOnSlice("axial", 0, 0, [1, 2, 3], grid), [0, 3, 3]);
  assert.deepEqual(pointOnSlice("coronal", 1, 1, [1, 2, 3], grid), [2, 2, 0]);
  assert.deepEqual(pointOnSlice("sagittal", 1, 0, [1, 2, 3], grid), [1, 3, 4]);
  assert.deepEqual(pointOnSlice("axial", -3, 6, [1, 2, 3], grid), [0, 0, 3]);
  const data = new Uint8Array(60);
  data[voxelIndex([0, 3, 2], grid.shape)] = 70;
  data[voxelIndex([2, 0, 2], grid.shape)] = 180;
  const result = slicePixels("axial", [1, 2, 2], grid, data, null, {
    contrast: 1,
    threshold: 3,
    maximum: 8,
    opacity: 1,
    polarity: "both",
  });
  assert.equal(result.width, 3);
  assert.equal(result.height, 4);
  assert.deepEqual([...result.pixels.slice(0, 4)], [70, 70, 70, 255]);
  assert.deepEqual([...result.pixels.slice(-4)], [180, 180, 180, 255]);
});
test("activation display handles signed contrasts and thresholds without turning zeros into activity", () => {
  assert.equal(activityColor(0, 0, 8, "both"), null);
  assert.equal(activityColor(2.9, 3, 8, "both"), null);
  assert.equal(activityColor(-4, 3, 8, "positive"), null);
  assert.equal(activityColor(4, 3, 8, "negative"), null);
  const positive = activityColor(5, 3, 8, "both"),
    negative = activityColor(-5, 3, 8, "both");
  assert.ok(positive[0] > positive[2]);
  assert.ok(negative[2] > negative[0]);
  assert.equal(activityColor(NaN, 0, 8, "both"), null);
  const grid = {
    shape: [1, 1, 1],
    origin: [0, 0, 0],
    spacing: [2, 2, 2],
    orientation: "RAS+",
    space: "test",
  };
  const base = new Uint8Array([100]),
    overlay = new Int16Array([400]);
  const options = {
    contrast: 1,
    threshold: 3,
    maximum: 8,
    opacity: 0,
    polarity: "both",
  };
  assert.deepEqual(
    [...slicePixels("axial", [0, 0, 0], grid, base, overlay, options).pixels],
    [100, 100, 100, 255],
  );
  assert.ok(matchesQuery("right hand", ["right_hand-avg", "movement"]));
  assert.ok(!matchesQuery("memory auditory", ["motor", "right hand"]));
});

test("native 1 mm background and 2 mm statistics align through physical coordinates", () => {
  const grid = {
    shape: [2, 2, 2],
    origin: [0, 0, 0],
    spacing: [2, 2, 2],
    orientation: "RAS+",
    space: "test",
  };
  const backgroundGrid = { ...grid, shape: [3, 3, 3], spacing: [1, 1, 1] };
  const scan = new Uint8Array(27).fill(90);
  scan[voxelIndex([2, 0, 2], backgroundGrid.shape)] = 150;
  const overlay = new Int16Array(8);
  overlay[voxelIndex([1, 0, 1], grid.shape)] = 500;
  const options = {
    contrast: 1,
    threshold: 3,
    maximum: 8,
    opacity: 1,
    polarity: "both",
    backgroundGrid,
  };
  const image = slicePixels("axial", [0, 0, 1], grid, scan, overlay, options);
  assert.equal(image.width, 3);
  assert.equal(image.height, 3);
  const last = image.pixels.slice(-4);
  assert.ok(last[0] > last[2]);
  assert.deepEqual([...image.pixels.slice(0, 4)], [90, 90, 90, 255]);
});
