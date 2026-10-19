import assert from "node:assert/strict";
import test from "node:test";
import atlas from "../src/atlas-manifest.json" with { type: "json" };
import {
  learningPaths,
  learningSources,
  learningFromHash,
  learningHash,
  learningView,
  filterLearningPaths,
} from "../src/learning.ts";

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

test("guided paths retain real mesh targets, complete explanations, sources, and valid views", () => {
  assert.equal(learningPaths.length, 6);
  assert.equal(new Set(learningPaths.map((path) => path.id)).size, 6);
  assert.equal(learningPaths.flatMap((path) => path.steps).length, 26);
  for (const path of learningPaths) {
    assert.ok(path.summary && path.limit && path.tags.length);
    assert.ok(path.steps.length >= 4);
    for (const [step, stop] of path.steps.entries()) {
      const region = atlas.parts.find((part) => part.id === stop.region);
      assert.ok(region, `${path.id}: real anatomical target`);
      assert.ok(stop.title && stop.text && stop.prompt);
      assert.equal(
        new URL(learningSources[stop.source].url).protocol,
        "https:",
      );
      assert.ok(
        [
          "left",
          "right",
          "anterior",
          "posterior",
          "superior",
          "inferior",
          "default",
        ].includes(stop.view.camera),
      );
      assert.ok(["left", "right", "both"].includes(stop.view.hemisphere));
      assert.ok(stop.view.opacity > 0 && stop.view.opacity <= 1);
      const view = learningView({ path, step }, defaults);
      assert.equal(view.selected, region.id);
      assert.equal(view.hiddenGroups.includes(region.group), false);
      assert.ok(
        view.hemisphere === "both" ||
          region.hemisphere === "midline" ||
          region.hemisphere === view.hemisphere,
      );
    }
  }
  assert.deepEqual(defaults.hiddenGroups, ["Ventricles", "White matter"]);
});

test("every learning stop can be shared and reopened without losing its path or position", () => {
  for (const path of learningPaths) {
    for (let step = 0; step < path.steps.length; step++) {
      assert.deepEqual(learningFromHash(learningHash(path, step)), {
        path,
        step,
      });
    }
  }
  assert.equal(learningFromHash("#region=aseg-17"), null);
  assert.equal(learningFromHash("#path=unknown"), null);
  assert.equal(learningFromHash("#view=scans&path=memory"), null);
  for (const step of ["0", "-1", "1.5", "999", "NaN", "Infinity"]) {
    assert.equal(learningFromHash(`#path=memory&step=${step}`).step, 0);
  }
  assert.equal(learningFromHash("#path=memory").step, 0);
});

test("path discovery searches system names and aliases and combines terms", () => {
  assert.equal(filterLearningPaths("HIPPOCAMPUS")[0].id, "memory");
  assert.equal(filterLearningPaths("basal ganglia")[0].id, "movement");
  assert.equal(filterLearningPaths("csf")[0].id, "csf");
  assert.equal(filterLearningPaths("speech auditory")[0].id, "language");
  assert.equal(filterLearningPaths("memory unrelated-term").length, 0);
  assert.equal(filterLearningPaths("   ").length, learningPaths.length);
});
