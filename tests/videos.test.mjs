import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  dissectionVideos,
  filterVideos,
  regionVideoNote,
  videoProviders,
  videosForRegion,
} from "../src/videos.ts";

const atlas = JSON.parse(
  await readFile(
    new URL("../src/atlas-manifest.json", import.meta.url),
    "utf8",
  ),
);
const knownKeys = new Set(atlas.parts.map((region) => region.key));
const knownGroups = new Set(atlas.parts.map((region) => region.group));

test("20 unique films retain institutional provenance and checked channel metadata", () => {
  assert.equal(dissectionVideos.length, 20);
  assert.equal(new Set(dissectionVideos.map((video) => video.id)).size, 20);
  for (const video of dissectionVideos) {
    assert.match(video.id, /^[A-Za-z0-9_-]{11}$/);
    assert.equal(video.url, `https://www.youtube.com/watch?v=${video.id}`);
    const provider = videoProviders[video.provider];
    assert.ok(provider);
    assert.ok(video.metadataTitle && video.description);
    assert.match(
      video.channel,
      video.provider === "utah" ? /Eccles Health Sciences/ : /UBC Medicine/,
    );
    assert.ok(
      ["library.med.utah.edu", "www.neuroanatomy.ca"].includes(
        new URL(provider.sourceUrl).hostname,
      ),
    );
    assert.ok(video.minutes === null || Number.isInteger(video.minutes));
    for (const key of [
      ...video.focusKeys,
      ...video.systemKeys,
      ...video.contextKeys,
    ])
      assert.ok(knownKeys.has(key), `Unknown anatomy: ${key}`);
    for (const group of video.contextGroups)
      assert.ok(knownGroups.has(group), `Unknown group: ${group}`);
  }
});

test("all 104 anatomical regions have bounded, unique video recommendations", () => {
  for (const region of atlas.parts) {
    const matches = videosForRegion(region);
    assert.ok(matches.length > 0 && matches.length <= 4, region.id);
    assert.equal(
      new Set(matches.map((match) => match.video.id)).size,
      matches.length,
    );
    assert.ok(regionVideoNote(region));
  }
});

test("focused region lessons are preferred over generic introductions", () => {
  const hippocampus = videosForRegion({
    key: "hippocampus",
    group: "Deep structures",
  });
  assert.equal(hippocampus[0].video.id, "z8rE7Z5ud-g");
  assert.equal(hippocampus[0].relevance, "structure");
  assert.ok(hippocampus.every((match) => !match.video.general));
  const ventricles = videosForRegion({
    key: "fourth-ventricle",
    group: "Ventricles",
  });
  assert.equal(ventricles[0].video.id, "zqQ6iKw5DjY");
});

test("small parcels and composite imaging labels do not acquire exact-match claims", () => {
  for (const region of atlas.parts.filter(
    (region) =>
      region.kind === "cortex" ||
      region.key.startsWith("corpus-callosum-") ||
      region.key === "ventral-diencephalon",
  )) {
    assert.ok(
      videosForRegion(region).every((match) => match.relevance !== "structure"),
      region.id,
    );
  }
  const callosum = videosForRegion({
    key: "corpus-callosum-anterior",
    group: "White matter",
  });
  assert.equal(callosum[0].video.id, "PazaHElk6wc");
  assert.ok(callosum.every((match) => match.relevance === "context"));
  assert.match(
    regionVideoNote({ key: "ventral-diencephalon", group: "Deep structures" }),
    /composite/,
  );
});

test("film search handles anatomical names and combines institution/topic filters", () => {
  assert.equal(filterVideos().length, 20);
  assert.ok(filterVideos({ query: "  nucleus accumbens  " }).length > 0);
  assert.ok(
    filterVideos({ query: "corpus callosum" }).some(
      (video) => video.id === "PazaHElk6wc",
    ),
  );
  const filtered = filterVideos({ provider: "ubc", topic: "Cerebellum" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].id, "17mxfO9nklQ");
  assert.deepEqual(filterVideos({ query: "no such anatomy 123" }), []);
});
