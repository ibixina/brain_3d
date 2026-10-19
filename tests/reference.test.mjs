import assert from "node:assert/strict";
import test from "node:test";
import {
  anatomicalTerms,
  searchRegions,
  matchedAnatomicalTerms,
} from "../src/anatomical-search.ts";
import {
  referenceArticles,
  referenceSources,
  referenceCheckedOn,
  searchReference,
  referenceExplorations,
} from "../src/reference.ts";
import {
  referenceOrigin,
  withReferenceOrigin,
} from "../src/reference-navigation.ts";
import { learningPaths } from "../src/learning.ts";
import { dissectionVideos } from "../src/videos.ts";
import {
  regionReferenceTopics,
  referenceTopicsForRegion,
  referenceKeepsRegion,
} from "../src/reference-topics.ts";
import { buildReferenceTopics } from "../scripts/build_reference_topics.mjs";
import catalogue from "../src/reference-data.json" with { type: "json" };
import atlas from "../src/atlas-manifest.json" with { type: "json" };

test("anatomical aliases find available parcels while respecting hemisphere and combined terms", () => {
  assert.deepEqual(
    searchRegions("left HESCHL’S gyrus").map((item) => item.id),
    ["lh-transversetemporal"],
  );
  assert.deepEqual(
    searchRegions("Broca").map((item) => item.id),
    ["lh-parsopercularis", "lh-parstriangularis"],
  );
  assert.equal(searchRegions("right Broca").length, 0);
  assert.deepEqual(
    searchRegions("left V1").map((item) => item.id),
    ["lh-pericalcarine"],
  );
  assert.deepEqual(
    searchRegions("lentiform right").map((item) => item.id),
    ["aseg-51", "aseg-52"],
  );
  assert.equal(searchRegions("lh IFG").length, 3);
  assert.equal(searchRegions("left hippocampus")[0].id, "aseg-17");
  assert.equal(searchRegions("memory impossible-term").length, 0);
  assert.equal(searchRegions("  ").length, atlas.parts.length);
});

test("alias explanations cite their scope and source and only target actual atlas keys", () => {
  for (const term of anatomicalTerms) {
    assert.ok(term.note.length > 50);
    assert.equal(new URL(term.source).protocol, "https:");
    for (const key of term.keys)
      assert.ok(
        atlas.parts.some(
          (part) =>
            part.key === key &&
            (!term.hemisphere || part.hemisphere === term.hemisphere),
        ),
      );
  }
  assert.equal(
    matchedAnatomicalTerms("left heschl’s gyrus")[0].name,
    "Heschl’s gyrus",
  );
  assert.equal(
    matchedAnatomicalTerms("left V1")[0].name,
    "Primary visual cortex",
  );
  assert.equal(matchedAnatomicalTerms("precentral").length, 0);
  assert.equal(matchedAnatomicalTerms("m1x").length, 0);
});

test("reference articles retain precise sources, scope limits, and valid anatomy and topic links", () => {
  assert.equal(
    new Set(referenceArticles.map((article) => article.id)).size,
    referenceArticles.length,
  );
  assert.ok(Number.isFinite(Date.parse(referenceCheckedOn)));
  for (const article of referenceArticles) {
    assert.ok(article.scope && article.summary && article.category);
    assert.ok(article.paragraphs.length >= 2);
    assert.ok(article.sources.length > 0 && article.regions.length > 0);
    for (const source of article.sources) {
      assert.ok(
        referenceSources[source].title && referenceSources[source].kind,
      );
      assert.equal(new URL(referenceSources[source].url).protocol, "https:");
    }
    for (const id of article.regions)
      assert.ok(
        atlas.parts.some((part) => part.id === id),
        `${article.id}: ${id}`,
      );
    for (const id of article.related)
      assert.ok(
        id !== article.id && referenceArticles.some((item) => item.id === id),
      );
    if (article.comparison) {
      const { caption, columns, rows } = article.comparison;
      assert.ok(caption && columns.length === 2 && rows.length > 0);
      assert.equal(new Set(rows.map((row) => row.label)).size, rows.length);
      for (const row of rows) {
        assert.ok(row.label && row.summary && row.detail);
        assert.ok(
          article.sources.includes(row.source),
          `${article.id}: ${row.source}`,
        );
      }
    }
  }
});

test("reference discovery combines vocabulary, aliases, and explanatory text", () => {
  assert.equal(searchReference("layers microscopic")[0].id, "cortical-layers");
  assert.equal(searchReference("EPSP")[0].id, "synapses");
  assert.equal(searchReference("sagittal")[0].id, "section-planes");
  assert.equal(searchReference("RNA taxonomy")[0].id, "cell-diversity");
  assert.equal(searchReference("myelin impossible-term").length, 0);
  assert.equal(searchReference("   ").length, referenceArticles.length);
  assert.equal(searchReference("BBB endothelial")[0].id, "brain-barriers");
  assert.equal(searchReference("CSF aqueduct")[0].id, "csf-circulation");
  assert.equal(searchReference("MCA")[0].id, "arterial-supply");
  assert.equal(searchReference("CN VIII")[0].id, "cranial-nerves");
  assert.equal(searchReference("parotid")[0].id, "cranial-nerves");
  assert.equal(
    searchReference("medulla pyramids")[0].id,
    "brainstem-organization",
  );
  assert.equal(
    searchReference("flocculonodular lobes")[0].id,
    "cerebellum-organization",
  );
  assert.equal(
    searchReference("climbing parallel")[0].id,
    "cerebellar-circuit",
  );
});

test("cranial-nerve comparison covers I–XII in order with sources and explicit missing geometry", () => {
  const article = referenceArticles.find(
    (item) => item.id === "cranial-nerves",
  );
  assert.deepEqual(
    article.comparison.rows.map((row) => row.label.split(" · ")[0]),
    ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"],
  );
  assert.match(article.scope, /no individual cranial-nerve/);
  assert.match(article.comparison.rows[10].detail, /cervical/);
  assert.deepEqual(article.regions, ["aseg-16"]);
});

test("compact topic index stays synchronized with the lazy catalogue", () => {
  assert.deepEqual(
    regionReferenceTopics,
    buildReferenceTopics(catalogue.articles),
    "Run node scripts/build_reference_topics.mjs after editing reference titles, model links, or reading scopes",
  );
  for (const topic of regionReferenceTopics) {
    const article = referenceArticles.find((item) => item.id === topic.id);
    assert.equal(article?.title, topic.title);
    assert.ok(topic.context === undefined || topic.context === "all");
    const scope = topic.reading;
    if (!scope) continue;
    assert.ok(scope.label && Number.isFinite(scope.priority));
    assert.ok(
      [scope.ids, scope.keys, scope.groups].some((items) => items?.length),
    );
    for (const [selector, field] of [
      ["ids", "id"],
      ["keys", "key"],
      ["groups", "group"],
    ]) {
      for (const value of scope[selector] ?? [])
        assert.ok(
          atlas.parts.some((region) => region[field] === value),
          `${topic.id}: ${value}`,
        );
    }
  }
});

test("every mesh offers bounded reading suggestions with explicit context", () => {
  for (const region of atlas.parts) {
    const topics = referenceTopicsForRegion(region);
    assert.ok(topics.length >= 2 && topics.length <= 3, region.id);
    assert.equal(new Set(topics.map((topic) => topic.id)).size, topics.length);
    assert.ok(topics.every((topic) => topic.reading.label));
    assert.ok(topics.every((topic) => referenceKeepsRegion(region, topic.id)));
  }
  const suggested = (id) =>
    referenceTopicsForRegion(
      atlas.parts.find((region) => region.id === id),
    ).map((topic) => topic.id);
  assert.deepEqual(suggested("aseg-16"), [
    "brainstem-organization",
    "cranial-nerves",
  ]);
  assert.deepEqual(suggested("aseg-7"), [
    "cerebellum-organization",
    "cerebellar-circuit",
    "myelin",
  ]);
  assert.deepEqual(suggested("aseg-17"), [
    "neurons",
    "gray-white-matter",
    "atlas-boundaries",
  ]);
  assert.deepEqual(suggested("aseg-31"), [
    "csf-circulation",
    "brain-barriers",
    "section-planes",
  ]);
  assert.deepEqual(suggested("lh-parsopercularis"), [
    "functional-names",
    "cortical-layers",
    "folds",
  ]);
  assert.deepEqual(suggested("rh-parsopercularis"), [
    "cortical-layers",
    "folds",
  ]);
});

test("reference context retains explicit model links and guide returns while rejecting unrelated highlights", () => {
  for (const article of referenceArticles) {
    for (const id of article.regions) {
      const region = atlas.parts.find((region) => region.id === id);
      assert.equal(
        referenceKeepsRegion(region, article.id),
        true,
        `${article.id}: ${id}`,
      );
    }
  }
  const brainstem = atlas.parts.find((region) => region.id === "aseg-16");
  const hippocampus = atlas.parts.find((region) => region.id === "aseg-17");
  assert.equal(referenceKeepsRegion(brainstem, "cortical-layers"), false);
  assert.equal(referenceKeepsRegion(hippocampus, "brain-barriers"), false);
  assert.equal(
    referenceKeepsRegion(hippocampus, "brain-barriers", "brain-barriers"),
    true,
  );
  assert.equal(referenceKeepsRegion(brainstem, null), true);
  assert.equal(referenceKeepsRegion(brainstem, "atlas-boundaries"), true);
  assert.equal(
    referenceKeepsRegion(brainstem, "missing-note", "missing-note"),
    false,
  );
});

test("reference explorations resolve to retained specimen films, real paths, and valid MRI views", () => {
  for (const article of referenceArticles) {
    for (const link of referenceExplorations(article)) {
      assert.ok(link.note && link.title && link.label);
      if (link.kind === "video") {
        assert.equal(link.external, true);
        assert.equal(
          link.href,
          dissectionVideos.find((video) => video.id === link.id).url,
        );
        assert.equal(new URL(link.href).protocol, "https:");
      } else {
        assert.equal(link.external, false);
        assert.equal(referenceOrigin(link.href), article.id);
        const params = new URLSearchParams(link.href.slice(1));
        if (link.kind === "path") {
          assert.ok(
            learningPaths.some((path) => path.id === params.get("path")),
          );
          assert.equal(params.get("step"), "1");
        } else {
          assert.equal(params.get("view"), "scans");
          assert.ok(["t1", "t2", "pd"].includes(params.get("scan")));
        }
      }
    }
  }
});

test("article return context survives shared exploration links and rejects malformed origins", () => {
  for (const hash of [
    "#region=aseg-14",
    "#path=csf&step=2",
    "#view=scans&scan=t2",
  ]) {
    const shared = withReferenceOrigin(hash, "csf-circulation");
    assert.equal(referenceOrigin(shared), "csf-circulation");
    assert.equal(referenceOrigin(withReferenceOrigin(shared, null)), null);
    assert.equal(
      referenceOrigin(withReferenceOrigin(shared, "meninges")),
      "meninges",
    );
  }
  for (const hash of [
    "#reference=csf-circulation&from=meninges",
    "#from=meninges",
    "#region=aseg-14&from=%3Cscript%3E",
    `#view=scans&from=${"a".repeat(81)}`,
  ])
    assert.equal(referenceOrigin(hash), null);
});
