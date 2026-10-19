import assert from "node:assert/strict";
import test from "node:test";
import { perspectiveFraming, sphereFocusDistance } from "../src/viewer-framing.ts";

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

test("standalone fits keep small atlas surfaces readable without changing whole-brain limits", () => {
  for (const aspect of [0.3, 0.8, 1, 2.5]) {
    const framing = perspectiveFraming(aspect);
    const limitingAngle = Math.min(Math.PI / 10, Math.atan(Math.tan(Math.PI / 10) * aspect));
    for (const radius of [0.5, 1, 3, 20, 90]) {
      const distance = sphereFocusDistance(radius, framing, 1);
      const occupancy = Math.sin(Math.asin(radius / distance)) / Math.sin(limitingAngle);
      assert.ok(occupancy > 0.85 && occupancy < 1, `radius ${radius}, aspect ${aspect}`);
      assert.ok(distance > radius + 0.05, "near plane stays outside fitted sphere");
    }
    assert.equal(sphereFocusDistance(1, framing), 35 * framing);
    assert.equal(sphereFocusDistance(90, framing), 324 * framing);
  }
});
