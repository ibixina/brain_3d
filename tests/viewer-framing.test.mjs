import assert from "node:assert/strict";
import test from "node:test";
import { perspectiveFraming } from "../src/viewer-framing.ts";

test("fitted spheres remain within both perspective axes in narrow reading and phone viewports", () => {
  for (const [width, height] of [
    [213, 700],
    [380, 600],
    [724, 777],
    [390, 549],
    [1280, 565],
  ]) {
    for (const fov of [28, 36, 50]) {
      const aspect = width / height;
      const framing = perspectiveFraming(aspect, fov);
      const verticalHalfAngle = (fov * Math.PI) / 360;
      const horizontalHalfAngle = Math.atan(
        Math.tan(verticalHalfAngle) * aspect,
      );
      const radius = 45;
      const baseDistance = (1.1 * radius) / Math.sin(verticalHalfAngle);
      const apparentHalfAngle = Math.asin(radius / (baseDistance * framing));
      assert.ok(
        apparentHalfAngle < Math.min(verticalHalfAngle, horizontalHalfAngle),
        `${width}×${height}, fov ${fov}`,
      );
    }
  }
});
