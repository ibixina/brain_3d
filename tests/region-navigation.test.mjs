import assert from "node:assert/strict";
import test from "node:test";
import { regions } from "../src/data.ts";
import {
  activityComparisonHash,
  activityReturnHash,
  regionDetailFromHash,
  regionHash,
} from "../src/region-navigation.ts";

test("every modeled region can open its existing specimen-video recommendations", () => {
  for (const region of regions) {
    const hash = regionHash(region.id, "videos");
    const params = new URLSearchParams(hash.slice(1));
    assert.equal(params.get("region"), region.id);
    assert.equal(regionDetailFromHash(hash), "videos");
  }
});

test("ordinary region routes keep the overview tab and unknown detail values fall back safely", () => {
  assert.equal(regionHash("aseg-10"), "#region=aseg-10");
  assert.equal(regionDetailFromHash("#region=aseg-10"), "overview");
  assert.equal(regionDetailFromHash("#region=aseg-10&detail=other"), "overview");
});

test("specimen links preserve and validate the activity comparison return route", () => {
  const comparison = activityComparisonHash({
    a: "meta:music",
    b: "meta:speech-listening",
    lens: "shared",
    stage: "slices",
    measure: "specificity",
    region: "lh-bankssts",
    point: [64, 72, 48],
  });
  const anatomy = regionHash("lh-bankssts", "videos", comparison);
  assert.equal(activityReturnHash(anatomy), comparison);
  const singleActivity = activityComparisonHash({
    a: "meta:reading",
    b: null,
    lens: "a",
    stage: "model",
    measure: "consistency",
    region: "lh-bankssts",
    point: [64, 72, 48],
  });
  assert.equal(activityReturnHash(regionHash("lh-bankssts", "videos", singleActivity)), singleActivity);
  assert.equal(
    activityReturnHash("#region=lh-bankssts&return=view%3Danatomy%26x%3Dhttps%253A%252F%252Fevil.example"),
    null,
  );
  const malformed = new URLSearchParams({
    return: "view=activities&a=meta%3Amusic&lens=shared&stage=slices&measure=consistency&point=,,",
  });
  assert.equal(activityReturnHash(`#region=lh-bankssts&${malformed}`), null);
});
