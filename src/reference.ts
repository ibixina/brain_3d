import catalogue from "./reference-data.json" with { type: "json" };

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
};
export const referenceArticles: ReferenceArticle[] = catalogue.articles;
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
