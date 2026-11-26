import assert from "node:assert/strict";
import test from "node:test";
import atlas from "../src/atlas-manifest.json" with { type: "json" };
import learningChecks from "../src/learning-self-checks.json" with { type: "json" };
import { learningCheckIsCorrect } from "../src/learning-check.ts";
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
  assert.equal(learningPaths.length, 7);
  assert.equal(new Set(learningPaths.map((path) => path.id)).size, 7);
  assert.equal(learningPaths.flatMap((path) => path.steps).length, 31);
  for (const path of learningPaths) {
    assert.ok(path.summary && path.limit && path.tags.length);
    assert.ok(path.steps.length >= 4);
    for (const id of path.relatedSources ?? []) {
      assert.ok(learningSources[id], `${path.id}: related source exists`);
      assert.equal(new URL(learningSources[id].url).protocol, "https:");
    }
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
  assert.equal(filterLearningPaths("callosum tractography")[0].id, "callosum");
  assert.equal(filterLearningPaths("memory unrelated-term").length, 0);
  assert.equal(filterLearningPaths("   ").length, learningPaths.length);
});

test("corpus callosum tour visits the five real FreeSurfer segments and distinguishes their method from DTI topography", () => {
  const path = learningPaths.find((item) => item.id === "callosum");
  assert.ok(path);
  assert.deepEqual(path.steps.map((step) => step.region), [
    "aseg-251", "aseg-252", "aseg-253", "aseg-254", "aseg-255",
  ]);
  assert.ok(path.steps.every((step) => !step.view.isolate && step.view.opacity === 0.15 && step.view.hemisphere === "both"));
  assert.equal(path.checkedOn, "2026-11-26");
  assert.deepEqual(path.relatedSources, ["callosalTopography"]);
  assert.match(path.limit, /different boundaries/);
  assert.match(path.limit, /not direct axon tracing/);
  assert.equal(learningSources.callosal.url, "https://surfer.nmr.mgh.harvard.edu/fswiki/mri_cc");
  assert.equal(learningSources.callosalTopography.url, "https://pubmed.ncbi.nlm.nih.gov/16854598/");
});

test("every guided path ends with a source-scoped recall question and correctable feedback", () => {
  for (const path of learningPaths) {
    const check = learningChecks[path.id];
    assert.ok(check, `${path.id}: knowledge check`);
    assert.ok(check.question && check.correctFeedback && check.incorrectFeedback);
    assert.equal(check.options.length, 3);
    assert.ok(check.answerIndex >= 0 && check.answerIndex < check.options.length);
    assert.equal(new Set(check.options).size, check.options.length);
    assert.equal(learningCheckIsCorrect(check, check.answerIndex), true);
    assert.equal(learningCheckIsCorrect(check, (check.answerIndex + 1) % check.options.length), false);
  }
});
