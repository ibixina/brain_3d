import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { worldPoint } from "../src/imaging.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read("public/subregions/hippocampus-probability/manifest.json"));
const atlas = JSON.parse(read("src/hippocampus-subregions.json"));
const reference = JSON.parse(read("src/reference-data.json"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const unpack = (asset) => gunzipSync(read(`public${asset.url}`));

test("native hippocampal probability provenance, float encoding, and bilateral reflected grids are explicit", () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.kind, "hippocampus");
  assert.equal(manifest.source.archiveSha256, atlas.source.archiveSha256);
  assert.deepEqual(manifest.source.niftiSha256, Object.fromEntries(Object.entries(atlas.source.volumes).map(([side, volume]) => [side, volume.sha256])));
  assert.equal(manifest.source.probabilityArraySha256, atlas.source.volumes.left.probabilityArraySha256);
  assert.equal(manifest.source.documentation, atlas.source.documentation);
  assert.equal(manifest.source.paper, atlas.source.paper);
  assert.equal(manifest.source.protocol, atlas.source.protocol);
  assert.equal(manifest.source.license, atlas.source.license);
  assert.match(manifest.source.license, /freesurfer\.txt/);
  assert.equal(manifest.encoding.dtype, "float32");
  assert.equal(manifest.encoding.order, "x-fastest");
  assert.equal(manifest.encoding.slope, 1);
  assert.equal(manifest.encoding.intercept, 0);
  assert.deepEqual(manifest.grids.left.shape, [164, 224, 196]);
  assert.deepEqual(manifest.grids.right.shape, manifest.grids.left.shape);
  assert.ok(manifest.grids.left.spacing[0] > 0);
  assert.ok(manifest.grids.right.spacing[0] < 0);
  assert.deepEqual(worldPoint([0, 0, 0], manifest.grids.left), manifest.grids.left.origin);
  assert.deepEqual(worldPoint([0, 0, 0], manifest.grids.right), manifest.grids.right.origin);
  assert.equal(worldPoint([1, 0, 0], manifest.grids.right)[0], manifest.grids.right.origin[0] - .25);
  assert.match(manifest.method, /No probability interpolation, resampling, thresholding, renormalization, or additional quantization/);
  assert.match(manifest.method, /all 30 channels/);
  assert.match(manifest.interpretation, /not MRI intensities, an individual scan, task activation/);
  assert.equal(manifest.categories.length, 30);
  assert.equal(manifest.categories[0].sourceName, "Unknown");
  assert.ok(manifest.categories.slice(21).every((item) => item.sourceName));
});

test("every displayed part uses one exact, bounded, losslessly decoded channel and a valid peak", () => {
  const parts = atlas.parts;
  const unique = new Map();
  let total = 0;
  for (const part of parts) {
    const entry = manifest.entries[part.id];
    assert.ok(entry);
    assert.equal(entry.channel, part.channel);
    assert.equal(entry.label, part.label);
    assert.equal(entry.sourceName, part.sourceName);
    assert.equal(entry.categoricalVoxels, part.voxels);
    const earlier = unique.get(entry.channel);
    if (earlier) {
      assert.equal(entry.asset.sha256, earlier.asset.sha256);
      assert.deepEqual(entry.peak.index, earlier.peak.index);
      assert.equal(entry.peak.probability, earlier.peak.probability);
      continue;
    }
    unique.set(entry.channel, entry);
    const packed = read(`public${entry.asset.url}`);
    const raw = unpack(entry.asset);
    assert.equal(hash(packed), entry.asset.compressedSha256);
    assert.equal(hash(raw), entry.asset.sha256);
    assert.equal(raw.byteLength, 164 * 224 * 196 * 4);
    assert.ok(packed.byteLength < 1_200_000);
    total += packed.byteLength;
    const values = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    let positive = 0, maximum = -Infinity;
    for (const value of values) {
      if (value > 0) positive++;
      if (value > maximum) maximum = value;
    }
    assert.equal(positive, entry.positiveVoxels);
    assert.equal(maximum, entry.peak.probability);
    const [x, y, z] = entry.peak.index;
    const offset = x + 164 * (y + 224 * z);
    assert.equal(values[offset], maximum);
  }
  assert.equal(unique.size, 20);
  assert.ok(total < 10_000_000);
  assert.ok(read("public/subregions/hippocampus-probability/manifest.json").byteLength < 45_000);
});

test("all-channel winning context retains hippocampal regions and adjacent amygdala/background source categories", () => {
  const asset = manifest.context.asset;
  const packed = read(`public${asset.url}`);
  const raw = unpack(asset);
  assert.equal(hash(packed), asset.compressedSha256);
  assert.equal(hash(raw), asset.sha256);
  assert.equal(raw.byteLength, 164 * 224 * 196);
  const winners = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
  const counts = new Uint32Array(manifest.categories.length);
  for (const channel of winners) counts[channel]++;
  assert.ok(counts[0] > 0);
  assert.ok(counts.slice(1, 21).some((count) => count > 0));
  assert.ok(counts.slice(21).some((count) => count > 0));
  for (const part of atlas.parts) {
    assert.equal(counts[part.channel], part.voxels, part.id);
  }
});

test("bilateral slice entries retain their selected hippocampal label and existing whole-region reader links", () => {
  for (const part of atlas.parts) {
    const entry = manifest.entries[part.id];
    assert.ok(entry);
    assert.ok(manifest.grids[part.hemisphere]);
    assert.equal(manifest.categories[entry.peak.winnerChannel].sourceName, entry.peak.winnerSourceName);
    const link = reference.articles.find((article) => article.id === "hippocampal-formation");
    assert.ok(link.regions.includes(part.hemisphere === "left" ? "aseg-17" : "aseg-53"));
    const opposite = atlas.parts.find((other) => other.key === part.key && other.hemisphere !== part.hemisphere);
    assert.equal(manifest.entries[opposite.id].asset.sha256, entry.asset.sha256);
  }
});
