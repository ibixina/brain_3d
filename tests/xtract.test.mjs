import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { voxelIndex, worldPoint } from "../src/imaging.ts";
import { probabilityPointAt } from "../src/probability-slices.ts";
import { xtractMapSlice } from "../src/tractography.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read("public/tractography/xtract/manifest.json"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("Xtract manifest documents all 42 distinct population pathways and their source grid", () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.channels.length, 42);
  assert.equal(new Set(manifest.channels.map(({ id }) => id)).size, 42);
  assert.equal(new Set(manifest.channels.map(({ channel }) => channel)).size, 42);
  assert.deepEqual(manifest.grid.shape, [97, 115, 97]);
  assert.deepEqual(manifest.grid.origin, [-96, -132, -78]);
  assert.deepEqual(manifest.grid.spacing, [2, 2, 2]);
  assert.deepEqual(manifest.sourceGrid.shape, [193, 229, 193]);
  assert.deepEqual(manifest.sourceGrid.spacing, [1, 1, 1]);
  assert.equal(manifest.grid.space, "MNI152 standard space");
  assert.equal(manifest.encoding.compression, "gzip");
  assert.match(manifest.interpretation, /population overlap/i);
  assert.match(manifest.interpretation, /not overlaid/i);
  assert.equal(manifest.source.commit, "2caf44296666c13aa5c4d7d1c88d14fe553d9553");
  assert.equal(manifest.source.license, "CC BY 4.0");
  assert.match(manifest.attribution, /Cerebra's 2-mm grid and uint16 files are marked modifications/);
  assert.equal(hash(read("public/tractography/xtract/LICENSE.txt")), manifest.source.licenseDisplaySha256);
});

test("each on-demand pathway has valid contributors, peak coordinates, encoding and reproducible bytes", () => {
  let totalBytes = 0;
  for (const channel of manifest.channels) {
    const { subjects, peak, asset } = channel;
    assert.equal(subjects.subjects, subjects.hcp + subjects.blsa + subjects.vu, channel.id);
    assert.ok(subjects.subjects > 0, channel.id);
    assert.ok(peak.probability > 0 && peak.probability <= 1, channel.id);
    assert.deepEqual(worldPoint(peak.index, manifest.grid), peak.rasMm, channel.id);
    assert.equal(asset.rawBytes, manifest.grid.shape.reduce((a, b) => a * b, 1) * 2, channel.id);
    const packed = read(`public${asset.url}`);
    assert.match(asset.url, /\.u16\.bin$/);
    assert.equal(packed.byteLength, asset.bytes, channel.id);
    assert.equal(hash(packed), asset.compressedSha256, channel.id);
    const raw = gunzipSync(packed);
    assert.equal(raw.byteLength, asset.rawBytes, channel.id);
    assert.equal(hash(raw), asset.sha256, channel.id);
    const values = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2);
    let peakValue = 0;
    for (const value of values) peakValue = Math.max(peakValue, value);
    assert.equal(peakValue, Math.round(peak.probability * 65535), channel.id);
    assert.ok(asset.bytes < 200_000, channel.id);
    totalBytes += asset.bytes;
  }
  assert.ok(totalBytes < 3_000_000);
});

test("three orthogonal tract slices preserve voxel order, display threshold and linked sampling", () => {
  const grid = { shape: [3, 4, 2], origin: [-2, -3, -1], spacing: [2, 2, 2] };
  const values = new Uint16Array(24);
  values[voxelIndex([1, 2, 1], grid.shape)] = 32768;
  values[voxelIndex([2, 2, 1], grid.shape)] = 65535;
  const point = [1, 2, 1];
  for (const [plane, width, height, pixel] of [["axial", 3, 4, 4], ["coronal", 3, 2, 1], ["sagittal", 4, 2, 2]]) {
    const slice = xtractMapSlice(plane, point, grid, values, 0, 65535);
    assert.equal(slice.width, width);
    assert.equal(slice.height, height);
    assert.equal(slice.pixels.length, width * height * 4);
    assert.deepEqual([...slice.pixels.slice(pixel * 4, pixel * 4 + 3)], [147, 167, 138]);
  }
  const axial = xtractMapSlice("axial", point, grid, values, 0, 65535);
  const selected = (1 * 3 + 1);
  assert.deepEqual([...axial.pixels.slice(selected * 4, selected * 4 + 3)], [147, 167, 138]);
  const thresholded = xtractMapSlice("axial", point, grid, values, 60, 65535);
  assert.deepEqual([...thresholded.pixels.slice(selected * 4, selected * 4 + 3)], [7, 14, 23]);
  assert.deepEqual(probabilityPointAt(point, "axial", 0.99, 0.01, grid.shape), [2, 3, 1]);
  assert.deepEqual(probabilityPointAt(point, "coronal", 0.01, 0.99, grid.shape), [0, 2, 0]);
  assert.deepEqual(probabilityPointAt(point, "sagittal", 0.99, 0.01, grid.shape), [1, 3, 1]);
});

test("the atlas loads only when opened and does not download a structural MRI in place of its separate grid", () => {
  const workspace = read("src/components/ImagingWorkspace.tsx").toString();
  const lazyWorkspace = read("src/components/XtractWorkspace.tsx").toString();
  const slice = read("src/components/XtractSlice.tsx").toString();
  assert.match(workspace, /lazy\(\(\) => import\("\.\/XtractWorkspace"\)\)/);
  assert.match(workspace, /useVolume\(showTractAtlas \? undefined : scan\?\.asset\)/);
  assert.match(workspace, /params\.set\("tract", tractId\)/);
  assert.match(lazyWorkspace, /on-demand pathway catalogue/);
  assert.match(lazyWorkspace, /Loading \{entry\.name\} only/);
  assert.match(slice, /L ← · R → · A ↑ · P ↓/);
  assert.match(slice, /L ← · R → · S ↑ · I ↓/);
  assert.match(slice, /P ← · A → · S ↑ · I ↓/);
});
