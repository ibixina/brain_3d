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
} from "../src/reference.ts";
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
  }
});

test("reference discovery combines vocabulary, aliases, and explanatory text", () => {
  assert.equal(searchReference("layers microscopic")[0].id, "cortical-layers");
  assert.equal(searchReference("EPSP")[0].id, "synapses");
  assert.equal(searchReference("sagittal")[0].id, "section-planes");
  assert.equal(searchReference("RNA taxonomy")[0].id, "cell-diversity");
  assert.equal(searchReference("myelin impossible-term").length, 0);
  assert.equal(searchReference("   ").length, referenceArticles.length);
});
