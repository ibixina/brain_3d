import { useEffect, useId, useRef, useState } from "react";
import { assetUrl } from "../asset-url.ts";
import { cerebellarProbabilityUrl, loadProbabilityBytes, moveProbabilityPoint, probabilitySlice,
  probabilityPointAt, sourceProbability, type CerebellarProbability } from "../probability-slices.ts";
import { planeAxis, planeDimensions, planes, voxelIndex, worldPoint, type Plane, type Point3 } from "../imaging.ts";
import { probabilityPercent } from "../subregion-evidence.ts";
import { subregionName, type Subregion } from "../subregions.ts";
import "./probability-slices.css";

export default function CerebellarProbabilityPanel({ part, parts }: { part: Subregion; parts: Subregion[] }) {
  const [data, setData] = useState<{ manifest: CerebellarProbability; labels: Uint8Array } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setData(null);
    void fetch(assetUrl(cerebellarProbabilityUrl), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Probability manifest unavailable");
        const manifest = await response.json() as CerebellarProbability;
        if (manifest.version !== 1 || manifest.kind !== "cerebellum" || manifest.grid.shape.join() !== "153,100,79" ||
            manifest.encoding.dtype !== "uint8" || manifest.encoding.order !== "x-fastest")
          throw new Error("Probability source mismatch");
        const labels = await loadProbabilityBytes(manifest.labels, controller.signal);
        if (!controller.signal.aborted) setData({ manifest, labels });
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <div role="alert"><p>The source slices could not load. The 3D atlas remains available.</p><button onClick={() => setAttempt((n) => n + 1)}>Retry source slices</button></div>;
  if (!data) return <p role="status">Loading native atlas grid…</p>;
  if (!Object.hasOwn(data.manifest.entries, part.id)) return <p>No probability channel is available for this label.</p>;
  return <LoadedProbability key={part.id} part={part} parts={parts} {...data} />;
}

function LoadedProbability({ part, parts, manifest, labels }: {
  part: Subregion; parts: Subregion[]; manifest: CerebellarProbability; labels: Uint8Array;
}) {
  const entry = manifest.entries[part.id];
  const [values, setValues] = useState<Uint8Array | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [plane, setPlane] = useState<Plane>("axial");
  const [point, setPoint] = useState<Point3>(entry.peak.index);
  const canvas = useRef<HTMLCanvasElement>(null);
  const instructions = useId();
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setValues(null);
    void loadProbabilityBytes(entry.asset, controller.signal)
      .then((result) => { if (!controller.signal.aborted) setValues(result); })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [entry, attempt]);
  useEffect(() => {
    if (!values || !canvas.current) return;
    const { pixels, width, height } = probabilitySlice(plane, point, manifest, values, labels, entry.label);
    canvas.current.width = width;
    canvas.current.height = height;
    canvas.current.getContext("2d")?.putImageData(new ImageData(pixels, width, height), 0, 0);
  }, [values, labels, entry, manifest, plane, point]);
  if (error) return <div role="alert"><p>This label’s source channel could not load.</p><button onClick={() => setAttempt((n) => n + 1)}>Retry probability channel</button></div>;
  if (!values) return <p role="status">Loading {subregionName(part)} probability channel…</p>;
  const axis = planeAxis[plane];
  const [horizontal, vertical] = planeDimensions[plane];
  const at = voxelIndex(point, manifest.grid.shape);
  const probability = sourceProbability(values[at], manifest.encoding);
  const categorical = parts.find((item) => manifest.entries[item.id]?.label === labels[at]);
  const ras = worldPoint(point, manifest.grid);
  const horizontalEnds = plane === "sagittal" ? ["P", "A"] : ["L", "R"];
  const verticalEnds = plane === "axial" ? ["A", "P"] : ["S", "I"];
  return (
    <section className="probability-explorer" aria-label={`${subregionName(part)} native probability slices`}>
      <h4>{subregionName(part)}</h4>
      <p>Explore the label’s full probability map, including locations outside its 3D surface. Starts at this channel’s peak.</p>
      <div className="probability-planes" aria-label="Source slice plane">
        {planes.map((item) => <button key={item} aria-pressed={plane === item} onClick={() => setPlane(item)}>{item}</button>)}
      </div>
      <button className="probability-slice" aria-label={`Sample ${plane} probability slice`} aria-describedby={instructions}
        onClick={(event) => {
          if (event.detail === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setPoint(probabilityPointAt(point, plane, (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height, manifest.grid.shape));
        }}
        onKeyDown={(event) => {
          const next = moveProbabilityPoint(point, plane, event.key, manifest.grid.shape);
          if (next) { event.preventDefault(); setPoint(next); }
        }}>
        <canvas ref={canvas} aria-hidden="true" />
        <i className="probability-cross-x" style={{ left: `${(point[horizontal] + .5) / manifest.grid.shape[horizontal] * 100}%` }} />
        <i className="probability-cross-y" style={{ top: `${(manifest.grid.shape[vertical] - point[vertical] - .5) / manifest.grid.shape[vertical] * 100}%` }} />
        <span className="probability-left">{horizontalEnds[0]}</span><span className="probability-right">{horizontalEnds[1]}</span>
        <span className="probability-top">{verticalEnds[0]}</span><span className="probability-bottom">{verticalEnds[1]}</span>
      </button>
      <div className="probability-scale" aria-label="Fixed probability color scale from 0 to 100 percent"><span>0%</span><i /><span>100%</span></div>
      <p className="probability-key">White edge: selected categorical label. Dim silhouette: other labels. No MRI background.</p>
      <label className="probability-position">
        {plane} slice · {ras[axis]} mm {['R', 'A', 'S'][axis]}
        <input type="range" min={0} max={manifest.grid.shape[axis] - 1} value={point[axis]}
          aria-label={`${plane} source slice`} aria-valuetext={`${ras[axis]} millimeters ${['right', 'anterior', 'superior'][axis]}`}
          onChange={(event) => setPoint((current) => current.map((n, i) => i === axis ? Number(event.target.value) : n) as Point3)} />
      </label>
      <p id={instructions} className="probability-key">Click or tap to sample. With the image focused, arrow keys move one voxel; the slider changes depth. All planes share the crosshair.</p>
      <div className="probability-readout" role="status" aria-live="polite" aria-atomic="true">
        <p><span>This label’s probability</span><strong>{probabilityPercent(probability)}</strong></p>
        <p>Published categorical label: <strong>{categorical ? subregionName(categorical) : "Background / unassigned"}</strong></p>
        <p>Source RAS (mm): {ras.join(", ")} · voxel {point.join(", ")} (zero-based).</p>
      </div>
      <button onClick={() => setPoint([...entry.peak.index])}>Jump to label peak · {probabilityPercent(sourceProbability(entry.peak.storedValue, manifest.encoding))}</button>
      <p>{entry.positiveVoxels.toLocaleString()} native voxels have a nonzero probability for this label; {entry.categoricalVoxels.toLocaleString()} carry its categorical label. These count different representations, not cells or a complete anatomical extent. The peak is not an accuracy score.</p>
      <p>Atlas label probabilities, separate from MRI and task activation. This 1 mm source grid is not registered to the whole-brain model or bundled scans. The 3D surface stays unchanged.</p>
      <details className="probability-method">
        <summary>Probability method, source & reuse</summary>
        <p>{manifest.interpretation}</p><p>{manifest.method}</p>
        <p>Original 8-bit channel values and NIfTI scaling are preserved. The fixed 0–100% color scale has no threshold. Crosshair samples use exact native voxels; the white categorical edge uses in-plane voxel boundaries. Changing the plane or sample does not move the 3D camera. Slice state is local and is not included in copied atlas links.</p>
        <p>{((entry.asset.bytes + manifest.labels.bytes) / 1000).toFixed(1)} kB compressed channel and categorical context, requested on demand. Only the current channel and context grid are retained while open. Diedrichsen Lab · CC BY (upstream version unspecified). Checked {manifest.checkedOn}.</p>
        {manifest.source.studies.map((study) => <a key={study.url} href={study.url} target="_blank" rel="noreferrer">{study.title} ↗</a>)}
        <a href={manifest.source.documentation} target="_blank" rel="noreferrer">Original atlas distribution ↗</a>
        <a href={assetUrl(cerebellarProbabilityUrl)} target="_blank" rel="noreferrer">Probability provenance & checksums (JSON) ↗</a>
        <a href={assetUrl(manifest.source.license)} target="_blank" rel="noreferrer">Attribution & reuse notice ↗</a>
      </details>
    </section>
  );
}
