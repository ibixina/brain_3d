import type { ViewerRegion } from "./viewer";

export type SubregionName = {
  id: string;
  key: string;
  name: string;
  hemisphere: string;
  group: string;
  description: string;
  abbreviation?: string;
  sourceName?: string;
  aliases?: string[];
};
export type Subregion = ViewerRegion & SubregionName;
export type SubregionAtlas = {
  title: string;
  checkedOn: string;
  parts: Subregion[];
  omitted?: SubregionName[];
  compressedUrl: string;
  rawUrl: string;
  source: {
    documentation: string;
    protocol: string;
    paper: string;
    labelDefinitions?: string;
    license: string;
    spacingMm: number[];
  };
  geometry: { compressedBytes: number };
};
export type SubregionKind = "brainstem" | "thalamus";

export function matchingSubregions<T extends SubregionName>(
  parts: T[],
  query: string,
  hemisphere: string,
): T[] {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return parts.filter(
    (part) =>
      (hemisphere === "both" ||
        part.hemisphere === hemisphere ||
        part.hemisphere === "midline" ||
        part.hemisphere === "bilateral") &&
      words.every((word) =>
        `${part.name} ${part.key} ${part.abbreviation ?? ""} ${part.sourceName ?? ""} ${part.group} ${part.hemisphere} ${(part.aliases ?? []).join(" ")}`
          .toLowerCase()
          .includes(word),
      ),
  );
}

export function subregionName(part: SubregionName) {
  const side =
    part.hemisphere === "left"
      ? "Left "
      : part.hemisphere === "right"
        ? "Right "
        : "";
  return `${side}${part.name}${part.abbreviation ? ` · ${part.abbreviation}` : ""}`;
}
