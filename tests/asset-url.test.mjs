import assert from "node:assert/strict";
import test from "node:test";
import { assetUrl } from "../src/asset-url.ts";

test("local asset paths work at both the root and the Pages project path", () => {
  for (const base of ["/", "/brain_3d/", "/nested/project/"]) {
    for (const path of ["/models/atlas.mesh", "/imaging/t1.volume", "/licenses/NOTICE.txt"]) {
      assert.equal(assetUrl(path, base), `${base}${path.slice(1)}`);
      assert.equal(assetUrl(path.slice(1), base), `${base}${path.slice(1)}`);
    }
  }
  assert.equal(assetUrl("/imaging/manifest.json", "/brain_3d"), "/brain_3d/imaging/manifest.json");
  assert.equal(assetUrl("/models/atlas.bin"), "/models/atlas.bin");
});
