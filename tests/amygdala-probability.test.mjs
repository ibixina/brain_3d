import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read("public/subregions/amygdala-probability/manifest.json"));
const atlas = JSON.parse(read("src/amygdala-subregions.json"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("amygdala probability manifest retains its source, nine labels, and reflected native grids", () => {
  assert.equal(manifest.kind, "amygdala");
  assert.equal(manifest.source.archiveSha256, atlas.source.archiveSha256);
  assert.deepEqual(manifest.source.niftiSha256, Object.fromEntries(Object.entries(atlas.source.volumes).map(([side, volume]) => [side, volume.sha256])));
  assert.equal(manifest.source.probabilityArraySha256, atlas.source.volumes.left.probabilityArraySha256);
  assert.equal(manifest.source.paper, atlas.source.paper);
  assert.equal(manifest.source.protocol, atlas.source.protocol);
  assert.equal(manifest.source.documentation, atlas.source.documentation);
  assert.match(manifest.source.license, /freesurfer\.txt/);
  assert.deepEqual(manifest.grids.left.shape, [164, 224, 196]);
  assert.ok(manifest.grids.left.spacing[0] > 0);
  assert.ok(manifest.grids.right.spacing[0] < 0);
  assert.equal(manifest.encoding.dtype, "float32");
  assert.equal(manifest.encoding.order, "x-fastest");
  assert.equal(manifest.categories.length, 30);
  assert.ok(manifest.categories.slice(21).every((item) => item.structure === "amygdala"));
  assert.equal(Object.keys(manifest.entries).length, 18);
  assert.match(manifest.method, /all 30 channels/);
  assert.match(manifest.interpretation, /not MRI intensities, an individual scan, task activation/);
});

test("all nine source channels are exact lazy derivatives shared across the hemispheres", () => {
  const unique = new Map();
  for (const part of atlas.parts) {
    const entry = manifest.entries[part.id];
    assert.ok(entry, part.id);
    assert.equal(entry.channel, part.channel);
    assert.equal(entry.sourceName, part.sourceName);
    assert.equal(entry.categoricalVoxels, part.voxels);
    assert.equal(manifest.categories[entry.channel].sourceName, part.sourceName);
    const previous = unique.get(entry.channel);
    if (previous) {
      assert.equal(entry.asset.sha256, previous.asset.sha256);
      assert.deepEqual(entry.peak.index, previous.peak.index);
      continue;
    }
    unique.set(entry.channel, entry);
    const packed = read(`public${entry.asset.url}`);
    const raw = gunzipSync(packed);
    assert.equal(hash(packed), entry.asset.compressedSha256);
    assert.equal(hash(raw), entry.asset.sha256);
    assert.equal(raw.byteLength, 164 * 224 * 196 * 4);
    assert.ok(packed.byteLength < 1_200_000);
    const values = new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4);
    const [x, y, z] = entry.peak.index;
    assert.equal(values[x + 164 * (y + 224 * z)], entry.peak.probability);
  }
  assert.equal(unique.size, 9);
  const contextAsset = manifest.context.asset;
  const contextPacked = read(`public${contextAsset.url}`);
  const context = gunzipSync(contextPacked);
  assert.equal(hash(contextPacked), contextAsset.compressedSha256);
  assert.equal(hash(context), contextAsset.sha256);
  assert.equal(context.byteLength, 164 * 224 * 196);
  const counts = new Uint32Array(30);
  for (const channel of context) counts[channel]++;
  for (const part of atlas.parts) assert.equal(counts[part.channel], part.voxels, part.id);
});
