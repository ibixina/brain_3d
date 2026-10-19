export type ProbabilitySample = {
  channel: number;
  label: number;
  voxels: number;
  winningProbabilityBins: number[];
  winningProbabilityRange: number[] | null;
  peak: {
    probability: number;
    index: number[];
    rasMm: number[];
    selectedWins: boolean;
    winnerChannel: number;
    strongestOther: {
      channel: number;
      label: number;
      sourceName: string;
      probability: number;
    };
  };
};

export type ProbabilityEvidence = {
  version: number;
  kind: string;
  checkedOn: string;
  binEdges: number[];
  method: string;
  source: {
    documentation: string;
    paper: string;
    license: string;
    manifest: string;
  };
  entries: Record<string, ProbabilitySample>;
};

export function probabilityPercent(value: number) {
  if (value <= 0) return "0.0%";
  return value < 0.001
    ? "<0.1%"
    : `${(value * 100).toFixed(1)}%`;
}
