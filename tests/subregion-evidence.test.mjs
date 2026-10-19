import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import test from "node:test";
import { probabilityPercent } from "../src/subregion-evidence.ts";

const load = (path) => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url)));
const datasets = ["brainstem", "thalamus", "amygdala", "hippocampus"].map((kind) => ({
  kind,
  atlas: load(`src/${kind}-subregions.json`),
  evidence: load(`public/subregions/${kind}-evidence.json`),
}));

for (const { kind, atlas, evidence } of datasets) {
  test(`${kind} probability evidence accounts for every surfaced and omitted label with pinned provenance`, () => {
    assert.equal(evidence.version, 1);
    assert.equal(evidence.kind, kind);
    assert.deepEqual(evidence.binEdges, [0, .25, .5, .75, 1]);
    assert.match(evidence.method, /every channel, including unknown\/background/);
    assert.match(evidence.method, /not necessarily a winning voxel/);
    const manifest = readFileSync(new URL(`../public/subregions/${kind}-provenance.json`, import.meta.url));
    assert.equal(evidence.source.manifestSha256, createHash("sha256").update(manifest).digest("hex"));
    assert.equal(evidence.source.archiveSha256, atlas.source.archiveSha256);
    assert.equal(evidence.source.documentation, atlas.source.documentation);
    assert.equal(evidence.source.paper, atlas.source.paper);
    assert.equal(evidence.source.license, atlas.source.license);
    assert.match(evidence.source.attribution, /General Hospital Corporation/);
    const niftiHashes = atlas.source.volumes
      ? Object.fromEntries(Object.entries(atlas.source.volumes).map(([side, volume]) => [side, volume.sha256]))
      : { both: atlas.source.niftiSha256 };
    assert.deepEqual(evidence.source.niftiSha256, niftiHashes);
    const entries = [...atlas.parts, ...(atlas.omitted ?? [])];
    assert.deepEqual(Object.keys(evidence.entries).sort(), entries.map((part) => part.id).sort());
    const rows = atlas.source.names.trim().split("\n").map((line) => line.split(","));
    for (const part of entries) {
      const sample = evidence.entries[part.id];
      assert.equal(sample.voxels, part.voxels);
      assert.equal(sample.label, part.label);
      assert.equal(sample.channel, part.channel);
      assert.equal(sample.winningProbabilityBins.length, 4);
      assert.equal(sample.winningProbabilityBins.reduce((a, b) => a + b, 0), part.voxels);
      assert.ok(sample.winningProbabilityBins.every((value) => Number.isSafeInteger(value) && value >= 0));
      const peak = sample.peak;
      assert.ok(peak.probability > 0 && peak.probability <= 1 + 1e-6);
      if (part.maxProbability !== undefined) assert.equal(peak.probability, part.maxProbability);
      const volume = atlas.source.volumes?.[part.hemisphere] ?? atlas.source;
      assert.equal(peak.index.length, 3);
      assert.ok(peak.index.every((value, axis) => Number.isInteger(value) && value >= 0 && value < volume.shape[axis]));
      for (let axis = 0; axis < 3; axis++) {
        const ras = volume.affine[axis].slice(0, 3).reduce((sum, value, index) => sum + value * peak.index[index], volume.affine[axis][3]);
        assert.equal(peak.rasMm[axis], ras);
      }
      const other = peak.strongestOther;
      assert.notEqual(other.channel, sample.channel);
      assert.equal(other.label, Number(rows[other.channel][0]));
      assert.equal(other.sourceName, rows[other.channel][1]);
      assert.ok(other.probability >= -1e-6 && other.probability <= 1 + 1e-6);
      assert.equal(peak.selectedWins, peak.winnerChannel === sample.channel);
      assert.equal(peak.winnerChannel, peak.probability > other.probability ? sample.channel : peak.probability < other.probability ? other.channel : Math.min(sample.channel, other.channel));
      if (part.voxels) {
        assert.equal(sample.winningProbabilityRange.length, 2);
        assert.ok(sample.winningProbabilityRange[0] <= sample.winningProbabilityRange[1]);
        assert.ok(sample.winningProbabilityRange[1] <= peak.probability);
      } else {
        assert.equal(sample.winningProbabilityRange, null);
        assert.equal(peak.selectedWins, false);
      }
    }
  });
}

test("tiny medial and fissure winner masks retain sub-50% evidence, while VM remains unsurfaced", () => {
  const amygdala = datasets.find((data) => data.kind === "amygdala").evidence;
  for (const side of ["left", "right"]) {
    const medial = amygdala.entries[`amyg-${side}-7006`];
    assert.equal(medial.voxels, 17);
    assert.deepEqual(medial.winningProbabilityBins, [0, 17, 0, 0]);
    assert.equal(medial.peak.probability, 0.4507511854171753);
    assert.equal(medial.peak.strongestOther.label, 0);
    assert.equal(medial.peak.selectedWins, true);
  }
  const hippocampus = datasets.find((data) => data.kind === "hippocampus").evidence;
  assert.deepEqual(hippocampus.entries["hipp-left-215"].winningProbabilityBins, [62, 5573, 1218, 8]);
  const thalamus = datasets.find((data) => data.kind === "thalamus").evidence;
  const vm = thalamus.entries["thal-8130"];
  assert.equal(vm.voxels, 0);
  assert.equal(vm.peak.probability, 0.1764208972454071);
  assert.equal(vm.peak.strongestOther.sourceName, "Left-VLp");
  assert.ok(vm.peak.strongestOther.probability > vm.peak.probability);
});

test("evidence remains small enough to load per requested atlas without source volumes", () => {
  let raw = 0, gzip = 0;
  for (const { kind } of datasets) {
    const bytes = readFileSync(new URL(`../public/subregions/${kind}-evidence.json`, import.meta.url));
    assert.ok(bytes.length < 50_000);
    assert.ok(gzipSync(bytes).length < 10_000);
    raw += bytes.length;
    gzip += gzipSync(bytes).length;
  }
  assert.ok(raw < 100_000);
  assert.ok(gzip < 18_000);
});

test("rounded percentages preserve small positive probabilities and exact endpoints", () => {
  assert.equal(probabilityPercent(0), "0.0%");
  assert.equal(probabilityPercent(-1e-8), "0.0%");
  assert.equal(probabilityPercent(.0009), "<0.1%");
  assert.equal(probabilityPercent(.001), "0.1%");
  assert.equal(probabilityPercent(.4507511854171753), "45.1%");
  assert.equal(probabilityPercent(1 + 1e-7), "100.0%");
});
