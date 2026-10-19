import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { boundaryNeighbors } from "../src/subregions.ts";
import { referenceKeepsRegion } from "../src/reference-topics.ts";

const load = (name) => JSON.parse(readFileSync(new URL(`../src/${name}.json`, import.meta.url)));
const atlas = load("amygdala-subregions");
const notes = load("amygdala-boundaries");
const main = load("atlas-manifest");
const reference = load("reference-data");

test("amygdala boundary notes match all nine source keys and retain MRI protocol scope", () => {
  const keys = [...new Set(atlas.parts.map((part) => part.key))];
  assert.equal(keys.length, 9);
  assert.deepEqual(Object.keys(notes.labels).sort(), keys.sort());
  assert.equal(notes.source, atlas.source.labelDefinitions);
  assert.equal(notes.checkedOn, atlas.checkedOn);
  assert.match(notes.note, /ex vivo MRI boundaries/);
  assert.match(notes.note, /do not show that contrast or cellular detail/);
  assert.match(notes.labels["Corticoamygdaloid-transitio"].text, /HATA.*labels remain separate/);
  assert.match(atlas.parts.find((part) => part.key === "Medial-nucleus").description, /Only 17 voxels/);
});

test("every neighbor target is an existing surface on the selected side, with bounded distinct choices", () => {
  for (const part of atlas.parts) {
    const keys = notes.labels[part.key].neighbors;
    assert.ok(keys.length >= 1 && keys.length <= 4);
    assert.equal(new Set(keys).size, keys.length);
    const targets = boundaryNeighbors(atlas.parts, part, keys);
    assert.deepEqual(targets.map((target) => target.key), keys);
    for (const target of targets) {
      assert.equal(target.hemisphere, part.hemisphere);
      assert.notEqual(target.id, part.id);
      assert.ok(Object.hasOwn(notes.labels, target.key));
    }
  }
  const medial = atlas.parts.find((part) => part.key === "Medial-nucleus" && part.hemisphere === "right");
  const keys = notes.labels[medial.key].neighbors;
  assert.equal(boundaryNeighbors(atlas.parts, medial, keys)[0].id, "amyg-right-7009");
  assert.deepEqual(boundaryNeighbors(atlas.parts.filter((part) => part.hemisphere === "left"), medial, keys), []);
  assert.deepEqual(boundaryNeighbors(atlas.parts, medial, [medial.key, "HATA", "__proto__"]), []);
});

test("deeper-reading targets are real notes that retain either actual gross amygdala context", () => {
  assert.equal(notes.reading.length, 2);
  assert.match(notes.readingScope, /not a function map for the selected nucleus/);
  for (const link of notes.reading) {
    const article = reference.articles.find((item) => item.id === link.id);
    assert.ok(article);
    for (const id of ["aseg-18", "aseg-54"]) {
      const parent = main.parts.find((part) => part.id === id);
      assert.ok(referenceKeepsRegion(parent, link.id));
      assert.ok(article.regions.includes(id));
    }
  }
});

test("the on-demand editorial catalogue stays within its raw and compressed payload budgets", () => {
  const bytes = readFileSync(new URL("../src/amygdala-boundaries.json", import.meta.url));
  assert.ok(bytes.length < 4000);
  assert.ok(gzipSync(bytes).length < 1300);
});
