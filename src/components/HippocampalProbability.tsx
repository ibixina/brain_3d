import { useEffect, useId, useRef, useState } from "react";
import { assetUrl } from "../asset-url.ts";
import {
  loadProbabilityBytes,
  moveProbabilityPoint,
  probabilityPointAt,
  probabilitySlice,
  sourceProbability,
} from "../probability-slices.ts";
import { planeAxis, planeDimensions, planes, voxelIndex, worldPoint, type Plane, type Point3 } from "../imaging.ts";
import { hippocampalProbabilityUrl, type HippocampalProbabilityManifest } from "../hippocampal-probability.ts";
import { probabilityPercent } from "../subregion-evidence.ts";
import { subregionName, type Subregion } from "../subregions.ts";
import "./probability-slices.css";

export default function HippocampalProbability({ part, parts }: { part: Subregion; parts: Subregion[] }) {
  const [data, setData] = useState<{ manifest: HippocampalProbabilityManifest; labels: Uint8Array } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setData(null);
    void fetch(assetUrl(hippocampalProbabilityUrl), { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Probability manifest unavailable");
        const manifest = await response.json() as HippocampalProbabilityManifest;
        if (manifest.version !== 1 || manifest.kind !== "hippocampus" ||
          manifest.grids.left.shape.join() !== "164,224,196" ||
          manifest.grids.right.shape.join() !== "164,224,196" ||
          manifest.categories.length !== 30 ||
          manifest.encoding.dtype !== "float32" || manifest.encoding.order !== "x-fastest")
          throw new Error("Hippocampal source mismatch");
        const labels = await loadProbabilityBytes(manifest.context.asset, controller.signal);
        if (labels.length !== manifest.grids.left.shape.reduce((size, axis) => size * axis, 1))
          throw new Error("Incomplete winner context");
        if (!controller.signal.aborted) setData({ manifest, labels });
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <div role="alert"><p>Native probability slices could not load. The selected 3D surface remains available.</p><button onClick={() => setAttempt((n) => n + 1)}>Retry source slices</button></div>;
  if (!data) return <p role="status">Loading the native hippocampal source grid…</p>;
  if (!data.manifest.entries[part.id]) return <p>No probability channel is available for this label.</p>;
  return <LoadedProbability key={part.id} part={part} parts={parts} {...data} />;
}

function LoadedProbability({ part, parts, manifest, labels }: {
  part: Subregion;
  parts: Subregion[];
  manifest: HippocampalProbabilityManifest;
  labels: Uint8Array;
}) {
  const entry = manifest.entries[part.id];
  const grid = manifest.grids[part.hemisphere as "left" | "right"];
  const [values, setValues] = useState<Float32Array | null>(null);
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
      .then((bytes) => {
        const expected = grid.shape.reduce((size, axis) => size * axis, 1);
        if (bytes.byteLength !== expected * Float32Array.BYTES_PER_ELEMENT) throw new Error("Incomplete float32 channel");
        const result = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
        if (!controller.signal.aborted) setValues(result);
      })
      .catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [entry, attempt]);

  const flipHorizontal = part.hemisphere === "right" && plane !== "sagittal";
  useEffect(() => {
    if (!values || !canvas.current) return;
    const slice = probabilitySlice(plane, point, { grid, encoding: manifest.encoding }, values, labels, entry.channel, flipHorizontal);
    canvas.current.width = slice.width;
    canvas.current.height = slice.height;
    canvas.current.getContext("2d")?.putImageData(new ImageData(slice.pixels, slice.width, slice.height), 0, 0);
  }, [values, labels, entry, grid, manifest.encoding, plane, point, flipHorizontal]);

  if (error) return <div role="alert"><p>The selected label’s source channel could not load.</p><button onClick={() => setAttempt((n) => n + 1)}>Retry probability channel</button></div>;
  if (!values) return <p role="status">Loading {subregionName(part)} probability channel…</p>;

  const axis = planeAxis[plane];
  const [horizontal, vertical] = planeDimensions[plane];
  const sampleIndex = voxelIndex(point, grid.shape);
  const probability = sourceProbability(values[sampleIndex], manifest.encoding);
  const winnerChannel = labels[sampleIndex];
  const category = manifest.categories[winnerChannel];
  const categoricalPart = parts.find((item) => manifest.entries[item.id]?.channel === winnerChannel && item.hemisphere === part.hemisphere);
  const winnerName = categoricalPart
    ? subregionName(categoricalPart)
    : winnerChannel === 0
      ? "Unknown (source label)"
      : `Amygdala · ${category?.sourceName ?? "source label"}`;
  const ras = worldPoint(point, grid);
  const xPosition = flipHorizontal ? grid.shape[horizontal] - 1 - point[horizontal] : point[horizontal];
  const horizontalEnds = plane === "sagittal" ? ["P", "A"] : ["L", "R"];
  const verticalEnds = plane === "axial" ? ["A", "P"] : ["S", "I"];
  const rasDirection = ["right", "anterior", "superior"][axis];
  const oppositeDirection = ["left", "posterior", "inferior"][axis];
  const rasAbbreviation = ["R", "A", "S"][axis];
  const oppositeAbbreviation = ["L", "P", "I"][axis];
  const positionDirection = ras[axis] >= 0 ? rasDirection : oppositeDirection;
  const positionAbbreviation = ras[axis] >= 0 ? rasAbbreviation : oppositeAbbreviation;

  return (
    <section className="probability-explorer" aria-label={`${subregionName(part)} native probability slices`}>
      <h4>{subregionName(part)}</h4>
      <p>Explore this label’s source-grid probability. Starts at its highest-probability voxel.</p>
      <div className="probability-planes" aria-label="Source slice plane">
        {planes.map((item) => <button key={item} aria-pressed={plane === item} onClick={() => setPlane(item)}>{item}</button>)}
      </div>
      <button className="probability-slice" aria-label={`Sample ${plane} probability slice`} aria-describedby={instructions}
        onClick={(event) => {
          if (event.detail === 0) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setPoint(probabilityPointAt(point, plane, (event.clientX - rect.left) / rect.width,
            (event.clientY - rect.top) / rect.height, grid.shape, flipHorizontal));
        }}
        onKeyDown={(event) => {
          const next = moveProbabilityPoint(point, plane, event.key, grid.shape, flipHorizontal);
          if (next) { event.preventDefault(); setPoint(next); }
        }}>
        <canvas ref={canvas} aria-hidden="true" />
        <i className="probability-cross-x" style={{ left: `${(xPosition + .5) / grid.shape[horizontal] * 100}%` }} />
        <i className="probability-cross-y" style={{ top: `${(grid.shape[vertical] - point[vertical] - .5) / grid.shape[vertical] * 100}%` }} />
        <span className="probability-left">{horizontalEnds[0]}</span><span className="probability-right">{horizontalEnds[1]}</span>
        <span className="probability-top">{verticalEnds[0]}</span><span className="probability-bottom">{verticalEnds[1]}</span>
      </button>
      <div className="probability-scale" aria-label="Fixed probability color scale from 0 to 100 percent"><span>0%</span><i /><span>100%</span></div>
      <p className="probability-key">White edge: selected maximum-probability region. Dim silhouette: other winning labels. No MRI background.</p>
      <label className="probability-position">
        {plane} slice · {ras[axis].toFixed(2)} mm {positionAbbreviation}
        <input type="range" min={0} max={grid.shape[axis] - 1} value={point[axis]} aria-label={`${plane} source slice`}
          aria-valuetext={`${ras[axis].toFixed(2)} millimeters ${positionDirection}`}
          onChange={(event) => setPoint((current) => current.map((n, i) => i === axis ? Number(event.target.value) : n) as Point3)} />
      </label>
      <p id={instructions} className="probability-key">Click or tap to sample. With the image focused, arrow keys move one voxel; the slider changes depth. All planes share the crosshair.</p>
      <div className="probability-readout" role="status" aria-live="polite" aria-atomic="true">
        <p><span>This label’s probability</span><strong>{probabilityPercent(probability)}</strong></p>
        <p>Highest-probability source label: <strong>{winnerName}</strong></p>
        <p>Source RAS (mm): {ras.map((value) => value.toFixed(2)).join(", ")} · voxel {point.join(", ")} (zero-based).</p>
      </div>
      <button onClick={() => setPoint([...entry.peak.index])}>Jump to label peak · {probabilityPercent(entry.peak.probability)}</button>
      <p>{entry.positiveVoxels.toLocaleString()} source voxels have nonzero probability; {entry.categoricalVoxels.toLocaleString()} are assigned this label by the all-channel winner map. The peak is not a confidence score or a complete boundary.</p>
      <p>These 0.25 mm atlas probabilities are distinct from MRI intensity and task activation. The source grid is symmetric template space, independent of the main brain and packaged MRI scans.</p>
      <details className="probability-method">
        <summary>Probability method, source & reuse</summary>
        <p>{manifest.interpretation}</p><p>{manifest.method}</p>
        <p>{((entry.asset.bytes + manifest.context.asset.bytes) / 1000).toFixed(1)} kB compressed source channel and winner context are loaded on demand. The left and right probability arrays are shared; each side uses its source affine. Tiny negative floating-point endpoint values display as 0% while the stored channel remains unchanged.</p>
        <a href={manifest.source.documentation} target="_blank" rel="noreferrer">Original atlas distribution ↗</a>
        <a href={manifest.source.paper} target="_blank" rel="noreferrer">Iglesias et al. (2015) ↗</a>
        <a href={manifest.source.protocol} target="_blank" rel="noreferrer">Current subfield output hierarchy ↗</a>
        <a href={assetUrl(hippocampalProbabilityUrl)} target="_blank" rel="noreferrer">Probability provenance and checksums (JSON) ↗</a>
        <a href={assetUrl(manifest.source.license)} target="_blank" rel="noreferrer">FreeSurfer data license and attribution ↗</a>
      </details>
    </section>
  );
}
