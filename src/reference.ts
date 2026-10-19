import catalogue from "./reference-data.json" with { type: "json" };
import { learningPaths, learningHash } from "./learning.ts";
import { dissectionVideos, videoProviders } from "./videos.ts";
import { withReferenceOrigin } from "./reference-navigation.ts";

export type ReferenceExploration = {
  kind: "path" | "scan" | "video";
  id: string;
  note: string;
};

export type ReferenceArticle = {
  id: string;
  title: string;
  category: string;
  summary: string;
  aliases: string[];
  paragraphs: string[];
  scope: string;
  regions: string[];
  related: string[];
  sources: string[];
  explorations?: ReferenceExploration[];
  comparison?: {
    caption: string;
    columns: [string, string];
    rows: {
      label: string;
      summary: string;
      detail: string;
      source: string;
    }[];
  };
};
export const referenceArticles = catalogue.articles as ReferenceArticle[];
export const referenceSources: Record<
  string,
  { title: string; url: string; kind: string }
> = catalogue.sources;
export const referenceCheckedOn = catalogue.checkedOn;
const searchIndex = referenceArticles.map((article) => ({
  article,
  text: [
    article.title,
    article.category,
    article.summary,
    ...article.aliases,
    ...article.paragraphs,
    ...(article.comparison?.rows.flatMap((row) => [
      row.label,
      row.summary,
      row.detail,
    ]) ?? []),
  ]
    .join(" ")
    .toLowerCase(),
}));
export function searchReference(query: string) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return searchIndex
    .filter(({ text }) => terms.every((term) => text.includes(term)))
    .map(({ article }) => article);
}

export function referenceExplorations(article: ReferenceArticle) {
  return (article.explorations ?? []).map((item) => {
    if (item.kind === "video") {
      const video = dissectionVideos.find((video) => video.id === item.id)!;
      return {
        ...item,
        title: video.title,
        label: `Specimen film · ${videoProviders[video.provider].name}`,
        href: video.url,
        external: true,
      };
    }
    if (item.kind === "path") {
      const path = learningPaths.find((path) => path.id === item.id)!;
      return {
        ...item,
        title: path.title,
        label: `Guided path · ${path.steps.length} stops`,
        href: withReferenceOrigin(learningHash(path, 0), article.id),
        external: false,
      };
    }
    return {
      ...item,
      title: `Structural MRI · ${item.id.toUpperCase()}`,
      label: "Linked MRI slices",
      href: withReferenceOrigin(`#view=scans&scan=${item.id}`, article.id),
      external: false,
    };
  });
}
