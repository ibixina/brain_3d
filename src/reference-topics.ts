import type { Region } from "./data.ts";
import index from "./reference-topic-index.json" with { type: "json" };

type ReadingScope = {
  ids?: string[];
  keys?: string[];
  groups?: string[];
  label: string;
  priority: number;
};
type ReferenceTopic = {
  id: string;
  title: string;
  regions: string[];
  context?: "all";
  reading?: ReadingScope;
};
type RegionContext = Pick<Region, "id" | "key" | "group">;
export const regionReferenceTopics = index as ReferenceTopic[];

function matchesReading(region: RegionContext, reading?: ReadingScope) {
  return !!(
    reading?.ids?.includes(region.id) ||
    reading?.keys?.includes(region.key) ||
    reading?.groups?.includes(region.group)
  );
}

export function referenceTopicsForRegion(region: RegionContext) {
  return regionReferenceTopics
    .filter((topic) => matchesReading(region, topic.reading))
    .sort((a, b) => a.reading!.priority - b.reading!.priority)
    .slice(0, 3);
}

export function referenceKeepsRegion(
  region: RegionContext,
  articleId: string | null,
  origin: string | null = null,
) {
  if (!articleId) return true;
  const topic = regionReferenceTopics.find((item) => item.id === articleId);
  return !!(
    topic &&
    (topic.context === "all" ||
      articleId === origin ||
      topic.regions.includes(region.id) ||
      matchesReading(region, topic.reading))
  );
}
