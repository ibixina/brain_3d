import assert from "node:assert/strict";
import test from "node:test";
import {
  captureReadingPosition,
  ReferenceReadingMemory,
  restoreReadingOffset,
} from "../src/reference-reading.ts";

function browserStorage(value = null) {
  return {
    value,
    writes: 0,
    getItem() {
      return this.value;
    },
    setItem(key, value) {
      this.value = value;
      this.writes += 1;
    },
  };
}

test("reading anchors preserve a section after paragraphs reflow at a new width", () => {
  const saved = captureReadingPosition(
    840,
    [
      { id: "title", top: 20 },
      { id: "paragraph-0", top: 110 },
      { id: "row-7", top: 800 },
      { id: "row-8", top: 1000 },
    ],
    "row-source-7",
  );
  assert.equal(saved.anchorId, "row-7");
  assert.equal(saved.anchorOffset, 40);
  assert.equal(saved.focusId, "row-source-7");
  assert.equal(
    restoreReadingOffset(saved, [{ id: "row-7", top: 1400 }], 5000),
    1440,
  );
  assert.equal(
    restoreReadingOffset(saved, [{ id: "row-7", top: 1400 }], 1200),
    1200,
  );
  assert.equal(restoreReadingOffset(saved, [], 5000), 840);
  assert.equal(restoreReadingOffset(saved, [], -10), 0);
  assert.deepEqual(captureReadingPosition(-15, []), {
    scrollTop: 0,
    anchorId: null,
    anchorOffset: 0,
    focusId: null,
  });
});

test("independent articles and the filtered library survive a reload without a network or storage write per scroll", () => {
  const storage = browserStorage();
  const memory = new ReferenceReadingMemory(storage);
  const cranial = captureReadingPosition(
    2400,
    [{ id: "row-10", top: 2300 }],
    "region-aseg-16",
  );
  const csf = captureReadingPosition(
    700,
    [{ id: "explorations", top: 650 }],
    "explore-scan-t2",
  );
  memory.query = "cranial nerves";
  memory.set("cranial-nerves", cranial);
  memory.set("csf-circulation", csf);
  memory.set(
    "library",
    captureReadingPosition(200, [{ id: "note-cranial-nerves", top: 180 }]),
  );
  assert.equal(storage.writes, 0);
  memory.persist();
  const reloaded = new ReferenceReadingMemory(storage);
  assert.deepEqual(reloaded.get("cranial-nerves"), cranial);
  assert.deepEqual(reloaded.get("csf-circulation"), csf);
  assert.equal(reloaded.get("library").anchorId, "note-cranial-nerves");
  assert.equal(reloaded.query, "cranial nerves");
  const copy = reloaded.get("cranial-nerves");
  copy.scrollTop = 0;
  assert.equal(reloaded.get("cranial-nerves").scrollTop, 2400);
});

test("invalid persisted positions are ignored and blocked browser storage retains in-memory reading", () => {
  const good = captureReadingPosition(100, [{ id: "paragraph-0", top: 60 }]);
  const storage = browserStorage(
    JSON.stringify({
      version: 1,
      query: 3,
      positions: [
        ["brainstem-organization", good],
        ["negative", { ...good, scrollTop: -1 }],
        ["not-finite", { ...good, anchorOffset: null }],
        ["bad-id", { ...good, focusId: "<script>" }],
        ["too-large", { ...good, scrollTop: 1e8 }],
        ["missing-fields", {}],
      ],
    }),
  );
  const memory = new ReferenceReadingMemory(storage);
  assert.deepEqual(memory.get("brainstem-organization"), good);
  memory.set("clean-copy", { ...good, obsolete: { payload: "discard" } });
  assert.deepEqual(memory.get("clean-copy"), good);
  for (const id of [
    "negative",
    "not-finite",
    "bad-id",
    "too-large",
    "missing-fields",
  ])
    assert.equal(memory.get(id), undefined);
  assert.equal(memory.query, "");
  for (const value of [
    "{broken",
    JSON.stringify({ version: 2, positions: [] }),
  ])
    assert.equal(
      new ReferenceReadingMemory(browserStorage(value)).get(
        "brainstem-organization",
      ),
      undefined,
    );
  const blocked = new ReferenceReadingMemory({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("full");
    },
  });
  blocked.set("cranial-nerves", good);
  assert.doesNotThrow(() => blocked.persist());
  assert.deepEqual(blocked.get("cranial-nerves"), good);
});

test("reading history is bounded and preserves recently revisited notes and publisher-link identifiers", () => {
  const storage = browserStorage();
  const memory = new ReferenceReadingMemory(storage);
  const position = captureReadingPosition(50, [], "explore-video-_JXb_lGgaQQ");
  for (let i = 0; i < 32; i++) memory.set(`note-${i}`, position);
  memory.set("note-0", position);
  memory.set("new-note", position);
  assert.equal(memory.get("note-1"), undefined);
  assert.deepEqual(memory.get("note-0"), position);
  memory.query = "x".repeat(1000);
  memory.persist();
  const saved = JSON.parse(storage.value);
  assert.equal(saved.positions.length, 32);
  assert.equal(saved.query.length, 160);
  const reloaded = new ReferenceReadingMemory(storage);
  assert.equal(reloaded.get("new-note").focusId, "explore-video-_JXb_lGgaQQ");
});
