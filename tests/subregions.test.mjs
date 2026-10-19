import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import test from "node:test";
import { matchingSubregions, subregionName, subregionForRegion, isSubregionKind } from "../src/subregions.ts";

const root = new URL("../", import.meta.url);
const load = (name) =>
  JSON.parse(readFileSync(new URL(`src/${name}-subregions.json`, root)));
const brainstem = load("brainstem");
const thalamus = load("thalamus");
const amygdala = load("amygdala");
const hippocampus = load("hippocampus");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

for (const [name, atlas, byteBudget, triangleBudget] of [
  ["brainstem", brainstem, 300_000, 50_000],
  ["thalamus", thalamus, 1_500_000, 250_000],
  ["amygdala", amygdala, 1_500_000, 250_000],
  ["hippocampus", hippocampus, 6_500_000, 1_000_000],
]) {
  const assets = atlas.assets ?? [atlas];
  const rawFiles = assets.map((asset) => readFileSync(new URL("public" + asset.rawUrl, root)));
  const compressedFiles = assets.map((asset) => readFileSync(new URL("public" + asset.compressedUrl, root)));
  const raw = Buffer.concat(rawFiles);
  const compressed = Buffer.concat(compressedFiles);
  test(`${name} retains source channels, frame, license and matching public provenance`, () => {
    const channels = atlas.source.names
      .trim()
      .split(/\n/)
      .map((row) => row.split(","));
    const entries = [...atlas.parts, ...(atlas.omitted ?? [])];
    const sides = atlas.source.volumes ? ["left", "right"] : ["both"];
    assert.equal(entries.length, (atlas.source.includedChannels?.length ?? channels.length - 1) * sides.length);
    assert.equal(
      new Set(entries.map((part) => `${part.hemisphere}-${part.channel}`)).size,
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
    const niftiHashes = atlas.source.volumes
      ? Object.values(atlas.source.volumes).map((volume) => volume.sha256)
      : [atlas.source.niftiSha256];
    for (const hash of [atlas.source.archiveSha256, ...niftiHashes])
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
    const assetEnds = assets.map(() => 0);
    let end = 0;
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const part of atlas.parts) {
      const fileIndex = atlas.assets ? assets.findIndex((asset) => asset.hemisphere === part.hemisphere) : 0;
      assert.ok(fileIndex >= 0);
      const file = rawFiles[fileIndex];
      const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
      assert.equal(part.offset, assetEnds[fileIndex]);
      assetEnds[fileIndex] += part.vertices * 28 + part.triangles * 12;
      assert.ok(Number.isInteger(part.vertices) && part.vertices > 0);
      assert.ok(Number.isInteger(part.triangles) && part.triangles > 0);
      end += part.vertices * 28 + part.triangles * 12;
      assert.ok(assetEnds[fileIndex] <= file.length);
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
    assert.deepEqual(assetEnds, rawFiles.map((file) => file.length));
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

test("amygdala keeps nine labels per side and competes against all hippocampal/background channels", () => {
  assert.equal(amygdala.parts.length, 18);
  assert.deepEqual(amygdala.omitted, []);
  assert.deepEqual(amygdala.source.spacingMm, [0.25, 0.25, 0.25]);
  assert.deepEqual(amygdala.source.includedChannels, [21, 22, 23, 24, 25, 26, 27, 28, 29]);
  assert.equal(amygdala.source.excludedChannels.length, 20);
  assert.match(amygdala.source.method, /across all 30 channels.*hippocampal channels/);
  assert.equal(amygdala.source.paper, "https://doi.org/10.1016/j.neuroimage.2017.04.046");
  const { left, right } = amygdala.source.volumes;
  assert.deepEqual(left.shape, [164, 224, 196, 30]);
  assert.deepEqual(right.shape, left.shape);
  assert.equal(left.probabilityArraySha256, right.probabilityArraySha256);
  assert.equal(left.affine[0][0], 0.25);
  assert.equal(right.affine[0][0], -0.25);
  assert.equal(left.affine[0][3], -right.affine[0][3]);
  for (const side of ["left", "right"]) {
    const parts = amygdala.parts.filter((part) => part.hemisphere === side);
    assert.equal(parts.length, 9);
    const medial = parts.find((part) => part.abbreviation === "Me");
    assert.equal(medial.voxels, 17);
    assert.ok(medial.maxProbability < 0.5);
    assert.match(medial.description, /tiny fragment.*not establish.*full anatomical extent/);
    assert.equal(parts.find((part) => part.abbreviation === "PL").voxelConnectedComponents6, 11);
    assert.equal(parts.find((part) => part.abbreviation === "CAT").sourceName, "Corticoamygdaloid-transitio");
  }
});

test("reflected source affines preserve paired amygdala surface winding and anatomical sides", () => {
  const raw = readFileSync(new URL("public" + amygdala.rawUrl, root));
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const signedVolume = (part) => {
    const point = (index) => [0, 1, 2].map((axis) => view.getFloat32(part.offset + index * 12 + axis * 4, true));
    let sum = 0;
    for (let i = 0; i < part.triangles; i++) {
      const [a, b, c] = [0, 1, 2].map((corner) => point(view.getUint32(part.offset + part.vertices * 28 + i * 12 + corner * 4, true)));
      sum += a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
    }
    return sum / 6;
  };
  for (const left of amygdala.parts.filter((part) => part.hemisphere === "left")) {
    const right = amygdala.parts.find((part) => part.hemisphere === "right" && part.label === left.label);
    assert.ok(left.center[0] < 0 && right.center[0] > 0);
    assert.equal(left.voxels, right.voxels);
    assert.equal(left.triangles, right.triangles);
    assert.ok(Math.abs(signedVolume(left)) > 0);
    assert.ok(Math.abs(signedVolume(left) - signedVolume(right)) < 1e-6);
  }
});

test("standalone targets keep whole-brain source labels and hemisphere search distinct", () => {
  for (const [id, kind] of [["aseg-16", "brainstem"], ["aseg-10", "thalamus"], ["aseg-49", "thalamus"], ["aseg-18", "amygdala"], ["aseg-54", "amygdala"], ["aseg-17", "hippocampus"], ["aseg-53", "hippocampus"]]) {
    assert.equal(subregionForRegion(id), kind);
    assert.ok(isSubregionKind(kind));
  }
  assert.equal(subregionForRegion("aseg-14"), null);
  assert.equal(subregionForRegion("constructor"), null);
  assert.equal(isSubregionKind("constructor"), false);
  assert.equal(isSubregionKind(null), false);
  assert.deepEqual(matchingSubregions(amygdala.parts, "right medial nucleus", "both").map((part) => part.id), ["amyg-right-7006"]);
  assert.equal(matchingSubregions(amygdala.parts, "paralaminar", "left").length, 1);
  assert.equal(matchingSubregions(amygdala.parts, "HATA", "both").length, 0);
});

test("hippocampal coverage keeps 20 protocol labels per side, including space and white matter", () => {
  assert.equal(hippocampus.parts.length, 40);
  assert.deepEqual(hippocampus.omitted, []);
  assert.deepEqual(hippocampus.source.includedChannels, Array.from({ length: 20 }, (_, i) => i + 1));
  assert.deepEqual(hippocampus.source.excludedChannels, Array.from({ length: 9 }, (_, i) => i + 21));
  assert.match(hippocampus.source.method, /all 30 channels.*amygdala channels/);
  assert.equal(hippocampus.source.paper, "https://doi.org/10.1016/j.neuroimage.2015.04.042");
  assert.deepEqual(hippocampus.source.spacingMm, [0.25, 0.25, 0.25]);
  assert.deepEqual(hippocampus.source.volumes, amygdala.source.volumes);
  for (const side of ["left", "right"]) {
    const parts = hippocampus.parts.filter((part) => part.hemisphere === side);
    assert.equal(parts.length, 20);
    assert.equal(parts.filter((part) => part.group === "White matter").length, 2);
    const fissure = parts.find((part) => part.sourceName === "hippocampal-fissure");
    assert.equal(fissure.group, "Fluid space");
    assert.equal(fissure.voxelConnectedComponents6, 155);
    assert.match(fissure.description, /rather than neural tissue/);
    assert.equal(parts.find((part) => part.sourceName === "alveus").voxelConnectedComponents6, 108);
    for (const part of parts.filter((part) => part.sourceName.startsWith("CA3-"))) {
      assert.match(part.name, /CA2\/3/);
      assert.match(part.description, /no independent CA2 boundary/);
    }
  }
  assert.equal(matchingSubregions(hippocampus.parts, "CA2", "left").length, 2);
  assert.equal(matchingSubregions(hippocampus.parts, "CA3 body", "right").length, 1);
  assert.equal(matchingSubregions(hippocampus.parts, "dentate head", "left").length, 1);
  assert.equal(matchingSubregions(hippocampus.parts, "GC-ML-DG", "right").length, 2);
  assert.equal(matchingSubregions(hippocampus.parts, "HATA", "both").length, 2);
});

test("hemisphere assets keep exact geometry and independent offsets without downloading the other side", () => {
  assert.deepEqual(hippocampus.assets.map((asset) => asset.hemisphere), ["left", "right"]);
  for (const asset of hippocampus.assets) {
    const raw = readFileSync(new URL("public" + asset.rawUrl, root));
    const compressed = readFileSync(new URL("public" + asset.compressedUrl, root));
    assert.equal(raw.length, asset.geometry.bytes);
    assert.equal(compressed.length, asset.geometry.compressedBytes);
    assert.equal(sha256(raw), asset.geometry.sha256);
    assert.equal(sha256(compressed), asset.geometry.compressedSha256);
    assert.deepEqual(gunzipSync(compressed), raw);
    assert.ok(compressed.length < 3_300_000);
    assert.ok(asset.geometry.triangles < 500_000);
    const parts = hippocampus.parts.filter((part) => part.hemisphere === asset.hemisphere);
    assert.equal(parts[0].offset, 0);
    assert.equal(parts.reduce((sum, part) => sum + part.triangles, 0), asset.geometry.triangles);
    assert.ok(parts.every((part) => asset.hemisphere === "left" ? part.center[0] < 0 : part.center[0] > 0));
  }
});
