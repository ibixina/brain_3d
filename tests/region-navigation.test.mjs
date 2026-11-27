import assert from "node:assert/strict";
import test from "node:test";
import { regions } from "../src/data.ts";
import { regionDetailFromHash, regionHash } from "../src/region-navigation.ts";

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
