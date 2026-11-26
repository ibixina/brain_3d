import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { moveProbabilityPoint, probabilityPointAt, probabilitySlice, sourceProbability } from "../src/probability-slices.ts";
import { planeAxis, planeDimensions, planes, voxelIndex, worldPoint } from "../src/imaging.ts";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url));
const manifest = JSON.parse(read("public/subregions/cerebellum-probability/manifest.json"));
const atlas = JSON.parse(read("src/cerebellum-subregions.json"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const volume = (asset) => gunzipSync(read("public" + asset.url));
const labels = volume(manifest.labels);

test("native probability channels retain independent source provenance, units and categorical context", () => {
  assert.equal(manifest.version, 1);
  assert.equal(manifest.kind, "cerebellum");
  assert.equal(manifest.source.sha256, "df9525c4f57be8b2c577dc61b16e765898aa6fa3b79c77a78f925c5f3e8214ff");
  assert.equal(manifest.source.bytes, 41096152);
  assert.equal(manifest.source.commit, atlas.source.commit);
  assert.equal(manifest.source.categoricalSha256, atlas.source.files["atl-Anatom_space-MNISym_dseg.nii"].sha256);
  assert.equal(manifest.source.lookupSha256, atlas.source.files["atl-Anatom.tsv"].sha256);
  assert.equal(manifest.source.permissionSha256, atlas.source.files["README.md"].sha256);
  assert.equal(manifest.source.license, atlas.source.license);
  assert.deepEqual(manifest.grid.shape, [153,100,79]);
  assert.deepEqual(manifest.grid.origin, [-76,-103,-70]);
  assert.deepEqual(manifest.grid.spacing, [1,1,1]);
  assert.equal(manifest.grid.orientation, "RAS");
  assert.equal(manifest.encoding.slope, 0.003921568859368563);
  assert.equal(manifest.encoding.intercept, 0);
  assert.equal(manifest.encoding.order, "x-fastest");
  assert.equal(manifest.encoding.dtype, "uint8");
  assert.match(manifest.interpretation, /different participant groups/);
  assert.match(manifest.interpretation, /no background probability channel/);
  assert.match(manifest.method, /no interpolation, resampling, thresholding, renormalization, or new quantization/);
  assert.match(read("public" + manifest.source.license).toString(), /original NIfTI scaling retained/);
});

test("every independently requested channel and categorical grid has exact hashes and bounded size", () => {
  let total = 0;
  for (const asset of [manifest.labels, ...Object.values(manifest.entries).map((entry) => entry.asset)]) {
    const packed = read("public" + asset.url), raw = gunzipSync(packed);
    assert.equal(hash(packed), asset.compressedSha256);
    assert.equal(hash(raw), asset.sha256);
    assert.equal(raw.length, manifest.grid.shape.reduce((a,b) => a*b));
    assert.equal(asset.rawBytes, raw.length);
    assert.equal(asset.bytes, packed.length);
    assert.ok(packed.length < 40_000);
    total += packed.length;
  }
  assert.ok(total < 600_000);
  assert.ok(read("public/subregions/cerebellum-probability/manifest.json").length < 35_000);
  assert.deepEqual(Object.keys(manifest.entries).sort(), atlas.parts.map((part) => part.id).sort());
});

test("every channel's native support, exact peak sample and categorical counts match its retained bytes", () => {
  for (const part of atlas.parts) {
    const entry = manifest.entries[part.id], raw = volume(entry.asset);
    assert.equal(entry.label, part.label);
    assert.equal(entry.channel, part.label - 1);
    assert.equal(entry.sourceName, part.sourceName);
    assert.equal(entry.categoricalVoxels, part.voxels);
    assert.equal(labels.filter((n) => n === entry.label).length, entry.categoricalVoxels);
    assert.equal(raw.filter((n) => n > 0).length, entry.positiveVoxels);
    const sample = voxelIndex(entry.peak.index, manifest.grid.shape);
    assert.equal(raw[sample], entry.peak.storedValue);
    assert.equal(labels[sample], entry.peak.categoricalLabel);
    assert.ok(raw.every((n) => n <= entry.peak.storedValue));
  }
});

test("tiny fastigial categorical fragments do not hide broader low-probability support or invent background probabilities", () => {
  for (const [id, support, categorical, peak, ras] of [
    ["cereb-33",335,2,61,[-2,-54,-28]], ["cereb-34",277,5,65,[2,-54,-28]],
  ]) {
    const entry = manifest.entries[id];
    assert.equal(entry.positiveVoxels, support);
    assert.equal(entry.categoricalVoxels, categorical);
    assert.equal(entry.peak.storedValue, peak);
    assert.equal(entry.peak.categoricalLabel, 0);
    assert.deepEqual(worldPoint(entry.peak.index, manifest.grid), ras);
    assert.ok(sourceProbability(peak, manifest.encoding) < .26);
  }
  const vermis = manifest.entries["cereb-9"];
  assert.equal(vermis.positiveVoxels, 1322);
  assert.equal(vermis.categoricalVoxels, 20);
  assert.equal(vermis.peak.storedValue, 161);
  assert.ok(sourceProbability(vermis.peak.storedValue, manifest.encoding) > .63);
  assert.equal(sourceProbability(255, manifest.encoding), 1);
  assert.equal(sourceProbability(0, manifest.encoding), 0);
});

test("all source slice planes sample x-fastest voxels with R/A to the right and A/S at the top", () => {
  const shape = [3,4,5], grid = { ...manifest.grid, shape }, data = { ...manifest, grid };
  const raw = Uint8Array.from({length:60}, (_, i) => i + 1), context = new Uint8Array(60);
  for (const plane of planes) {
    const point = [1,2,3], [h,v] = planeDimensions[plane];
    const slice = probabilitySlice(plane, point, data, raw, context, 1);
    assert.equal(slice.width, shape[h]); assert.equal(slice.height, shape[v]);
    for (let y = 0; y < slice.height; y++) for (let x = 0; x < slice.width; x++) {
      const sample = [...point]; sample[h] = x; sample[v] = shape[v]-1-y;
      const p = sourceProbability(raw[voxelIndex(sample,shape)], data.encoding);
      const expected = Uint8ClampedArray.from([33+p*209,82+p*125,107-p*5,255]);
      assert.deepEqual(slice.pixels.slice((y*slice.width+x)*4,(y*slice.width+x+1)*4),expected);
    }
    assert.equal(point[planeAxis[plane]], [1,2,3][planeAxis[plane]]);
  }
});

test("float32 channels preserve source probabilities and mirror the reflected side for rightward RAS display", () => {
  const shape = [2, 2, 1], grid = { ...manifest.grid, shape }, data = { grid, encoding: { slope: 1, intercept: 0 } };
  const values = Float32Array.from([.25, .5, .75, 1]);
  const context = new Uint8Array(4);
  assert.equal(sourceProbability(values[0], data.encoding), .25);
  const right = probabilitySlice("axial", [0, 0, 0], data, values, context, 1, true);
  assert.deepEqual(right.pixels.slice(0, 4), Uint8ClampedArray.from([242, 207, 102, 255]));
  assert.equal(right.width, 2);
});

test("right-side click and arrow movement follow displayed RAS left/right in the axial and coronal planes", () => {
  const shape = [4, 5, 6], start = [2, 2, 3];
  assert.deepEqual(probabilityPointAt(start, "axial", 0, 0, shape, true), [3, 4, 3]);
  assert.deepEqual(moveProbabilityPoint(start, "axial", "ArrowRight", shape, true), [1, 2, 3]);
  assert.deepEqual(moveProbabilityPoint(start, "coronal", "ArrowLeft", shape, true), [3, 2, 3]);
  assert.deepEqual(moveProbabilityPoint(start, "sagittal", "ArrowRight", shape), [2, 3, 3]);
});

test("native click and keyboard navigation preserve depth, reach every voxel center, and clamp edges", () => {
  const shape = [153,100,79], point = [76,50,39];
  for (const plane of planes) {
    const [h,v] = planeDimensions[plane], normal = planeAxis[plane];
    for (let x = 0; x < shape[h]; x++) for (let y = 0; y < shape[v]; y++) {
      const result = probabilityPointAt(point, plane, (x+.5)/shape[h], (y+.5)/shape[v],shape);
      assert.equal(result[h],x); assert.equal(result[v],shape[v]-1-y); assert.equal(result[normal],point[normal]);
    }
    const edge = probabilityPointAt(point,plane,-.1,1.1,shape);
    assert.equal(edge[h],0); assert.equal(edge[v],0);
    assert.deepEqual(moveProbabilityPoint(edge,plane,"ArrowLeft",shape),edge);
    assert.deepEqual(moveProbabilityPoint(edge,plane,"ArrowDown",shape),edge);
    assert.equal(moveProbabilityPoint(point,plane,"ArrowRight",shape)[h],point[h]+1);
    assert.equal(moveProbabilityPoint(point,plane,"ArrowUp",shape)[v],point[v]+1);
    assert.equal(moveProbabilityPoint(point,plane,"Enter",shape),null);
  }
});
