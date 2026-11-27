import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { matchingSubregions, subregionForRegion, subregionName } from "../src/subregions.ts";
import { referenceArticles, referenceExplorations, referenceSources } from "../src/reference.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const atlas = JSON.parse(read("src/hypothalamus-subregions.json"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("hypothalamic atlas labels retain source IDs, names, lateralization and actual grouping", () => {
  assert.equal(atlas.parts.length, 50);
  assert.deepEqual(atlas.omitted, []);
  for (const side of ["left", "right"]) {
    const parts = atlas.parts.filter((part) => part.hemisphere === side);
    assert.equal(parts.length, 25);
    assert.equal(parts.filter((part) => part.group === "Hypothalamus").length, 13);
    assert.equal(parts.filter((part) => part.group !== "Hypothalamus").length, 12);
    assert.ok(parts.every((part) => side === "left" ? part.center[0] + atlas.source.displayOrigin[0] < 0 : part.center[0] + atlas.source.displayOrigin[0] > 0));
    assert.equal(matchingSubregions(atlas.parts, "", side).length, 25);
    assert.equal(matchingSubregions(atlas.parts, "Hypothalamus", side).length, 13);
    assert.equal(matchingSubregions(atlas.parts, "Nearby", side).length, 12);
  }
  assert.equal(matchingSubregions(atlas.parts, "Hypothalamus", "both").length, 26);
  assert.equal(matchingSubregions(atlas.parts, "Nearby", "both").length, 24);
  assert.equal(new Set(atlas.parts.map((part) => part.label)).size, 50);
  assert.equal(subregionName(atlas.parts.find((part) => part.label === 47)), "Right Suprachiasmatic nucleus · SC");
  assert.deepEqual(matchingSubregions(atlas.parts, "SCN", "left").map((part) => part.label), [48]);
  const posterior = atlas.parts.find((part) => part.label === 51);
  assert.equal(posterior.name, "Posterior hypothalamic nucleus");
  assert.equal(posterior.sourceName, "posterior hypotahalamic nucleus");
  assert.match(posterior.description, /display spelling is corrected/);
  const redNucleus = atlas.parts.find((part) => part.label === 18);
  assert.equal(redNucleus.sourceVoxels, 2314);
  assert.equal(redNucleus.voxels, 2285);
  assert.deepEqual(redNucleus.excludedSourceFragments, [27, 2]);
  assert.match(redNucleus.description, /reaching the image boundary/);
  assert.equal(subregionForRegion("aseg-28"), "hypothalamus");
  assert.equal(subregionForRegion("aseg-60"), "hypothalamus");
  assert.equal(subregionForRegion("aseg-14"), null);
});

test("hypothalamus mesh and provenance match pinned CC BY atlas inputs", () => {
  assert.equal(atlas.source.paper, "https://doi.org/10.1038/s41597-020-00644-6");
  assert.equal(atlas.source.sourceRecord, "https://doi.org/10.5281/zenodo.3942115");
  assert.deepEqual(atlas.source.shape, [394, 466, 378]);
  assert.deepEqual(atlas.source.spacingMm, [0.5, 0.5, 0.5]);
  assert.match(atlas.source.frame, /990 HCP subjects/);
  assert.match(atlas.source.method, /no smoothing, resampling, or decimation/);
  assert.match(atlas.source.method, /[Oo]ne documented source anomaly is excluded/);
  assert.equal(atlas.source.license, "/licenses/cc-by-4.0-legalcode.html");
  const license = read("public/licenses/cc-by-4.0-legalcode.html").toString();
  assert.match(license, /Attribution 4\.0 International/);
  assert.equal(atlas.source.files["MNI152b_atlas_labels_0.5mm.nii.gz"].md5, "d94c770945b19b0a3f13ab43c5140e01");
  assert.equal(atlas.source.files["Volumes_names-labels.csv"].md5, "b6f3d1a221d77ccd129c4e73864c2e25");
  assert.deepEqual(JSON.parse(read("public/subregions/hypothalamus-provenance.json")), atlas);
  const raw = read("public" + atlas.rawUrl);
  const compressed = read("public" + atlas.compressedUrl);
  assert.deepEqual(gunzipSync(compressed), raw);
  assert.equal(raw.length, atlas.geometry.bytes);
  assert.equal(compressed.length, atlas.geometry.compressedBytes);
  assert.equal(sha256(raw), atlas.geometry.sha256);
  assert.equal(sha256(compressed), atlas.geometry.compressedSha256);
  assert.ok(compressed.length < 800_000);
  assert.ok(atlas.geometry.triangles < 120_000);
  let end = 0;
  for (const part of atlas.parts) {
    assert.equal(part.offset, end);
    assert.ok(part.vertices > 0 && part.triangles > 0);
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    assert.ok(part.offset + part.vertices * 28 + part.triangles * 12 <= raw.length);
    assert.doesNotThrow(() => new Float32Array(raw.buffer, raw.byteOffset + part.offset, part.vertices * 3));
    assert.doesNotThrow(() => new Float32Array(raw.buffer, raw.byteOffset + part.offset + part.vertices * 12, part.vertices * 3));
    assert.doesNotThrow(() => new Uint32Array(raw.buffer, raw.byteOffset + part.offset + part.vertices * 28, part.triangles * 3));
    const firstIndex = view.getUint32(part.offset + part.vertices * 28, true);
    assert.ok(firstIndex < part.vertices);
    end += part.vertices * 28 + part.triangles * 12;
  }
  assert.equal(end, raw.length);
});

test("hypothalamus reading connects the separate atlas without claiming registration", () => {
  const article = referenceArticles.find((item) => item.id === "hypothalamic-anatomy");
  assert.ok(article.sources.includes("hypothalamic-atlas"));
  assert.match(article.scope, /not registered to this whole-brain model/);
  assert.equal(referenceSources["hypothalamic-atlas"].url, atlas.source.paper);
  const route = referenceExplorations(article).find((item) => item.kind === "atlas");
  assert.match(route.href, /region=aseg-28.*atlas=hypothalamus/);
});
