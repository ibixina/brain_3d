import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import test from "node:test";

const modelURL = new URL("../public/models/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("atlas.json", modelURL), "utf8"),
);
const overview = await readFile(new URL("atlas.bin", modelURL));

function validateMesh(bytes, offset, vertices, triangles, name) {
  assert.ok(vertices > 0 && triangles > 0, `${name}: nonempty geometry`);
  const size = vertices * 28 + triangles * 12;
  assert.ok(offset + size <= bytes.byteLength, `${name}: complete buffer`);
  const start = bytes.byteOffset + offset;
  const data = new DataView(bytes.buffer, start, size);
  for (let i = 0; i < vertices; i++) {
    for (let axis = 0; axis < 3; axis++) {
      const coordinate = data.getFloat32(i * 12 + axis * 4, true);
      assert.ok(
        Number.isFinite(coordinate) && Math.abs(coordinate) < 300,
        `${name}: finite anatomical coordinates`,
      );
    }
    const normalOffset = vertices * 12 + i * 12;
    const normal = [0, 4, 8].map((j) =>
      data.getFloat32(normalOffset + j, true),
    );
    assert.ok(
      Math.abs(Math.hypot(...normal) - 1) < 0.01,
      `${name}: unit surface normals`,
    );
    const shade = data.getFloat32(vertices * 24 + i * 4, true);
    assert.ok(shade >= 0.5 && shade <= 1, `${name}: valid sulcal shading`);
  }
  const indexOffset = vertices * 28;
  for (let i = 0; i < triangles * 3; i++) {
    assert.ok(
      data.getUint32(indexOffset + i * 4, true) < vertices,
      `${name}: index references an existing vertex`,
    );
  }
  return size;
}

test("104 unique structures with bilateral 34-parcel cortical coverage", () => {
  assert.equal(manifest.parts.length, 104);
  assert.equal(
    new Set(manifest.parts.map((p) => p.id)).size,
    manifest.parts.length,
  );
  for (const hemisphere of ["left", "right"]) {
    assert.equal(
      manifest.parts.filter(
        (p) => p.kind === "cortex" && p.hemisphere === hemisphere,
      ).length,
      34,
    );
    for (const key of [
      "hippocampus",
      "amygdala",
      "thalamus",
      "cerebellar-cortex",
    ]) {
      assert.ok(
        manifest.parts.some(
          (p) => p.key === key && p.hemisphere === hemisphere,
        ),
      );
    }
  }
});

test("overview meshes have valid geometry, aligned offsets, and consistent counts", () => {
  let offset = 0;
  let triangles = 0;
  for (const part of manifest.parts) {
    assert.equal(part.offset, offset);
    assert.equal(part.offset % 4, 0);
    offset += validateMesh(
      overview,
      part.offset,
      part.vertices,
      part.triangles,
      part.id,
    );
    triangles += part.triangles;
    if (part.hemisphere === "left")
      assert.ok(part.center[0] < 0, `${part.id}: left/right orientation`);
    if (part.hemisphere === "right")
      assert.ok(part.center[0] > 0, `${part.id}: left/right orientation`);
  }
  assert.equal(offset, overview.byteLength);
  assert.equal(triangles, manifest.totalTriangles);
  const defaultFaces = manifest.parts
    .filter((p) => !["White matter", "Ventricles"].includes(p.group))
    .reduce((n, p) => n + p.triangles, 0);
  assert.ok(
    defaultFaces < 100_000,
    "default scene has fewer than 100,000 triangles",
  );
});

test("compressed overview matches the original binary exactly", async () => {
  const compressed = await readFile(new URL("atlas.mesh", modelURL));
  assert.deepEqual(gunzipSync(compressed), overview);
  assert.ok(compressed.byteLength < 3_000_000);
});

test("every region has a valid independently loadable detail mesh", async () => {
  for (const part of manifest.parts) {
    assert.ok(part.detail.url === `/models/${part.id}.bin`);
    const detail = await readFile(new URL(`${part.id}.bin`, modelURL));
    const size = validateMesh(
      detail,
      0,
      part.detail.vertices,
      part.detail.triangles,
      part.id + " detail",
    );
    assert.equal(size, detail.byteLength);
    assert.ok(part.detail.triangles >= part.triangles);
    if (part.kind === "cortex")
      assert.ok(
        part.detail.triangles > part.triangles * 3,
        "detail uses a finer anatomical mesh",
      );
  }
});

test("asset provenance records reproducible upstream URLs and checksums", async () => {
  const bundledManifest = JSON.parse(
    await readFile(
      new URL("../src/atlas-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(bundledManifest, manifest);
  const checksums = JSON.parse(
    await readFile(
      new URL("../scripts/source-checksums.json", import.meta.url),
      "utf8",
    ),
  );
  assert.ok(manifest.sources.some((s) => s.file === "fsaverage6.tar.gz"));
  for (const source of manifest.sources) {
    assert.equal(source.sha256, checksums[source.file]);
    assert.match(source.url, /^https:\/\//);
    assert.match(source.sha256, /^[0-9a-f]{64}$/);
    if (source.url.includes("mne-testing-data"))
      assert.match(source.url, /mne-testing-data\/[0-9a-f]{40}\//);
  }
});
