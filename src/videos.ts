import catalogue from "./video-data.json" with { type: "json" };
import type { Region } from "./data";

export type DissectionVideo = {
  id: string;
  title: string;
  provider: string;
  minutes: number | null;
  description: string;
  topics: string[];
  focusKeys: string[];
  systemKeys: string[];
  contextGroups: string[];
  contextKeys: string[];
  priority: number;
  format: string;
  general: boolean;
  metadataTitle: string;
  channel: string;
  url: string;
  metadataCheckedOn?: string;
};
export type VideoMatch = {
  video: DissectionVideo;
  relevance: "structure" | "system" | "context";
};
export const videoProviders: Record<
  string,
  { name: string; collection: string; presenter: string; sourceUrl: string }
> = catalogue.providers;
export const dissectionVideos: DissectionVideo[] = catalogue.videos;
export const videoCheckDate = catalogue.checkedOn;
export const videoCheckDates = [
  ...new Set(
    dissectionVideos.map((video) => video.metadataCheckedOn ?? videoCheckDate),
  ),
].sort();
export const videoTopics = [
  "Orientation",
  "Cortex",
  "Deep structures",
  "Memory & limbic",
  "Brainstem",
  "Cerebellum",
  "Ventricles & CSF",
  "White matter",
];
export const relevanceLabel = {
  structure: "Structure focus",
  system: "System focus",
  context: "Broader context",
};

export function videosForRegion(
  region: Pick<Region, "key" | "group">,
): VideoMatch[] {
  const matches: VideoMatch[] = [];
  for (const video of dissectionVideos) {
    const relevance = video.focusKeys.includes(region.key)
      ? "structure"
      : video.systemKeys.includes(region.key)
        ? "system"
        : video.contextKeys.includes(region.key) ||
            video.contextGroups.includes(region.group)
          ? "context"
          : null;
    if (relevance) matches.push({ video, relevance });
  }
  const rank = { structure: 3, system: 2, context: 1 };
  matches.sort(
    (a, b) =>
      rank[b.relevance] - rank[a.relevance] ||
      b.video.priority - a.video.priority,
  );
  const focused = matches.filter((match) => match.relevance !== "context");
  if (focused.length) return focused.slice(0, 4);
  const specificContext = matches.filter((match) =>
    match.video.contextKeys.includes(region.key),
  );
  if (specificContext.length) return specificContext.slice(0, 3);
  const context = matches.filter((match) => !match.video.general);
  return (context.length ? context : matches).slice(0, 3);
}

export function filterVideos({
  query = "",
  topic = "all",
  provider = "all",
}: {
  query?: string;
  topic?: string;
  provider?: string;
} = {}): DissectionVideo[] {
  const normalize = (text: string) =>
    text.toLowerCase().replaceAll("-", " ").replace(/\s+/g, " ").trim();
  const search = normalize(query);
  return dissectionVideos.filter(
    (video) =>
      (topic === "all" || video.topics.includes(topic)) &&
      (provider === "all" || video.provider === provider) &&
      (!search ||
        normalize(
          `${video.title} ${video.description} ${video.topics.join(" ")} ${video.focusKeys.join(" ")} ${video.systemKeys.join(" ")} ${video.contextKeys.join(" ")} ${videoProviders[video.provider].name}`,
        ).includes(search)),
  );
}

export function regionVideoNote(region: Pick<Region, "key" | "group">): string {
  if (region.key === "ventral-diencephalon")
    return "Ventral diencephalon is a composite imaging label. The hypothalamus lessons cover part of its anatomical context, rather than the whole segmentation.";
  if (region.key.startsWith("corpus-callosum-"))
    return "The fiber tract lessons provide broader callosal context. They do not isolate this geometric atlas segment.";
  if (region.key === "choroid-plexus")
    return "Start with the ventricular-system lesson for CSF and choroid plexus context; this is not a dedicated plexus dissection.";
  if (
    [
      "Frontal",
      "Parietal",
      "Temporal",
      "Occipital",
      "Limbic",
      "Insula",
    ].includes(region.group)
  )
    return "These lessons cover the surrounding cortex or functional system. A dedicated demonstration of this exact atlas parcel has not been verified.";
  return "Match labels describe the lesson’s scope. Specimens may show a different hemisphere or section plane from the model.";
}
