import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  defaultSubregionRoute,
  resolveSubregionRoute,
  subregionRouteFromHash,
  subregionViews,
  withSubregionRoute,
} from "../src/subregion-navigation.ts";
import { learningFromHash } from "../src/learning.ts";
import { referenceOrigin } from "../src/reference-navigation.ts";

const datasets = [
  ["brainstem", "aseg-16", "bilateral"],
  ["thalamus", "aseg-10", "left"],
  ["amygdala", "aseg-18", "left"],
  ["hippocampus", "aseg-17", "left"],
  ["cerebellum", "aseg-8", "left"],
].map(([kind, id, hemisphere]) => ({
  kind,
  parent: { id, hemisphere },
  atlas: JSON.parse(readFileSync(new URL(`../src/${kind}-subregions.json`, import.meta.url))),
}));

test("every modeled atlas part round-trips without confusing its independent ID with a whole-brain region", () => {
  for (const { kind, parent, atlas } of datasets) {
    for (const part of atlas.parts) {
      for (const isolated of [true, false]) {
        const route = {
          ...defaultSubregionRoute(kind, part.hemisphere),
          selected: part.id,
          isolated,
          exploded: isolated ? 0 : 0.3,
          camera: "posterior",
        };
        const hash = withSubregionRoute(`#region=${parent.id}&from=hippocampal-formation`, route);
        const params = new URLSearchParams(hash.slice(1));
        assert.equal(params.get("region"), parent.id);
        assert.equal(params.get("part"), part.id);
        assert.equal(referenceOrigin(hash), "hippocampal-formation");
        assert.deepEqual(resolveSubregionRoute(subregionRouteFromHash(hash, parent), atlas.parts), route);
        assert.equal(withSubregionRoute(hash, null), `#region=${parent.id}&from=hippocampal-formation`);
      }
    }
  }
});

test("atlas links preserve the actual learning step and return reference", () => {
  // Use the actual catalogue's hippocampal stop, without inventing guide IDs.
  const paths = JSON.parse(readFileSync(new URL("../src/learning-paths.json", import.meta.url))).paths;
  const path = paths.find((path) => path.steps.some((step) => step.region === "aseg-17"));
  const index = path.steps.findIndex((step) => step.region === "aseg-17");
  const context = `#path=${path.id}&step=${index + 1}&from=hippocampal-formation`;
  const route = { ...defaultSubregionRoute("hippocampus", "right"), selected: "hipp-right-239", isolated: true };
  const hash = withSubregionRoute(context, route);
  const position = learningFromHash(hash);
  assert.equal(position.path.id, path.id);
  assert.equal(position.step, index);
  assert.equal(referenceOrigin(hash), "hippocampal-formation");
  assert.deepEqual(subregionRouteFromHash(hash, { id: position.path.steps[index].region, hemisphere: "left" }), route);
  assert.equal(withSubregionRoute(hash, null), context);
});

test("unrelated parents, library and scan routes cannot open an atlas dialog", () => {
  const parent = { id: "aseg-17", hemisphere: "left" };
  for (const hash of [
    "#region=aseg-17&atlas=amygdala",
    "#region=aseg-17&atlas=constructor",
    "#region=aseg-17&atlas=__proto__",
    "#region=aseg-17&atlas=hippocampus&view=scans",
    "#reference=hippocampal-formation&atlas=hippocampus",
  ]) assert.equal(subregionRouteFromHash(hash, parent), null);
  assert.equal(subregionRouteFromHash("#atlas=hippocampus", undefined), null);
  assert.equal(subregionRouteFromHash("#atlas=hippocampus", { id: "constructor", hemisphere: "left" }), null);
});

test("lazy catalogue resolution rejects foreign, wrong-side and omitted source labels", () => {
  for (const { kind, parent, atlas } of datasets) {
    const first = atlas.parts[0];
    for (const part of ["aseg-17", "missing", ...(atlas.omitted ?? []).map((part) => part.id)]) {
      const route = subregionRouteFromHash(`#region=${parent.id}&atlas=${kind}&part=${part}&isolate=1`, parent);
      assert.equal(resolveSubregionRoute(route, atlas.parts).selected, null);
      assert.equal(resolveSubregionRoute(route, atlas.parts).isolated, false);
    }
    if (kind !== "brainstem") {
      const mismatch = { ...defaultSubregionRoute(kind, "right"), selected: first.id, isolated: true };
      assert.equal(resolveSubregionRoute(mismatch, atlas.parts).selected, null);
      assert.equal(resolveSubregionRoute(mismatch, atlas.parts).isolated, false);
    }
  }
});

test("malformed controls normalize to bounded layouts and supported anatomical viewpoints", () => {
  const parent = { id: "aseg-17", hemisphere: "left" };
  const base = "#region=aseg-17&atlas=hippocampus";
  assert.equal(subregionRouteFromHash(base, parent).hemisphere, "left");
  const malformed = subregionRouteFromHash(`${base}&side=invalid&part=%3Cscript%3E&isolate=true&explode=999&angle=constructor`, parent);
  assert.deepEqual(malformed, defaultSubregionRoute("hippocampus", "both"));
  const conflict = subregionRouteFromHash(`${base}&part=hipp-left-239&isolate=1&explode=1`, parent);
  assert.equal(conflict.exploded, 0);
  assert.equal(new URLSearchParams(withSubregionRoute(base, conflict).slice(1)).has("explode"), false);
  for (const camera of Object.keys(subregionViews)) {
    const route = { ...defaultSubregionRoute("hippocampus", "right"), camera };
    assert.deepEqual(subregionRouteFromHash(withSubregionRoute(base, route), parent), route);
  }
  const stem = subregionRouteFromHash("#region=aseg-16&atlas=brainstem&side=left", { id: "aseg-16", hemisphere: "bilateral" });
  assert.equal(stem.hemisphere, "both");
});

test("repeated sharing replaces atlas parameters and retains the Pages-compatible fragment", () => {
  const route = { ...defaultSubregionRoute("hippocampus", "right"), selected: "hipp-right-239", isolated: true };
  const url = new URL("https://ibixina.github.io/brain_3d/#region=aseg-53&from=hippocampal-formation");
  url.hash = withSubregionRoute(url.hash, route);
  for (let i = 0; i < 5; i++) url.hash = withSubregionRoute(url.hash, route);
  assert.equal(url.pathname, "/brain_3d/");
  assert.equal(new URLSearchParams(url.hash.slice(1)).getAll("atlas").length, 1);
  url.hash = withSubregionRoute(url.hash, { ...route, selected: null, isolated: false, exploded: 0.3 });
  const params = new URLSearchParams(url.hash.slice(1));
  assert.equal(params.has("part"), false);
  assert.equal(params.has("isolate"), false);
  assert.equal(params.get("explode"), "1");
});
