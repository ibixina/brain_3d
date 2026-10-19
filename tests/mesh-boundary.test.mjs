import assert from "node:assert/strict";
import test from "node:test";
import { BufferGeometry, Float32BufferAttribute } from "three";
import { meshBoundary } from "../src/mesh-boundary.ts";

function geometry(positions, indices) {
  return new BufferGeometry()
    .setAttribute("position", new Float32BufferAttribute(positions, 3))
    .setIndex(indices);
}

test("parcel outlines include the perimeter and exclude shared triangle edges", () => {
  const square = geometry([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], [0, 1, 2, 0, 2, 3]);
  const boundary = meshBoundary(square).getAttribute("position");
  assert.equal(boundary.count, 8);
  for (let i = 0; i < boundary.count; i += 2) {
    const length = Math.hypot(
      boundary.getX(i) - boundary.getX(i + 1),
      boundary.getY(i) - boundary.getY(i + 1),
    );
    assert.equal(length, 1, "the diagonal is not part of the outline");
  }
});

test("closed indexed surfaces have no parcel boundary", () => {
  const tetrahedron = geometry(
    [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],
    [0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3],
  );
  assert.equal(meshBoundary(tetrahedron).getAttribute("position").count, 0);
});
