import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  Crosshair,
  ExternalLink,
  LoaderCircle,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { matchesQuery, planes, voxelIndex, worldPoint } from "../imaging";
import type { ImagingManifest, Plane, Point3, Polarity } from "../imaging";
import { useJSON, useVolume } from "../useImagingData";
import MRISlice from "./MRISlice";
import ImagingResearch from "./ImagingResearch";
import "./imaging.css";
import { withReferenceOrigin } from "../reference-navigation.ts";

type Mode = "scans" | "activities";
const taskSummaries: Record<string, string> = {
  ArchiStandard:
    "Sentence reading and listening, mental arithmetic, checkerboards, and instructed button presses.",
  ArchiSpatial:
    "Eye movements, imitation of grasping and orientation, and judgments about pictured hands.",
  ArchiSocial:
    "Spoken or written stories, human voices, natural sounds, and moving triangles.",
  ArchiEmotional:
    "Judgments about faces or eyes, contrasted with other judgments or scrambled visual controls.",
  HcpLanguage:
    "Listen to short stories or arithmetic questions and answer using a response pad.",
  HcpSocial:
    "Decide whether moving shapes appear to interact socially or move randomly.",
  HcpGambling:
    "Guess a hidden number and receive positive or negative feedback.",
  HcpMotor: "Move the cued hand, foot, or tongue in short blocks.",
  HcpEmotion: "Match emotional faces or geometric shapes.",
  HcpRelational:
    "Compare relationships between objects or match an individual visual feature.",
  HcpWm:
    "Track pictures using a 2-back memory task or a simpler 0-back target task.",
  RSVPLanguage:
    "Read words, pseudowords, and sentences with different syntactic structures.",
};

export default function ImagingWorkspace({
  mode,
  referenceOrigin = null,
  onReturnReference,
}: {
  mode: Mode;
  referenceOrigin?: string | null;
  onReturnReference?: () => void;
}) {
  const {
    value: manifest,
    error: manifestError,
    retry: retryManifest,
  } = useJSON<ImagingManifest>("/imaging/manifest.json");
  const [scanId, setScanId] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get("scan") || "t1",
  );
  const [mapId, setMapId] = useState(
    () =>
      new URLSearchParams(location.hash.slice(1)).get("map") || "ibc-100941",
  );
  const [point, setPoint] = useState<Point3>([48, 66, 45]);
  const [primary, setPrimary] = useState<Plane>("axial");
  const [contrast, setContrast] = useState(1.1);
  const [threshold, setThreshold] = useState(3);
  const [opacity, setOpacity] = useState(0.8);
  const [polarity, setPolarity] = useState<Polarity>("both");
  const [crosshairs, setCrosshairs] = useState(true);
  const [chooser, setChooser] = useState(false);
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState("all");
  const [research, setResearch] = useState(false);
  const [inspector, setInspector] = useState(true);
  const [copied, setCopied] = useState(false);
  const active =
    manifest?.maps.find((item) => item.id === mapId) ??
    manifest?.maps.find((item) => item.id === "ibc-100941");
  const scan =
    manifest?.scans.find(
      (item) => item.id === (mode === "activities" ? "t1" : scanId),
    ) ?? manifest?.scans[0];
  useEffect(() => {
    if (scan && scanId !== scan.id && mode === "scans") setScanId(scan.id);
  }, [scan?.id, scanId, mode]);
  const structural = useVolume(scan?.asset);
  const activation = useVolume(
    mode === "activities" ? active?.asset : undefined,
  );
  const previousMap = useRef("");
  useEffect(() => {
    if (mode === "activities" && active && previousMap.current !== active.id) {
      setPoint(active.peakVoxel);
      previousMap.current = active.id;
    }
  }, [mode, active]);
  useEffect(() => {
    const params = new URLSearchParams({ view: mode });
    params.set(
      mode === "scans" ? "scan" : "map",
      mode === "scans" ? scanId : active?.id || mapId,
    );
    history.replaceState(
      null,
      "",
      withReferenceOrigin(`#${params}`, referenceOrigin),
    );
    setChooser(false);
  }, [mode, scanId, active?.id, mapId, referenceOrigin]);
  const error =
    manifestError ||
    structural.error ||
    (mode === "activities" ? activation.error : "");
  const loading =
    !manifest ||
    !structural.data ||
    (mode === "activities" && !activation.data);
  const world = manifest ? worldPoint(point, manifest.grid) : [0, 0, 0];
  const value =
    activation.data && manifest
      ? activation.data[voxelIndex(point, manifest.grid.shape)] * 0.01
      : null;
  const options = {
    contrast,
    threshold,
    maximum: Math.max(8, threshold + 1),
    opacity,
    polarity,
    backgroundGrid: scan?.grid,
  };
  const domains = [...new Set(manifest?.maps.map((item) => item.domain))];
  const matches =
    manifest?.maps.filter(
      (item) =>
        (domain === "all" || item.domain === domain) &&
        matchesQuery(query, [
          item.title,
          item.contrast,
          item.domain,
          item.task,
          item.negative,
        ]),
    ) ?? [];
  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }
  return (
    <main
      className={`imaging-workspace ${inspector ? "" : "inspector-hidden"}`}
      aria-label={mode === "scans" ? "Brain scans" : "Activity activation maps"}
    >
      <div className="imaging-heading">
        <div>
          {referenceOrigin && (
            <button className="reference-return" onClick={onReturnReference}>
              <ArrowLeft size={12} /> Back to reference note
            </button>
          )}
          <span className="eyebrow">
            {mode === "scans"
              ? "INSIDE THE ANATOMY"
              : "MEASURED TASK RESPONSES"}
          </span>
          <h1>{mode === "scans" ? "Brain scans." : "The brain at work."}</h1>
        </div>
        <button
          className="research-index-button"
          onClick={() => setResearch(true)}
        >
          <BookOpen size={14} />
          <span>Research index</span>
          <ArrowUpRight size={13} />
        </button>
      </div>
      <div className="imaging-layout">
        <div className="scan-stage">
          <div className="scan-stage-title">
            <span className="scan-status-dot" />
            <span>{mode === "scans" ? scan?.title : active?.title}</span>
            <small>
              {mode === "scans"
                ? "ICBM152 · population average"
                : `${active?.participant} · ${active?.session} · Z statistic`}
            </small>
            <button
              title={inspector ? "Hide explanation" : "Show explanation"}
              aria-label={
                inspector ? "Hide scan explanation" : "Show scan explanation"
              }
              onClick={() => setInspector(!inspector)}
            >
              <BookOpen size={15} />
            </button>
          </div>
          {error ? (
            <div className="imaging-message" role="alert">
              <strong>Unable to load this image.</strong>
              <p>{error}</p>
              <button
                onClick={() => {
                  retryManifest();
                  structural.retry();
                  activation.retry();
                }}
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="imaging-message" role="status">
              <LoaderCircle className="spin" size={24} />
              <p>Loading measured image data…</p>
              <small>Only the current volume is loaded.</small>
            </div>
          ) : (
            manifest &&
            structural.data && (
              <div className="linked-slices">
                {[primary, ...planes.filter((plane) => plane !== primary)].map(
                  (plane, index) => (
                    <MRISlice
                      key={plane}
                      plane={plane}
                      primary={index === 0}
                      onFocus={() => setPrimary(plane)}
                      point={point}
                      onPoint={setPoint}
                      grid={manifest.grid}
                      scan={structural.data!}
                      overlay={mode === "activities" ? activation.data : null}
                      options={options}
                      crosshairs={crosshairs}
                    />
                  ),
                )}
              </div>
            )
          )}
          <div
            className="slice-position-controls"
            aria-label="Linked slice coordinates"
          >
            {["X", "Y", "Z"].map((axis, index) => (
              <label key={axis}>
                <span>
                  {axis}
                  <strong>
                    {world[index]}
                    <small>mm</small>
                  </strong>
                </span>
                <input
                  aria-label={`${axis} coordinate`}
                  aria-valuetext={`${world[index]} millimeters in MNI ${axis}`}
                  type="range"
                  min={0}
                  max={(manifest?.grid.shape[index] ?? 1) - 1}
                  step={1}
                  value={point[index]}
                  onChange={(event) => {
                    const next = [...point] as Point3;
                    next[index] = Number(event.target.value);
                    setPoint(next);
                  }}
                />
              </label>
            ))}
          </div>
          <div className="scan-stage-footer">
            <span>Neurological view · left is left · MNI coordinates</span>
            <button
              aria-pressed={crosshairs}
              onClick={() => setCrosshairs(!crosshairs)}
            >
              <Crosshair size={13} />
              Crosshairs
            </button>
          </div>
          {mode === "activities" && (
            <div className="activation-legend">
              <span>
                <i className="negative-swatch" />B &gt; A
              </span>
              <span className="activation-gradient" />
              <span>
                A &gt; B<i className="positive-swatch" />
              </span>
              <small>
                Shown at |Z| ≥ {threshold.toFixed(1)} · display threshold
              </small>
            </div>
          )}
        </div>
        {inspector && (
          <aside className="imaging-inspector" aria-label="Scan explanation">
            <div className="imaging-inspector-label">
              <span className="eyebrow">
                {mode === "scans" ? "REFERENCE MRI" : "TASK CONTRAST"}
              </span>
              <button
                onClick={() => setInspector(false)}
                aria-label="Close scan explanation"
              >
                <X size={15} />
              </button>
            </div>
            <h2>{mode === "scans" ? scan?.title : active?.title}</h2>
            {mode === "scans" ? (
              <>
                <p className="imaging-description">{scan?.description}</p>
                <dl className="image-facts">
                  <div>
                    <dt>Data</dt>
                    <dd>Average of 152 participants</dd>
                  </div>
                  <div>
                    <dt>Template</dt>
                    <dd>ICBM152 nonlinear asymmetric 2009c</dd>
                  </div>
                  <div>
                    <dt>Sampling</dt>
                    <dd>1 mm source & display</dd>
                  </div>
                  <div>
                    <dt>Intensity</dt>
                    <dd>Arbitrary grayscale</dd>
                  </div>
                </dl>
                <p className="image-note">
                  A population reference, rather than a single person’s scan.
                  All three sequences share the same anatomy and coordinates.
                </p>
              </>
            ) : (
              active && (
                <>
                  <div className="contrast-comparison">
                    <div>
                      <b>A</b>
                      <span>{active.positive}</span>
                    </div>
                    <div>
                      <b>B</b>
                      <span>{active.negative}</span>
                    </div>
                  </div>
                  <p className="imaging-description">
                    {taskSummaries[active.task]}
                  </p>
                  <dl className="image-facts">
                    <div>
                      <dt>Sample</dt>
                      <dd>One participant · {active.participant}</dd>
                    </div>
                    <div>
                      <dt>Acquisition</dt>
                      <dd>
                        {active.session} · {active.task}
                      </dd>
                    </div>
                    <div>
                      <dt>Map</dt>
                      <dd>Unthresholded Z statistic</dd>
                    </div>
                    <div>
                      <dt>At crosshair</dt>
                      <dd>
                        {value === null
                          ? "Loading…"
                          : `Z = ${value.toFixed(2)}`}
                      </dd>
                    </div>
                  </dl>
                  <button
                    className="peak-button"
                    onClick={() => setPoint(active.peakVoxel)}
                  >
                    <Crosshair size={13} />
                    Jump to positive peak{" "}
                    <small>Z {active.peakZ.toFixed(2)}</small>
                  </button>
                  <p className="image-note">
                    Measured BOLD contrast from an IBC participant performing an
                    adapted task. It is not a group average or a live recording.
                    The MRI background is a separate population template in MNI
                    coordinates; alignment is approximate.
                  </p>
                </>
              )
            )}
            <div className="imaging-adjustments">
              {mode === "activities" ? (
                <>
                  <label>
                    Display threshold{" "}
                    <strong>|Z| ≥ {threshold.toFixed(1)}</strong>
                    <input
                      aria-label="Activation display threshold"
                      type="range"
                      min={0}
                      max={10}
                      step={0.1}
                      value={threshold}
                      onChange={(event) =>
                        setThreshold(Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Overlay opacity{" "}
                    <strong>{Math.round(opacity * 100)}%</strong>
                    <input
                      aria-label="Activation overlay opacity"
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={opacity}
                      onChange={(event) =>
                        setOpacity(Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    Contrast direction
                    <select
                      aria-label="Activation direction"
                      value={polarity}
                      onChange={(event) =>
                        setPolarity(event.target.value as Polarity)
                      }
                    >
                      <option value="both">Both directions</option>
                      <option value="positive">A greater than B</option>
                      <option value="negative">B greater than A</option>
                    </select>
                  </label>
                  <p className="threshold-note">
                    The threshold changes visibility only. No
                    multiple-comparison correction or clinical inference is
                    applied. Blue does not mean “inactive.”
                  </p>
                </>
              ) : (
                <label>
                  Display contrast<strong>{contrast.toFixed(1)}×</strong>
                  <input
                    aria-label="MRI display contrast"
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.05}
                    value={contrast}
                    onChange={(event) =>
                      setContrast(Number(event.target.value))
                    }
                  />
                </label>
              )}
            </div>
            <div className="imaging-source-links">
              <a
                href={mode === "scans" ? scan?.source : active?.source}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={13} />
                Original source
                <ArrowUpRight size={12} />
              </a>
              {mode === "activities" && (
                <a href={active?.protocol} target="_blank" rel="noreferrer">
                  Task protocol
                  <ArrowUpRight size={12} />
                </a>
              )}
              <button onClick={() => void copy()}>
                {copied ? <Check size={13} /> : <ExternalLink size={13} />}{" "}
                {copied ? "Link copied" : "Copy image link"}
              </button>
            </div>
          </aside>
        )}
      </div>
      <div className="imaging-dock">
        {mode === "scans" ? (
          <div
            className="scan-sequence-switch"
            role="group"
            aria-label="MRI sequence"
          >
            {manifest?.scans.map((item) => (
              <button
                key={item.id}
                aria-pressed={scanId === item.id}
                className={scanId === item.id ? "active" : ""}
                onClick={() => setScanId(item.id)}
              >
                {item.id.toUpperCase()}
                <small>
                  {item.id === "pd" ? "Proton density" : "weighted"}
                </small>
              </button>
            ))}
          </div>
        ) : (
          <button
            className="activity-chooser-trigger"
            onClick={() => {
              setChooser(!chooser);
              setQuery("");
            }}
            aria-expanded={chooser}
          >
            <Activity size={16} />
            <span>
              Choose an activity
              <small>{manifest?.maps.length ?? 117} measured contrasts</small>
            </span>
            <ChevronDown size={13} />
          </button>
        )}
        <span className="dock-rule" />
        <button
          className="image-reset"
          title="Reset image controls"
          aria-label="Reset image controls"
          onClick={() => {
            setPoint(
              mode === "activities" && active ? active.peakVoxel : [48, 66, 45],
            );
            setThreshold(3);
            setOpacity(0.8);
            setContrast(1.1);
            setPolarity("both");
            setPrimary("axial");
            setCrosshairs(true);
          }}
        >
          <RotateCcw size={15} />
        </button>
      </div>
      {chooser && (
        <section className="activity-chooser" aria-label="Activity map library">
          <div className="activity-chooser-heading">
            <div>
              <span className="eyebrow">MEASURED fMRI MAPS</span>
              <h2>Choose a task contrast.</h2>
            </div>
            <button
              aria-label="Close activity library"
              onClick={() => setChooser(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="activity-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search movement, memory, reading…"
              aria-label="Search activation maps"
            />
          </div>
          <select
            aria-label="Filter activity domain"
            value={domain}
            onChange={(event) => setDomain(event.target.value)}
          >
            <option value="all">All task domains</option>
            {domains.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <div className="activity-results-count" role="status">
            {matches.length} contrasts · single-participant examples
          </div>
          <div className="activity-map-list">
            {matches.map((item) => (
              <button
                key={item.id}
                className={active?.id === item.id ? "active" : ""}
                onClick={() => {
                  setMapId(item.id);
                  setChooser(false);
                  setInspector(true);
                }}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>vs. {item.negative}</small>
                </span>
                <small>{item.task}</small>
                <ArrowUpRight size={13} />
              </button>
            ))}
            {!matches.length && (
              <p className="no-imaging-results">
                No matching maps. Try another task name or domain.
              </p>
            )}
          </div>
          <button
            className="full-research-link"
            onClick={() => {
              setChooser(false);
              setResearch(true);
            }}
          >
            Browse the full research compilation
            <ArrowUpRight size={13} />
          </button>
        </section>
      )}
      {research && (
        <ImagingResearch
          manifest={manifest}
          onClose={() => setResearch(false)}
        />
      )}
    </main>
  );
}
