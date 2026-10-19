import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { matchingSubregions, subregionForRegion, subregionName } from "../src/subregions.ts";
import { referenceKeepsRegion } from "../src/reference-topics.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root));
const atlas = JSON.parse(read("src/cerebellum-subregions.json"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("cerebellar explanations preserve either gross context and state the new atlas's actual limits", () => {
  const reference = JSON.parse(read("src/reference-data.json"));
  const main = JSON.parse(read("src/atlas-manifest.json"));
  assert.equal(atlas.relatedReading.links.length, 2);
  for (const link of atlas.relatedReading.links) {
    const note = reference.articles.find((article) => article.id === link.id);
    assert.ok(note);
    assert.match(note.scope, /independent/i);
    assert.match(note.scope, /2\/5|tiny incomplete fastigial/);
    for (const id of ["aseg-8", "aseg-47"]) {
      assert.ok(referenceKeepsRegion(main.parts.find((part) => part.id === id), note.id));
      assert.ok(note.regions.includes(id));
    }
  }
});

test("cerebellar data retain the pinned categorical input, lookup and attribution independently of FreeSurfer", () => {
  assert.equal(atlas.source.commit, "6857dfa732de6dd60c94da2f84d0b15ccf316618");
  assert.deepEqual(atlas.source.shape, [153, 100, 79]);
  assert.deepEqual(atlas.source.spacingMm, [1, 1, 1]);
  assert.deepEqual(atlas.source.affine, [[1,0,0,-76],[0,1,0,-103],[0,0,1,-70],[0,0,0,1]]);
  const nifti = gunzipSync(read("public/subregions/cerebellum-labels.nii.gz"));
  const tsv = read("public/subregions/cerebellum-labels.tsv");
  assert.equal(hash(nifti), atlas.source.files["atl-Anatom_space-MNISym_dseg.nii"].sha256);
  assert.equal(hash(nifti), "3749c701422f10d6b5153bfd467a2f115be485a065178e7d4ee89f48e1ccb5fa");
  assert.equal(hash(tsv), atlas.source.files["atl-Anatom.tsv"].sha256);
  const rows = tsv.toString().trim().split("\n").slice(1).map((row) => row.split("\t"));
  assert.equal(rows.length, 34);
  for (const [index, name, color] of rows) {
    const part = atlas.parts.find((part) => part.label === Number(index));
    assert.equal(part.sourceName, name);
    assert.equal(part.key, name);
    assert.equal(part.sourceColor, color);
  }
  assert.deepEqual(JSON.parse(read("public/subregions/cerebellum-provenance.json")), atlas);
  const notice = read("public" + atlas.source.license).toString();
  assert.match(notice, /Creative Commons CC BY \(Attribution\)/);
  assert.match(notice, /does not specify a Creative Commons license version/);
  assert.match(notice, new RegExp(atlas.source.commit));
  assert.match(notice, /2009\.01\.045/);
  assert.match(notice, /2010\.10\.035/);
  assert.equal(atlas.probabilityEvidence, false);
  assert.match(atlas.source.method, /Published categorical dseg labels.*unchanged/);
  assert.match(atlas.source.frame, /not registered.*whole-brain.*MRI/);
});

test("all 34 published labels remain distinct, including vermis and tiny incomplete nuclear fragments", () => {
  assert.equal(atlas.parts.length, 34);
  assert.equal(atlas.omitted.length, 0);
  for (const side of ["left", "right"]) {
    const parts = atlas.parts.filter((part) => part.hemisphere === side);
    assert.equal(parts.length, 13);
    assert.equal(parts.filter((part) => part.group === "Deep nuclei").length, 3);
    assert.ok(parts.every((part) => side === "left" ? part.center[0] < 0 : part.center[0] > 0));
    assert.equal(matchingSubregions(atlas.parts, "", side).length, 21);
  }
  assert.equal(atlas.parts.filter((part) => part.hemisphere === "midline").length, 8);
  assert.equal(matchingSubregions(atlas.parts, "", "both").length, 34);
  assert.equal(new Set(atlas.parts.map((part) => part.id)).size, 34);
  for (const [label, count] of [[9,20],[33,2],[34,5]]) {
    const part = atlas.parts.find((part) => part.label === label);
    assert.equal(part.voxels, count);
    assert.equal(part.warning, "Tiny source fragment");
    assert.match(part.description, new RegExp(`Only ${count} labeled voxels`));
    assert.match(part.description, /does not establish the full anatomical extent/);
  }
  assert.match(atlas.parts.find((part) => part.label === 31).description, /Emboliform and globose are combined/);
  assert.deepEqual(matchingSubregions(atlas.parts, "globose", "left").map((part) => part.label), [31]);
  assert.match(atlas.parts[0].description, /I–IV share this source label/);
  assert.equal(subregionName(atlas.parts.find((part) => part.label === 29)), "Left Dentate nucleus");
  assert.equal(subregionName(atlas.parts.find((part) => part.label === 6)), "Vermis · Lobule VI");
  assert.equal(subregionForRegion("aseg-8"), "cerebellum");
  assert.equal(subregionForRegion("aseg-47"), "cerebellum");
  assert.equal(subregionForRegion("aseg-7"), null);
  assert.equal(subregionForRegion("aseg-46"), null);
});

test("demand-loaded cerebellar geometry has exact hashes and a bounded transfer/triangle cost", () => {
  const raw = read("public" + atlas.rawUrl);
  const compressed = read("public" + atlas.compressedUrl);
  assert.deepEqual(gunzipSync(compressed), raw);
  assert.equal(hash(raw), atlas.geometry.sha256);
  assert.equal(hash(compressed), atlas.geometry.compressedSha256);
  assert.equal(raw.length, atlas.geometry.bytes);
  assert.equal(compressed.length, atlas.geometry.compressedBytes);
  assert.ok(compressed.length < 1_400_000);
  assert.equal(atlas.parts.reduce((sum, part) => sum + part.triangles, 0), atlas.geometry.triangles);
  assert.ok(atlas.geometry.triangles < 220_000);
});

test("each packed surface has finite normalized normals and valid nondegenerate faces inside its own byte range", () => {
  const raw = read("public" + atlas.rawUrl);
  let end = 0;
  for (const part of atlas.parts) {
    assert.equal(part.offset, end);
    const positions = new Float32Array(raw.buffer, raw.byteOffset + part.offset, part.vertices * 3);
    const normals = new Float32Array(raw.buffer, raw.byteOffset + part.offset + part.vertices * 12, part.vertices * 3);
    const faces = new Uint32Array(raw.buffer, raw.byteOffset + part.offset + part.vertices * 28, part.triangles * 3);
    for (let i = 0; i < part.vertices; i++) {
      assert.ok(Math.abs(Math.hypot(...normals.subarray(i * 3, i * 3 + 3)) - 1) < 1e-5);
      for (const value of positions.subarray(i * 3, i * 3 + 3)) assert.ok(Number.isFinite(value));
    }
    for (let i = 0; i < faces.length; i += 3) {
      const ids = [...faces.subarray(i, i + 3)];
      assert.equal(new Set(ids).size, 3);
      assert.ok(ids.every((id) => id < part.vertices));
      const a = [0,1,2].map((axis) => positions[ids[1] * 3 + axis] - positions[ids[0] * 3 + axis]);
      const b = [0,1,2].map((axis) => positions[ids[2] * 3 + axis] - positions[ids[0] * 3 + axis]);
      assert.ok(Math.hypot(a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]) > 0);
    }
    end += part.vertices * 28 + part.triangles * 12;
  }
  assert.equal(end, raw.length);
});
