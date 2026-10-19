import { useEffect, useState } from "react";
import { assetUrl } from "../asset-url.ts";
import { subregionName, type SubregionKind, type SubregionName } from "../subregions.ts";
import { probabilityPercent, type ProbabilityEvidence } from "../subregion-evidence.ts";

const binLabels = ["Below 25%", "25–<50%", "50–<75%", "75–100%"];

export default function ProbabilityEvidencePanel({ kind, part }: {
  kind: SubregionKind;
  part: SubregionName;
}) {
  const [data, setData] = useState<ProbabilityEvidence | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const url = assetUrl(`/subregions/${kind}-evidence.json`);
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    void fetch(url, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Evidence unavailable");
        return response.json() as Promise<ProbabilityEvidence>;
      })
      .then((result) => {
        if (result.version !== 1 || result.kind !== kind || !result.entries)
          throw new Error("Evidence version mismatch");
        if (!controller.signal.aborted) setData(result);
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError("The source probability summary could not load.");
      });
    return () => controller.abort();
  }, [url, kind, attempt]);

  if (error) return (
    <div role="alert">
      <p>{error}</p>
      <button onClick={() => setAttempt((value) => value + 1)}>Retry evidence</button>
    </div>
  );
  if (!data) return <p role="status">Loading source probabilities…</p>;
  const entry = Object.hasOwn(data.entries, part.id) ? data.entries[part.id] : null;
  if (!entry) return <p>No probability summary is available for this label.</p>;
  const other = entry.peak.strongestOther;
  const belowHalf = entry.winningProbabilityBins[0] + entry.winningProbabilityBins[1];
  return (
    <section className="probability-evidence" aria-label={`${subregionName(part)} probability evidence`}>
      <h4>{subregionName(part)}</h4>
      <p>
        <strong>{entry.voxels.toLocaleString()} winning voxels.</strong>{" "}
        {entry.voxels
          ? "A winner has the largest label probability at a voxel, including competition from background. It need not exceed 50%."
          : "No surface is created for this label. This does not establish that the anatomy is absent."}
      </p>
      {entry.voxels > 0 && (
        <>
          <h5>Probabilities within this winning mask</h5>
          <ul className="probability-bins" aria-label="Winning voxel probability distribution">
            {entry.winningProbabilityBins.map((count, index) => (
              <li key={binLabels[index]}>
                <div>
                  <span>{binLabels[index]}</span>
                  <span>{count.toLocaleString()} · {probabilityPercent(count / entry.voxels)}</span>
                </div>
                <div className="probability-track" aria-hidden="true">
                  <i style={{ width: `${count / entry.voxels * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p>{belowHalf.toLocaleString()} of these {entry.voxels.toLocaleString()} voxels have label probability below 50%. Counts describe a derived mask, not neurons or full anatomical extent.</p>
        </>
      )}
      <h5>At this label’s highest-probability voxel</h5>
      <p>Peak over the full source grid, including voxels won by other labels.</p>
      <div className="probability-sample">
        {[
          { name: "This label", value: entry.peak.probability },
          { name: `Strongest other: ${other.sourceName} · ${other.label}`, value: other.probability },
        ].map((sample) => (
          <div key={sample.name}>
            <p><span>{sample.name}</span><strong>{probabilityPercent(sample.value)}</strong></p>
            <div className="probability-track" aria-hidden="true">
              <i style={{ width: `${Math.max(0, Math.min(1, sample.value)) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p>
        {entry.peak.selectedWins ? "This label wins at this sample." : "Another label wins at this sample."}{" "}
        This one voxel illustrates competition; its peak is not an accuracy score.
      </p>
      <p>These are template label probabilities, not MRI intensities, brain activity, or confidence in an individual’s anatomy. Percentages are rounded.</p>
      <details className="probability-method">
        <summary>Sample coordinates & method</summary>
        <p>Original voxel index (zero-based): {entry.peak.index.join(", ")}. Source RAS millimeters: {entry.peak.rasMm.map((value) => value.toFixed(2)).join(", ")}. This is the source grid, not the recentered 3D display or a location on the bundled MRI scans.</p>
        <p>Every source channel competes, including background and structures excluded from display. Ties use source channel order. Peak sampling chooses the first maximum in voxel array order. The 0.5 surface boundary is applied to a binary winning mask; it is not a 50% probability threshold. No source probabilities are resampled or renormalized.</p>
        <p>Modified FreeSurfer data · The General Hospital Corporation (MGH). Checked {data.checkedOn}.</p>
        <a href={data.source.documentation} target="_blank" rel="noreferrer">Original probability data ↗</a>
        <a href={data.source.paper} target="_blank" rel="noreferrer">Original atlas study ↗</a>
        <a href={url} target="_blank" rel="noreferrer">Derived evidence & provenance (JSON) ↗</a>
        <a href={assetUrl(data.source.manifest)} target="_blank" rel="noreferrer">Source geometry provenance ↗</a>
        <a href={assetUrl(data.source.license)} target="_blank" rel="noreferrer">FreeSurfer data license ↗</a>
      </details>
    </section>
  );
}
