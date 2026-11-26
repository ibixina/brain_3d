import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { boundaryNeighbors } from "../src/subregions.ts";
import { referenceKeepsRegion } from "../src/reference-topics.ts";

const load = (name) => JSON.parse(readFileSync(new URL(`../src/${name}.json`, import.meta.url)));
const atlas = load("hippocampus-subregions");
const notes = load("hippocampus-boundaries");
const reference = load("reference-data");
const main = load("atlas-manifest");

test("hippocampal protocol notes map to all 20 source labels and cite both naming protocols", () => {
  const keys = [...new Set(atlas.parts.map((part) => part.key))];
  assert.equal(keys.length, 20);
  assert.deepEqual(Object.keys(notes.labels).sort(), keys.sort());
  assert.match(notes.source, /IglesiasNI2015\.pdf#page=7$/);
  assert.match(notes.protocolSource, /HippocampalSubfieldsAndNucleiOfAmygdala/);
  assert.match(notes.note, /later FreeSurfer probability-atlas download/);
  assert.match(notes.note, /does not reproduce those postmortem scans/);
  assert.match(notes.labels["Hippocampal_tail"].text, /difficult to annotate reliably/);
  assert.match(notes.labels["CA3-head"].text, /combined field CA2\/3/);
  assert.match(notes.labels["CA3-head"].text, /CA2 is included in CA3/);
  assert.match(notes.labels.HATA.text, /distinct from the amygdala atlas/);
  assert.match(notes.labels["subiculum-head"].text, /did not segment prosubiculum/);
  assert.match(notes.labels.alveus.text, /distinguishes it from the fimbria/);
});

test("protocol neighbor links resolve to real surfaces and stay on the selected hemisphere", () => {
  const parts = atlas.parts;
  for (const part of parts) {
    const keys = notes.labels[part.key].neighbors;
    assert.ok(keys.length <= 4);
    assert.equal(new Set(keys).size, keys.length);
    const targets = boundaryNeighbors(parts, part, keys);
    assert.deepEqual(targets.map((target) => target.key), keys);
    for (const target of targets) {
      assert.equal(target.hemisphere, part.hemisphere);
      assert.notEqual(target.id, part.id);
      assert.ok(Object.hasOwn(notes.labels, target.key));
    }
  }
  const rightCA1 = parts.find((part) => part.key === "CA1-head" && part.hemisphere === "right");
  assert.deepEqual(boundaryNeighbors(parts, rightCA1, notes.labels[rightCA1.key].neighbors).map((part) => part.key), ["subiculum-head", "CA3-head", "molecular_layer_HP-head"]);
});

test("deeper reading reuses hippocampal anatomy notes with linked gross hippocampus context", () => {
  assert.match(notes.readingScope, /not proof of microscopic borders/);
  assert.deepEqual(notes.reading.map((link) => link.id), ["hippocampal-formation", "hippocampal-circuit"]);
  for (const link of notes.reading) {
    const article = reference.articles.find((item) => item.id === link.id);
    assert.ok(article);
    for (const id of ["aseg-17", "aseg-53"]) {
      const parent = main.parts.find((part) => part.id === id);
      assert.ok(referenceKeepsRegion(parent, link.id));
      assert.ok(article.regions.includes(id));
    }
  }
});

test("the source-linked hippocampal explanation stays a small lazy asset", () => {
  const bytes = readFileSync(new URL("../src/hippocampus-boundaries.json", import.meta.url));
  assert.ok(bytes.length < 9000);
  assert.ok(gzipSync(bytes).length < 2500);
});
