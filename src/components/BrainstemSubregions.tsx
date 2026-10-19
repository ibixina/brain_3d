import { useEffect, useRef, useState } from "react";
import { Focus, Minus, Plus, Split } from "lucide-react";
import { AtlasViewer, type ViewState } from "../viewer";
import { assetUrl } from "../asset-url.ts";
import atlas from "../brainstem-subregions.json";
import "./subregions.css";

const initial: ViewState = {
  selected: null,
  isolated: false,
  exploded: 0,
  explodeMode: "regions",
  opacity: 1,
  hemisphere: "both",
  hiddenGroups: [],
  labels: false,
  autoRotate: false,
  colorMode: "atlas",
  section: "none",
  sectionOffset: 0,
};

export default function BrainstemSubregions() {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<AtlasViewer | null>(null);
  const [state, setState] = useState(initial);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const selected = atlas.parts.find((part) => part.id === state.selected);
  const pointed = atlas.parts.find((part) => part.id === hover?.id);

  useEffect(() => {
    if (!host.current) return;
    setReady(false);
    setError("");
    try {
      viewer.current = new AtlasViewer(
        host.current,
        {
          select: (id) => setState((current) => ({ ...current, selected: id })),
          hover: (id, x, y) => setHover(id ? { id, x, y } : null),
          ready: () => setReady(true),
          error: setError,
          detail: () => {},
          stats: () => {},
          label: () => {},
        },
        {
          regions: atlas.parts,
          compressedUrl: atlas.compressedUrl,
          rawUrl: atlas.rawUrl,
          fitOnLoad: true,
          label:
            "Interactive brainstem atlas subdivisions. Drag to rotate, scroll to zoom, right-drag to pan. Use the four part buttons for keyboard access.",
        },
      );
      viewer.current.update(initial);
    } catch {
      setError(
        "WebGL could not start. The four part descriptions and source links remain available below.",
      );
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    viewer.current?.update(state);
  }, [state, ready]);

  return (
    <div className="subregion-explorer">
      <div className="subregion-stage">
        <div ref={host} className="subregion-canvas" />
        <span className="subregion-frame">
          SEPARATE ATLAS · 1 mm probability grid
        </span>
        {!ready && !error && (
          <p className="subregion-loading" role="status">
            Loading four subdivisions…
          </p>
        )}
        {error && (
          <div className="subregion-loading" role="alert">
            <p>{error}</p>
            <button onClick={() => setAttempt((value) => value + 1)}>
              Retry model
            </button>
          </div>
        )}
        <div
          className="subregion-controls"
          aria-label="Subregion view controls"
        >
          <button
            disabled={!ready}
            onClick={() => viewer.current?.zoom(0.8)}
            aria-label="Zoom in on subregions"
          >
            <Plus size={16} />
          </button>
          <button
            disabled={!ready}
            onClick={() => viewer.current?.zoom(1.25)}
            aria-label="Zoom out from subregions"
          >
            <Minus size={16} />
          </button>
          <button disabled={!ready} onClick={() => viewer.current?.fit()}>
            <Focus size={15} /> Fit model
          </button>
          <button
            disabled={!ready}
            aria-pressed={state.exploded > 0}
            onClick={() =>
              setState((current) => ({
                ...current,
                isolated: false,
                exploded: current.exploded ? 0 : 0.3,
              }))
            }
          >
            <Split size={15} /> Separate parts
          </button>
        </div>
        <p className="subregion-instructions">
          Drag to rotate · Scroll or pinch to zoom
        </p>
        {pointed && hover && (
          <div
            className="subregion-hover"
            style={{
              left: Math.min(hover.x + 16, window.innerWidth - 245),
              top: Math.min(hover.y + 18, window.innerHeight - 75),
            }}
          >
            <small>POINTING AT</small>
            <strong>{pointed.name}</strong>
          </div>
        )}
      </div>
      <section
        className="subregion-reading"
        aria-label="Brainstem part descriptions"
      >
        <h2>Inside the brainstem.</h2>
        <p className="subregion-intro">
          Select a surface or a name to inspect one of four atlas compartments.
        </p>
        <div className="subregion-parts" aria-label="Brainstem subdivisions">
          {atlas.parts.map((part) => (
            <button
              key={part.id}
              aria-pressed={state.selected === part.id}
              className={hover?.id === part.id ? "pointed" : ""}
              onClick={() =>
                setState((current) => ({ ...current, selected: part.id }))
              }
            >
              <i style={{ background: part.color }} aria-hidden="true" />
              {part.name}
            </button>
          ))}
        </div>
        <div
          className="subregion-description"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="eyebrow">
            {selected ? "READING ABOUT" : "WHAT THIS MODEL SHOWS"}
          </span>
          <h3>{selected?.name ?? "Four gross subdivisions"}</h3>
          <p>
            {selected?.description ??
              "A surface model derived from FreeSurfer’s brainstem probability atlas. Colors identify atlas labels; they do not show activity, individual nuclei, or tissue color."}
          </p>
        </div>
        <div className="subregion-selection">
          <button
            disabled={!ready || !selected}
            aria-pressed={state.isolated}
            onClick={() =>
              setState((current) => ({
                ...current,
                isolated: !current.isolated,
                exploded: 0,
              }))
            }
          >
            Only this part
          </button>
          <button disabled={!ready} onClick={() => setState({ ...initial })}>
            All parts
          </button>
        </div>
        <p className="subregion-scope">
          This is a separate atlas, with a different boundary protocol from the
          whole-brain label. It is not overlaid on that brain or the MRI
          templates. Individual nuclei, nerves, and axons are not modeled.
        </p>
        <details className="subregion-sources">
          <summary>Sources, method & limitations</summary>
          <p>
            Each voxel takes its most probable label, including background.
            Surfaces use a 0.5 boundary on the resulting masks, without extra
            smoothing or resampling. The source’s 1 mm grid limits detail; a
            crisp boundary does not express certainty. Small disconnected
            surface portions are retained.
          </p>
          <p>
            Source space: approximately MNI-ICBM152 2009c symmetric. Recentered
            for this independent view. The superior cerebellar peduncles share
            one label.
          </p>
          <p>
            Modified FreeSurfer data ·{" "}
            {(atlas.geometry.compressedBytes / 1000).toFixed(0)} kB compressed
            geometry, loaded on demand. Checked October 19, 2026.
          </p>
          <a href={atlas.source.documentation} target="_blank" rel="noreferrer">
            Probability atlas & original data ↗
          </a>
          <a href={atlas.source.protocol} target="_blank" rel="noreferrer">
            Segmentation protocol & boundary differences ↗
          </a>
          <a href={atlas.source.paper} target="_blank" rel="noreferrer">
            Iglesias et al. (2015), original study ↗
          </a>
          <a
            href={assetUrl(atlas.source.license)}
            target="_blank"
            rel="noreferrer"
          >
            FreeSurfer license ↗
          </a>
          <a
            href={assetUrl("/subregions/brainstem-provenance.json")}
            target="_blank"
            rel="noreferrer"
          >
            Mesh provenance & checksums ↗
          </a>
        </details>
      </section>
    </div>
  );
}
