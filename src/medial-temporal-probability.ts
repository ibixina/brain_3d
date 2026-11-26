import type { Grid, Point3 } from "./imaging.ts";
import type { ProbabilityAsset } from "./probability-slices.ts";

export type MedialTemporalAtlasKind = "hippocampus" | "amygdala";

export const medialTemporalProbabilityUrls: Record<MedialTemporalAtlasKind, string> = {
  hippocampus: "/subregions/hippocampus-probability/manifest.json",
  amygdala: "/subregions/amygdala-probability/manifest.json",
};

export type MedialTemporalProbabilityManifest = {
  version: number;
  kind: MedialTemporalAtlasKind;
  checkedOn: string;
  grids: Record<"left" | "right", Grid>;
  encoding: {
    dtype: string;
    byteOrder: string;
    order: string;
    slope: number;
    intercept: number;
    displayRange: number[];
    sourceRange: number[];
  };
  context: {
    asset: ProbabilityAsset;
    dtype: string;
    method: string;
  };
  categories: { channel: number; label: number; sourceName: string; structure: string }[];
  entries: Record<string, {
    channel: number;
    label: number;
    sourceName: string;
    asset: ProbabilityAsset;
    positiveVoxels: number;
    categoricalVoxels: number;
    peak: {
      index: Point3;
      probability: number;
      rasMm: Point3;
      selectedWins: boolean;
      winnerChannel: number;
      winnerSourceName: string;
    };
  }>;
  source: {
    archiveSha256: string;
    niftiSha256: Record<"left" | "right", string>;
    probabilityArraySha256: string;
    documentation: string;
    paper: string;
    protocol: string;
    license: string;
  };
  method: string;
  interpretation: string;
};
