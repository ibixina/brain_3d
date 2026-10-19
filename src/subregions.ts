import type { ViewerRegion } from "./viewer";
import type { ThalamicGuide } from "./thalamus-guide.ts";

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
export type Subregion = ViewerRegion & SubregionName & {
  voxels: number;
  voxelConnectedComponents6?: number;
};
export type SubregionAtlas = {
  guide?: ThalamicGuide;
  boundaries?: {
    checkedOn: string;
    source: string;
    sourceTitle: string;
    note: string;
    labels: Record<string, { text: string; neighbors: string[] }>;
    readingScope: string;
    reading: { id: string; label: string }[];
  };
  title: string;
  checkedOn: string;
  parts: Subregion[];
  omitted?: SubregionName[];
  compressedUrl: string;
  rawUrl: string;
  assets?: {
    hemisphere: string;
    compressedUrl: string;
    rawUrl: string;
    geometry: { compressedBytes: number };
  }[];
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

export function boundaryNeighbors(parts: SubregionName[], selected: SubregionName, keys: string[]) {
  return keys.flatMap((key) => {
    const part = parts.find((item) =>
      item.key === key && item.hemisphere === selected.hemisphere && item.id !== selected.id,
    );
    return part ? [part] : [];
  });
}

export const subregionCatalog = {
  brainstem: {
    name: "Brainstem",
    button: "Explore 4 subregions",
    detail: "Separate brainstem atlas model",
  },
  thalamus: {
    name: "Thalamic",
    button: "Explore atlas nuclei",
    detail: "Separate atlas · 23 surfaces per side",
  },
  amygdala: {
    name: "Amygdala",
    button: "Explore atlas nuclei",
    detail: "Separate atlas · 9 surfaces per side",
  },
  hippocampus: {
    name: "Hippocampal",
    button: "Explore atlas subregions",
    detail: "Separate atlas · 20 surfaces per side",
  },
};
export type SubregionKind = keyof typeof subregionCatalog;

const targets: Record<string, SubregionKind> = {
  "aseg-16": "brainstem",
  "aseg-10": "thalamus",
  "aseg-49": "thalamus",
  "aseg-18": "amygdala",
  "aseg-54": "amygdala",
  "aseg-17": "hippocampus",
  "aseg-53": "hippocampus",
};

export function subregionForRegion(id: string) {
  return Object.hasOwn(targets, id) ? targets[id] : null;
}

export function isSubregionKind(value: string | null): value is SubregionKind {
  return value !== null && Object.hasOwn(subregionCatalog, value);
}

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
