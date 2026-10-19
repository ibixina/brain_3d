import assert from "node:assert/strict";
import test from "node:test";
import atlas from "../src/atlas-manifest.json" with { type: "json" };
import {
  regionCamera,
  regionEnabled,
  regionNeedsIsolation,
  regionView,
} from "../src/region-view.ts";

const defaults = {
  selected: null,
  isolated: false,
  exploded: 0,
  explodeMode: "lobes",
  opacity: 1,
  hemisphere: "both",
  hiddenGroups: ["Ventricles", "White matter"],
  labels: false,
  autoRotate: false,
  colorMode: "tissue",
  section: "none",
  sectionOffset: 0,
};

test("every shared or searched mesh opens enabled with its hemisphere and unclipped geometry", () => {
  for (const region of atlas.parts) {
    const view = regionView(region, defaults);
    assert.equal(view.selected, region.id);
    assert.equal(regionEnabled(region, view), true, region.id);
    assert.equal(
      view.hemisphere,
      region.hemisphere === "midline" ? "both" : region.hemisphere,
    );
    assert.equal(view.exploded, 0);
    assert.equal(view.section, "none");
    assert.ok(
      ["default", "left", "right", "inferior"].includes(regionCamera(region)),
    );
    if (region.group === "Deep structures") assert.ok(view.opacity < 1);
    if (region.group === "Ventricles")
      assert.ok(view.hiddenGroups.includes("Deep structures"));
  }
  assert.deepEqual(defaults.hiddenGroups, ["Ventricles", "White matter"]);
  assert.equal(defaults.selected, null);
});

test("revealing a region clears obstructing view settings without modifying the input scene", () => {
  const input = {
    ...defaults,
    opacity: 0,
    exploded: 0.8,
    isolated: true,
    hemisphere: "right",
    hiddenGroups: Object.keys(atlas.groups),
    section: "sagittal",
    sectionOffset: 55,
    autoRotate: true,
  };
  const before = structuredClone(input);
  const region = atlas.parts.find((part) => part.id === "aseg-10");
  const view = regionView(region, input);
  assert.equal(regionEnabled(region, view), true);
  assert.equal(view.autoRotate, false);
  assert.equal(view.sectionOffset, 0);
  assert.equal(view.isolated, false);
  assert.deepEqual(input, before);
});

test("buried cortical parcels and small enclosed compartments use isolated detail", () => {
  for (const key of [
    "insula",
    "transversetemporal",
    "choroid-plexus",
    "cerebellar-white-matter",
    "corpus-callosum-central",
  ]) {
    const matches = atlas.parts.filter((part) => part.key === key);
    assert.ok(matches.length, key);
    for (const region of matches) {
      assert.equal(regionNeedsIsolation(region), true);
      assert.equal(regionView(region, defaults).isolated, true);
    }
  }
  assert.equal(
    regionNeedsIsolation(
      atlas.parts.find((part) => part.id === "lh-precentral"),
    ),
    false,
  );
});

test("camera presets expose medial cortex and both sides of deep anatomy consistently", () => {
  const cameraFor = (id) =>
    regionCamera(atlas.parts.find((part) => part.id === id));
  assert.equal(cameraFor("lh-pericalcarine"), "right");
  assert.equal(cameraFor("rh-pericalcarine"), "left");
  assert.equal(cameraFor("aseg-10"), "right");
  assert.equal(cameraFor("aseg-49"), "left");
  assert.equal(cameraFor("lh-precentral"), "left");
  assert.equal(cameraFor("rh-precentral"), "right");
  assert.equal(cameraFor("lh-fusiform"), "inferior");
  assert.equal(cameraFor("aseg-14"), "default");
});

test("selection eligibility follows hidden groups, hemispheres, opacity, and isolation", () => {
  const left = atlas.parts.find((part) => part.id === "lh-precentral");
  const right = atlas.parts.find((part) => part.id === "rh-precentral");
  const midline = atlas.parts.find((part) => part.id === "aseg-16");
  assert.equal(
    regionEnabled(left, { ...defaults, hiddenGroups: ["Frontal"] }),
    false,
  );
  assert.equal(
    regionEnabled(left, { ...defaults, hemisphere: "right" }),
    false,
  );
  assert.equal(regionEnabled(left, { ...defaults, opacity: 0 }), false);
  assert.equal(
    regionEnabled(midline, { ...defaults, hemisphere: "left" }),
    true,
  );
  const isolated = {
    ...defaults,
    selected: left.id,
    isolated: true,
    hemisphere: "right",
    hiddenGroups: ["Frontal"],
  };
  assert.equal(regionEnabled(left, isolated), true);
  assert.equal(regionEnabled(right, isolated), false);
});
