import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const root = new URL("../", import.meta.url);
const atlas = JSON.parse(
  readFileSync(new URL("src/brainstem-subregions.json", root)),
);
const raw = readFileSync(new URL("public" + atlas.rawUrl, root));
const compressed = readFileSync(new URL("public" + atlas.compressedUrl, root));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

test("standalone brainstem atlas retains source label order, frame, method, license and checksums", () => {
  assert.deepEqual(
    atlas.parts.map((part) => [part.channel, part.label, part.id]),
    [
      [1, 175, "medulla"],
      [2, 174, "pons"],
      [3, 178, "scp"],
      [4, 173, "midbrain"],
    ],
  );
  assert.equal(
    atlas.parts.find((part) => part.id === "scp").hemisphere,
    "bilateral",
  );
  assert.deepEqual(atlas.source.shape, [53, 67, 85, 5]);
  assert.deepEqual(atlas.source.spacingMm, [1, 1, 1]);
  assert.match(
    atlas.source.frame,
    /symmetric; not registered to the fsaverage/,
  );
  assert.match(atlas.source.method, /including background/);
  assert.match(atlas.source.method, /no additional smoothing or resampling/);
  assert.equal(
    atlas.source.paper,
    "https://doi.org/10.1016/j.neuroimage.2015.02.065",
  );
  assert.match(
    readFileSync(new URL("public" + atlas.source.license, root), "utf8"),
    /General Hospital Corporation/,
  );
  assert.deepEqual(
    JSON.parse(
      readFileSync(
        new URL("public/subregions/brainstem-provenance.json", root),
      ),
    ),
    atlas,
  );
  assert.equal(raw.length, atlas.geometry.bytes);
  assert.equal(compressed.length, atlas.geometry.compressedBytes);
  assert.equal(sha256(raw), atlas.geometry.sha256);
  assert.equal(sha256(compressed), atlas.geometry.compressedSha256);
  assert.deepEqual(gunzipSync(compressed), raw);
});

test("packed subregion geometry has finite vertices, valid unit normals and indexed nondegenerate faces", () => {
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  let end = 0;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const part of atlas.parts) {
    assert.equal(part.offset, end);
    assert.ok(Number.isInteger(part.vertices) && part.vertices > 0);
    assert.ok(Number.isInteger(part.triangles) && part.triangles > 0);
    end += part.vertices * 28 + part.triangles * 12;
    assert.ok(end <= raw.length);
    const position = (i, axis) =>
      view.getFloat32(part.offset + i * 12 + axis * 4, true);
    for (let i = 0; i < part.vertices; i++) {
      let normalLength = 0;
      for (let axis = 0; axis < 3; axis++) {
        const p = position(i, axis);
        const n = view.getFloat32(
          part.offset + part.vertices * 12 + i * 12 + axis * 4,
          true,
        );
        assert.ok(Number.isFinite(p) && Number.isFinite(n));
        min[axis] = Math.min(min[axis], p);
        max[axis] = Math.max(max[axis], p);
        normalLength += n * n;
      }
      assert.ok(Math.abs(normalLength - 1) < 1e-5);
      assert.equal(
        view.getFloat32(part.offset + part.vertices * 24 + i * 4, true),
        1,
      );
    }
    for (let i = 0; i < part.triangles; i++) {
      const ids = [0, 1, 2].map((j) =>
        view.getUint32(part.offset + part.vertices * 28 + i * 12 + j * 4, true),
      );
      assert.ok(ids.every((id) => id < part.vertices));
      assert.equal(new Set(ids).size, 3);
      const a = [0, 1, 2].map(
        (axis) => position(ids[1], axis) - position(ids[0], axis),
      );
      const b = [0, 1, 2].map(
        (axis) => position(ids[2], axis) - position(ids[0], axis),
      );
      assert.ok(
        Math.hypot(
          a[1] * b[2] - a[2] * b[1],
          a[2] * b[0] - a[0] * b[2],
          a[0] * b[1] - a[1] * b[0],
        ) > 0,
      );
    }
  }
  assert.equal(end, raw.length);
  assert.deepEqual(
    min.map((value, axis) => (value + max[axis]) / 2),
    [0, 5, 10],
  );
  assert.ok(Math.max(...max.map((value, axis) => value - min[axis])) < 100);
});

test("brainstem subregions stay within the on-demand geometry budget", () => {
  assert.ok(compressed.length < 300_000);
  const triangles = atlas.parts.reduce((sum, part) => sum + part.triangles, 0);
  assert.equal(triangles, atlas.geometry.triangles);
  assert.ok(triangles < 50_000);
});
