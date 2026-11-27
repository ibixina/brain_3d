import { useEffect, useState } from "react";
import { ArrowUpRight, BookOpen, LoaderCircle, RotateCcw } from "lucide-react";
import { assetUrl } from "../asset-url";
import { planes, voxelIndex, worldPoint, type Point3 } from "../imaging";
import { loadProbabilityBytes } from "../probability-slices";
import { learningHash, learningPaths, learningSources } from "../learning";
import { type XtractEntry, type XtractManifest, xtractGuideContexts } from "../tractography";
import XtractSlice from "./XtractSlice";
import "./xtract.css";

const manifestUrl = "/tractography/xtract/manifest.json";

export default function XtractWorkspace({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [manifest, setManifest] = useState<XtractManifest | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setManifest(null);
    void fetch(assetUrl(manifestUrl), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Pathway catalogue unavailable");
        const value = await response.json() as XtractManifest;
        if (value.version !== 1 || value.channels.length !== 42 ||
          value.grid.shape.join() !== "97,115,97" || value.grid.spacing.join() !== "2,2,2" ||
          value.encoding.dtype !== "uint16" || value.encoding.scale !== 65535)
          throw new Error("Unexpected Xtract atlas manifest");
        setManifest(value);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (manifest && !manifest.channels.some((channel) => channel.id === selectedId))
      onSelect(manifest.channels[0].id);
  }, [manifest, selectedId, onSelect]);

  if (error) return <section className="xtract-workspace" role="alert">
    <p>The source pathway atlas could not load.</p>
    <button onClick={() => setAttempt((value) => value + 1)}>Retry atlas</button>
  </section>;
  if (!manifest) return <div className="xtract-workspace" role="status"><LoaderCircle className="spin" size={22} /> Loading the on-demand pathway catalogue…</div>;
  const entry = manifest.channels.find((channel) => channel.id === selectedId) ?? manifest.channels[0];
  return <LoadedXtract key={entry.id} entry={entry} manifest={manifest} onSelect={onSelect} />;
}

function LoadedXtract({
  entry,
  manifest,
  onSelect,
}: {
  entry: XtractEntry;
  manifest: XtractManifest;
  onSelect: (id: string) => void;
}) {
  const [values, setValues] = useState<Uint16Array | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [point, setPoint] = useState<Point3>(entry.peak.index);
  const [minimumPercent, setMinimumPercent] = useState(
    manifest.encoding.displayThresholdDefaultPercent,
  );

  useEffect(() => {
    const controller = new AbortController();
    setValues(null);
    setError(false);
    void loadProbabilityBytes(entry.asset, controller.signal)
      .then(async (bytes) => {
        if (bytes.byteLength !== entry.asset.rawBytes || bytes.byteLength % 2)
          throw new Error("Incomplete pathway map");
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        const actualHash = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
        if (actualHash !== entry.asset.sha256) throw new Error("Pathway map checksum mismatch");
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const decoded = new Uint16Array(bytes.byteLength / 2);
        for (let i = 0; i < decoded.length; i++) decoded[i] = view.getUint16(i * 2, true);
        if (!controller.signal.aborted) setValues(decoded);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [entry, attempt]);

  useEffect(() => setPoint(entry.peak.index), [entry]);
  const sampledValue = values
    ? values[voxelIndex(point, manifest.grid.shape)] / manifest.encoding.scale * 100
    : 0;
  const coordinates = worldPoint(point, manifest.grid);
  const guideContext = xtractGuideContexts[entry.id];
  const relatedPath = guideContext && learningPaths.find((path) => path.id === guideContext.path);
  const relatedStep = guideContext?.step;
  const relatedStop = relatedPath && relatedStep !== undefined ? relatedPath.steps[relatedStep] : undefined;
  const relatedSource = relatedStop && learningSources[relatedStop.source];

  return (
    <section className="xtract-workspace" aria-label="Xtract white-matter pathway maps">
      <header className="xtract-heading">
        <p>Population pathway overlap from diffusion-MRI tractography · Source MNI152 grid</p>
        <label>
          <span>Choose a pathway</span>
          <select value={entry.id} onChange={(event) => onSelect(event.target.value)}>
            {manifest.channels.map((channel) => (
              <option key={channel.id} value={channel.id}>{channel.name}</option>
            ))}
          </select>
        </label>
      </header>

      <div className="xtract-slice-grid">
        {values ? planes.map((plane) => (
          <XtractSlice
            key={plane}
            plane={plane}
            point={point}
            onPoint={setPoint}
            grid={manifest.grid}
            values={values}
            minimumPercent={minimumPercent}
            scale={manifest.encoding.scale}
          />
        )) : <div className="xtract-loading" role={error ? "alert" : "status"}>
          {error ? <><p>The selected pathway map could not load.</p><button onClick={() => setAttempt((value) => value + 1)}>Retry map</button></> : <><LoaderCircle className="spin" size={20} /><span>Loading {entry.name} only…</span></>}
        </div>}
      </div>

      {values && (
        <div className="xtract-controls">
          <label>
            <span>Minimum display overlap <strong>{minimumPercent}%</strong></span>
            <input
              aria-label="Minimum pathway overlap"
              type="range"
              min={0}
              max={50}
              step={1}
              value={minimumPercent}
              onChange={(event) => setMinimumPercent(Number(event.target.value))}
            />
          </label>
          <p>
            At crosshair: <strong>{sampledValue.toFixed(2)}%</strong> · {coordinates[0]}, {coordinates[1]}, {coordinates[2]} mm (MNI152)
            <button onClick={() => setPoint(entry.peak.index)}><RotateCcw size={12} /> Highest overlap</button>
          </p>
          <div className="xtract-legend" aria-label="Pathway overlap legend">
            <span>low overlap</span><i /><span>high overlap</span>
          </div>
        </div>
      )}

      {relatedStop && relatedPath && relatedSource && relatedStep !== undefined && (
        <aside className="xtract-related" aria-label="Related three-dimensional anatomy">
          <div>
            <span className="eyebrow">RELATED 3D CONTEXT</span>
            <p>
              {entry.id === "fma" || entry.id === "fmi"
                ? <>A primary diffusion-MRI study labels forceps major with the splenium and forceps minor with the genu. The guide opens the nearby <strong>{relatedStop.title.toLowerCase()}</strong> mesh. FreeSurfer divides the callosum by geometric distance; this Xtract probability map is not registered to or projected onto that surface.</>
                : <>This curated link pairs the pathway with a related topic in the guided tour: <strong>{relatedStop.title.toLowerCase()}</strong>. That stop shows its existing labeled region; it does not contain or trace the selected tract. The two resources use separate atlases and are not spatially registered.</>}
            </p>
            <div className="xtract-related-sources">
              {entry.id === "fma" || entry.id === "fmi" ? <>
                <a href="https://doi.org/10.3390/diagnostics14161838" target="_blank" rel="noreferrer">Dobrynina et al. · diffusion-MRI study <ArrowUpRight size={12} /></a>
                <a href="https://surfer.nmr.mgh.harvard.edu/fswiki/mri_cc" target="_blank" rel="noreferrer">FreeSurfer · callosum segmentation method <ArrowUpRight size={12} /></a>
              </> : <a href={relatedSource.url} target="_blank" rel="noreferrer">{relatedSource.title} <ArrowUpRight size={12} /></a>}
            </div>
          </div>
          <a className="xtract-related-link" href={learningHash(relatedPath, relatedStep)} target="_blank" rel="noreferrer">
            Explore {relatedStop.title.toLowerCase()} in the 3D learning path <ArrowUpRight size={13} />
          </a>
        </aside>
      )}

      <details className="xtract-scope">
        <summary>Source and interpretation</summary>
        <p>{manifest.interpretation}</p>
        <p>{manifest.attribution}</p>
        <p>
          Contributing participants — HCP {entry.subjects.hcp.toLocaleString()} ·
          {" "}BLSA {entry.subjects.blsa.toLocaleString()} · VU {entry.subjects.vu.toLocaleString()}
          {" "}({entry.subjects.subjects.toLocaleString()} total). Counts vary by pathway.
        </p>
        <p>{manifest.encoding.method}</p>
        <a href={manifest.source.paper} target="_blank" rel="noreferrer"><BookOpen size={13} /> Hansen et al. · Pandora population atlas <ArrowUpRight size={12} /></a>
        <a href={manifest.source.method} target="_blank" rel="noreferrer"><BookOpen size={13} /> FSL · XTRACT method and atlas notes <ArrowUpRight size={12} /></a>
        <a href={manifest.source.repository} target="_blank" rel="noreferrer"><BookOpen size={13} /> Source repository and CC BY 4.0 license <ArrowUpRight size={12} /></a>
        {entry.name !== entry.sourceName && <p>The display corrects the source CSV spelling “Fascile”; the original value remains in the provenance record.</p>}
      </details>
    </section>
  );
}
