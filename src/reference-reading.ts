export type ReadingAnchor = { id: string; top: number };
export type ReadingPosition = {
  scrollTop: number;
  anchorId: string | null;
  anchorOffset: number;
  focusId: string | null;
};

const storageKey = "cerebra-reference-reading-v1";
const maxPositions = 32;
const validId = (id: unknown): id is string =>
  typeof id === "string" && /^[a-z][A-Za-z0-9_-]{0,119}$/.test(id);
const validOffset = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 1e7;

function validPosition(value: unknown): value is ReadingPosition {
  if (!value || typeof value !== "object") return false;
  const position = value as ReadingPosition;
  return (
    validOffset(position.scrollTop) &&
    validOffset(position.anchorOffset) &&
    (position.anchorId === null || validId(position.anchorId)) &&
    (position.focusId === null || validId(position.focusId))
  );
}

export function captureReadingPosition(
  scrollTop: number,
  anchors: ReadingAnchor[],
  focusId: string | null = null,
): ReadingPosition {
  const top = Math.max(0, scrollTop);
  let anchor: ReadingAnchor | undefined;
  for (const item of anchors)
    if (item.top <= top + 1 && (!anchor || item.top >= anchor.top))
      anchor = item;
  return {
    scrollTop: top,
    anchorId: anchor?.id ?? null,
    anchorOffset: anchor ? Math.max(0, top - anchor.top) : 0,
    focusId,
  };
}

export function restoreReadingOffset(
  position: ReadingPosition,
  anchors: ReadingAnchor[],
  maxScroll: number,
) {
  const anchor = anchors.find((item) => item.id === position.anchorId);
  const top = anchor ? anchor.top + position.anchorOffset : position.scrollTop;
  return Math.max(0, Math.min(top, Math.max(0, maxScroll)));
}

type ReadingStorage = Pick<Storage, "getItem" | "setItem">;
function sessionStorageIfAvailable(): ReadingStorage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

export class ReferenceReadingMemory {
  private positions = new Map<string, ReadingPosition>();
  private storage: ReadingStorage | undefined;
  query = "";

  constructor(storage = sessionStorageIfAvailable()) {
    this.storage = storage;
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) ?? "null");
      if (saved?.version !== 1) return;
      if (typeof saved.query === "string")
        this.query = saved.query.slice(0, 160);
      if (!Array.isArray(saved.positions)) return;
      for (const entry of saved.positions.slice(-maxPositions))
        if (
          Array.isArray(entry) &&
          validId(entry[0]) &&
          validPosition(entry[1])
        )
          this.set(entry[0], entry[1]);
    } catch {
      // Reading remains available when browser storage is blocked or malformed.
    }
  }

  get(id: string) {
    const position = this.positions.get(id);
    return position ? { ...position } : undefined;
  }

  set(id: string, position: ReadingPosition) {
    if (!validId(id) || !validPosition(position)) return;
    this.positions.delete(id);
    const { scrollTop, anchorId, anchorOffset, focusId } = position;
    this.positions.set(id, { scrollTop, anchorId, anchorOffset, focusId });
    if (this.positions.size > maxPositions)
      this.positions.delete(this.positions.keys().next().value!);
  }

  persist() {
    try {
      this.storage?.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          query: this.query.slice(0, 160),
          positions: [...this.positions],
        }),
      );
    } catch {
      // The in-memory positions still work without persistence.
    }
  }
}
