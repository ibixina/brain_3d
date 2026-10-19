import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { thalamicGroupIds, thalamicGroupCamera, thalamicGroupSelection } from "../src/thalamus-guide.ts";
import { defaultSubregionRoute, resolveSubregionRoute, subregionRouteFromHash, withSubregionRoute, subregionViews } from "../src/subregion-navigation.ts";
import { learningFromHash } from "../src/learning.ts";

const load = (file) => JSON.parse(readFileSync(new URL(`../src/${file}.json`, import.meta.url)));
const atlas = load("thalamus-subregions");
const guide = load("thalamus-guide");

test("the thalamic guide covers exactly the existing protocol keys and seven display groups", () => {
  assert.equal(guide.source, atlas.source.labelDefinitions);
  assert.equal(guide.checkedOn, "2026-10-19");
  assert.match(guide.note, /Cells, layers and fiber bundles are not resolved/);
  assert.deepEqual(guide.groups.map((group) => group.id), thalamicGroupIds);
  assert.deepEqual(guide.groups.map((group) => group.name).sort(), [...new Set(atlas.parts.map((part) => part.group))].sort());
  const keys = [...new Set([...atlas.parts, ...atlas.omitted].map((part) => part.key))];
  assert.equal(keys.length, 26);
  assert.deepEqual(Object.keys(guide.labels).sort(), keys.sort());
  assert.match(guide.labels.AV, /AM and AD/);
  assert.match(guide.labels.VPL, /VPM/);
  assert.match(guide.labels.LGN, /layers/);
});

test("group scopes cover every existing surface once per side and never fabricate omitted geometry", () => {
  for (const side of ["left", "right", "both"]) {
    const shown = new Set();
    for (const group of guide.groups) {
      const view = thalamicGroupSelection(atlas.parts, group, side);
      const selected = atlas.parts.find((part) => part.id === view.selected);
      assert.equal(selected.key, group.lead);
      assert.equal(selected.group, group.name);
      assert.ok(side === "both" || selected.hemisphere === side);
      const visible = atlas.parts.filter((part) => !view.hiddenGroups.includes(part.group) && (side === "both" || side === part.hemisphere));
      assert.ok(visible.length > 0);
      for (const part of visible) {
        assert.equal(part.group, group.name);
        assert.ok(!shown.has(part.id));
        shown.add(part.id);
      }
      assert.ok(atlas.omitted.every((part) => part.id !== view.selected));
      assert.ok(Object.hasOwn(subregionViews, thalamicGroupCamera(group, side)));
    }
    assert.equal(shown.size, side === "both" ? 46 : 23);
  }
});

test("preferred parts remain inside their group and hemisphere; lateral/medial viewpoints follow anatomy", () => {
  const posterior = guide.groups.find((group) => group.id === "posterior");
  const rightLGN = atlas.parts.find((part) => part.key === "LGN" && part.hemisphere === "right");
  assert.equal(thalamicGroupSelection(atlas.parts, posterior, "right", rightLGN.id).selected, rightLGN.id);
  assert.notEqual(thalamicGroupSelection(atlas.parts, posterior, "left", rightLGN.id).selected, rightLGN.id);
  const anterior = guide.groups[0];
  assert.notEqual(thalamicGroupSelection(atlas.parts, anterior, "right", rightLGN.id).selected, rightLGN.id);
  const lateral = guide.groups.find((group) => group.camera === "lateral");
  const medial = guide.groups.find((group) => group.camera === "medial");
  assert.equal(thalamicGroupCamera(lateral, "left"), "left");
  assert.equal(thalamicGroupCamera(lateral, "right"), "right");
  assert.equal(thalamicGroupCamera(medial, "left"), "right");
  assert.equal(thalamicGroupCamera(medial, "right"), "left");
  assert.equal(thalamicGroupCamera(medial, "both"), "default");
});

test("all seven tour stops share their actual part, scope, viewpoint and reference/guide context", () => {
  for (const side of ["left", "right", "both"]) {
    for (const group of guide.groups) {
      const base = "#path=memory&step=4&from=thalamic-anatomy";
      const position = learningFromHash(base);
      const parent = position.path.steps[position.step].region;
      assert.equal(parent, "aseg-10");
      const route = {
        ...defaultSubregionRoute("thalamus", side),
        selected: thalamicGroupSelection(atlas.parts, group, side).selected,
        tour: group.id,
        camera: thalamicGroupCamera(group, side),
      };
      const hash = withSubregionRoute(base, route);
      const restored = subregionRouteFromHash(hash, { id: parent, hemisphere: "left" });
      assert.deepEqual(resolveSubregionRoute(restored, atlas.parts), route);
      assert.equal(withSubregionRoute(hash, null), base);
      assert.equal(new URLSearchParams(hash.slice(1)).get("tour"), group.id);
    }
  }
});

test("invalid and foreign tour scopes are dropped without changing atlas selection", () => {
  for (const tour of ["constructor", "__proto__", "missing", "Anterior", "999"]) {
    const route = subregionRouteFromHash(`#region=aseg-10&atlas=thalamus&tour=${tour}`, { id: "aseg-10", hemisphere: "left" });
    assert.equal(route.tour, null);
    assert.ok(!new URLSearchParams(withSubregionRoute("#region=aseg-10", route).slice(1)).has("tour"));
  }
  const foreign = subregionRouteFromHash("#region=aseg-18&atlas=amygdala&tour=ventral", { id: "aseg-18", hemisphere: "left" });
  assert.equal(foreign.tour, null);
});
