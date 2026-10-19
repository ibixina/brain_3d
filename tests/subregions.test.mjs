import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { matchingSubregions, subregionName } from "../src/subregions.ts";

const root = new URL("../", import.meta.url);
const load = (name) =>
  JSON.parse(readFileSync(new URL(`src/${name}-subregions.json`, root)));
const brainstem = load("brainstem");
const thalamus = load("thalamus");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const [name, atlas, byteBudget, triangleBudget] of [
  ["brainstem", brainstem, 300_000, 50_000],
  ["thalamus", thalamus, 1_500_000, 250_000],
]) {
  const raw = readFileSync(new URL("public" + atlas.rawUrl, root));
  const compressed = readFileSync(
    new URL("public" + atlas.compressedUrl, root),
  );
  test(`${name} retains source channels, frame, license and matching public provenance`, () => {
    const channels = atlas.source.names
      .trim()
      .split(/\n/)
      .map((row) => row.split(","));
    const entries = [...atlas.parts, ...(atlas.omitted ?? [])];
    assert.equal(entries.length, channels.length - 1);
    assert.equal(
      new Set(entries.map((part) => part.channel)).size,
      entries.length,
    );
    for (const entry of entries) {
      assert.equal(Number(channels[entry.channel][0]), entry.label);
      if (entry.sourceName)
        assert.equal(channels[entry.channel][1], entry.sourceName);
    }
    assert.match(
      atlas.source.frame,
      /symmetric; not registered to the fsaverage/,
    );
    assert.match(atlas.source.method, /including .*background/);
    assert.match(atlas.source.method, /no additional smoothing or resampling/);
    assert.match(
      readFileSync(new URL("public" + atlas.source.license, root), "utf8"),
      /General Hospital Corporation/,
    );
    assert.deepEqual(
      JSON.parse(
        readFileSync(
          new URL(`public/subregions/${name}-provenance.json`, root),
        ),
      ),
      atlas,
    );
    for (const hash of [atlas.source.archiveSha256, atlas.source.niftiSha256])
      assert.match(hash, /^[a-f0-9]{64}$/);
  });
  test(`${name} compressed geometry matches the source-derived binary within its runtime budget`, () => {
    assert.equal(raw.length, atlas.geometry.bytes);
    assert.equal(compressed.length, atlas.geometry.compressedBytes);
    assert.equal(sha256(raw), atlas.geometry.sha256);
    assert.equal(sha256(compressed), atlas.geometry.compressedSha256);
    assert.deepEqual(gunzipSync(compressed), raw);
    assert.ok(compressed.length < byteBudget);
    const triangles = atlas.parts.reduce(
      (sum, part) => sum + part.triangles,
      0,
    );
    assert.equal(triangles, atlas.geometry.triangles);
    assert.ok(triangles < triangleBudget);
  });
  test(`${name} packed surfaces have valid normals, indexed faces and independent recentered bounds`, () => {
    const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    let end = 0;
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
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
          view.getUint32(
            part.offset + part.vertices * 28 + i * 12 + j * 4,
            true,
          ),
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
}

test("brainstem keeps the four original compartment labels and its 1 mm source grid", () => {
  assert.deepEqual(
    brainstem.parts.map((part) => [part.channel, part.label, part.id]),
    [
      [1, 175, "medulla"],
      [2, 174, "pons"],
      [3, 178, "scp"],
      [4, 173, "midbrain"],
    ],
  );
  assert.equal(
    brainstem.parts.find((part) => part.id === "scp").hemisphere,
    "bilateral",
  );
  assert.deepEqual(brainstem.source.shape, [53, 67, 85, 5]);
  assert.deepEqual(brainstem.source.spacingMm, [1, 1, 1]);
  assert.equal(
    brainstem.source.paper,
    "https://doi.org/10.1016/j.neuroimage.2015.02.065",
  );
});

test("thalamic coverage separates 46 winner surfaces from six nonzero-probability labels without a surface", () => {
  assert.deepEqual(thalamus.source.shape, [138, 106, 94, 53]);
  assert.deepEqual(thalamus.source.spacingMm, [0.5, 0.5, 0.5]);
  assert.equal(
    thalamus.source.paper,
    "https://doi.org/10.1016/j.neuroimage.2018.08.012",
  );
  assert.equal(thalamus.parts.length, 46);
  for (const side of ["left", "right"]) {
    const parts = thalamus.parts.filter((part) => part.hemisphere === side);
    const omitted = thalamus.omitted.filter((part) => part.hemisphere === side);
    assert.equal(parts.length, 23);
    assert.deepEqual(omitted.map((part) => part.abbreviation).sort(), [
      "Pc",
      "Pt",
      "VM",
    ]);
    assert.ok(
      omitted.every(
        (part) =>
          part.voxels === 0 && part.maxProbability > 0 && !("vertices" in part),
      ),
    );
    assert.ok(
      parts
        .find((part) => part.abbreviation === "VPL")
        .description.includes("ventral posteromedial"),
    );
    assert.ok(
      parts
        .find((part) => part.abbreviation === "AV")
        .description.includes("anterior medial"),
    );
    assert.ok(parts.some((part) => part.abbreviation === "LGN"));
    assert.ok(parts.some((part) => part.abbreviation === "MGN"));
  }
  for (const left of thalamus.parts.filter(
    (part) => part.hemisphere === "left",
  )) {
    const right = thalamus.parts.find(
      (part) => part.key === left.key && part.hemisphere === "right",
    );
    assert.ok(left.center[0] < 0 && right.center[0] > 0);
    assert.equal(left.voxels, right.voxels);
    assert.equal(left.triangles, right.triangles);
  }
});

test("nuclear search combines expanded names, exact source abbreviations, groups and hemisphere scope", () => {
  assert.deepEqual(
    matchingSubregions(thalamus.parts, "VPM", "left").map((part) => part.key),
    ["VPL"],
  );
  assert.deepEqual(
    matchingSubregions(thalamus.parts, "anterodorsal", "right").map(
      (part) => part.key,
    ),
    ["AV"],
  );
  assert.deepEqual(
    matchingSubregions(thalamus.parts, "mediodorsal MDm", "left").map(
      (part) => part.label,
    ),
    [8113],
  );
  assert.deepEqual(
    matchingSubregions(thalamus.parts, "RIGHT LGN", "both").map(
      (part) => part.label,
    ),
    [8209],
  );
  assert.equal(
    matchingSubregions(thalamus.parts, "intralaminar", "left").length,
    4,
  );
  assert.equal(
    matchingSubregions(thalamus.parts, "ventromedial", "both").length,
    0,
  );
  assert.equal(
    matchingSubregions(thalamus.omitted, "ventromedial", "both").length,
    2,
  );
  assert.equal(matchingSubregions(thalamus.parts, "right", "left").length, 0);
  assert.equal(
    subregionName(thalamus.parts.find((part) => part.label === 8109)),
    "Left Lateral geniculate · LGN",
  );
  assert.equal(matchingSubregions(brainstem.parts, "", "both").length, 4);
});
