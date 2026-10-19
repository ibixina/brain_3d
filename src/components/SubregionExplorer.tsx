import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Focus, Link, Minus, Plus, Split } from "lucide-react";
import { AtlasViewer, type ViewState } from "../viewer";
import { assetUrl } from "../asset-url.ts";
import {
  matchingSubregions,
  boundaryNeighbors,
  subregionName,
  subregionCatalog,
  type SubregionAtlas,
  type SubregionKind,
  type SubregionName,
} from "../subregions.ts";
import {
  resolveSubregionRoute,
  subregionViews,
  type SubregionRoute,
  type SubregionView,
} from "../subregion-navigation.ts";
import "./subregions.css";
import { thalamicGroupCamera, thalamicGroupSelection } from "../thalamus-guide.ts";
import ContentBoundary, { ContentRecovery } from "./ContentBoundary";

const ProbabilityEvidence = lazy(() => import("./ProbabilityEvidence"));

function ProbabilityDisclosure({ kind, part, omitted = false, boundary, source }: {
  kind: SubregionKind;
  part: SubregionName;
  omitted?: boolean;
  boundary?: string;
  source?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="subregion-probability"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>{omitted ? subregionName(part) : "Atlas probability evidence"}</summary>
      {open && boundary && (
        <p>{boundary} <a href={source} target="_blank" rel="noreferrer">Boundary reference ↗</a></p>
      )}
      {open && (
        <ContentBoundary label="Probability evidence">
          <Suspense fallback={<p role="status">Loading evidence panel…</p>}>
            <ProbabilityEvidence kind={kind} part={part} />
          </Suspense>
        </ContentBoundary>
      )}
    </details>
  );
}

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

const atlasNotes: Record<SubregionKind, { scope: string; protocol: string }> = {
  brainstem: {
    scope: "Its boundary protocol differs from the whole-brain label. Individual nuclei, nerves, and axons are not modeled.",
    protocol: "The superior cerebellar peduncles share one label.",
  },
  thalamus: {
    scope: "It includes geniculate labels that the main thalamus-proper mesh excludes. A 0.5 mm grid does not establish individual microscopic boundaries.",
    protocol: "This download has 26 label names per side; 23 per side have winner voxels. The current segmentation software describes 25 labels per side; this explorer follows the downloaded probability file, not that software’s current output.",
  },
  amygdala: {
    scope: "Its nine labels include seven nuclei and two areas per side. A 0.25 mm grid does not establish microscopic accuracy. Neurons, intercalated cell groups, and fiber pathways are not modeled.",
    protocol: "Winner assignment uses all 30 channels, including background and 20 hippocampal labels. Only the nine amygdala labels per side are displayed. The supplied left/right probability arrays are identical with reflected affines; these shapes do not measure anatomical asymmetry. Tiny fragments, particularly the 17-voxel medial label, need caution.",
  },
  hippocampus: {
    scope: "Its 20 labels per side include head/body divisions, white matter, and fissure space, not 20 cellular subfields. CA2 is grouped within the source’s CA3 labels. A 0.25 mm grid does not establish microscopic accuracy.",
    protocol: "Winner assignment uses all 30 channels, including background and nine amygdala labels. Only the 20 hippocampal labels per side are displayed. This download uses head/body divisions and GC-ML-DG naming; it is not an unchanged copy of the original 2015 label set. Current protocol documentation includes CA2 within CA3. The left/right probability arrays are identical with reflected affines, not a measurement of anatomical asymmetry. Individual axons, cells, and synapses are not reconstructed.",
  },
  cerebellum: {
    scope: "It shows 28 lobular compartments and six deep-nucleus labels (three pairs). I–IV share a compartment; interposed combines emboliform and globose. Cellular layers, full foliation, and individual fibers are not reconstructed.",
    protocol: "Lobular and deep-nucleus maps come from different participant groups in the 2009 and 2011 studies. The published categorical map is used as supplied. The left/right fastigial labels contain only 2/5 voxels, and Vermis_CrusI contains 20; these fragments do not establish full anatomical extents. Source spellings are retained. Anatomical labels are not task-activation maps.",
  },
};

export default function SubregionExplorer({
  kind,
  route,
  onRouteChange,
  onReference,
}: {
  kind: SubregionKind;
  route: SubregionRoute;
  onRouteChange: (route: SubregionRoute) => void;
  onReference: (id: string) => void;
}) {
  const [atlas, setAtlas] = useState<SubregionAtlas | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    setAtlas(null);
    setFailed(false);
    const request =
      kind === "brainstem"
        ? import("../brainstem-subregions.json")
        : kind === "thalamus"
          ? Promise.all([
              import("../thalamus-subregions.json"),
              import("../thalamus-guide.json"),
            ]).then(([atlas, guide]) => ({ default: { ...atlas.default, guide: guide.default } }))
          : kind === "amygdala"
            ? Promise.all([
                import("../amygdala-subregions.json"),
                import("../amygdala-boundaries.json"),
              ]).then(([atlas, boundaries]) => ({ default: { ...atlas.default, boundaries: boundaries.default } }))
            : kind === "hippocampus"
              ? import("../hippocampus-subregions.json")
              : import("../cerebellum-subregions.json");
    void request
      .then((data) => {
        if (!cancelled) setAtlas(data.default);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);
  if (failed) return <ContentRecovery label="Atlas reference" />;
  if (!atlas) return <p role="status">Loading atlas reference…</p>;
  return (
    <LoadedSubregions
      key={kind}
      atlas={atlas}
      kind={kind}
      route={route}
      onRouteChange={onRouteChange}
      onReference={onReference}
    />
  );
}

function LoadedSubregions({
  atlas,
  kind,
  route,
  onRouteChange,
  onReference,
}: {
  atlas: SubregionAtlas;
  kind: SubregionKind;
  route: SubregionRoute;
  onRouteChange: (route: SubregionRoute) => void;
  onReference: (id: string) => void;
}) {
  const large = atlas.parts.length > 8;
  const name = subregionCatalog[kind].name;
  const partWord = kind === "thalamus" ? "nucleus" : "subregion";
  const resolved = resolveSubregionRoute(route, atlas.parts);
  const initialGroup = atlas.guide?.groups.find((group) => group.id === resolved.tour);
  const groupStart = initialGroup
    ? thalamicGroupSelection(atlas.parts, initialGroup, resolved.hemisphere, resolved.selected)
    : null;
  const initialSelected = groupStart?.selected ?? resolved.selected;
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<AtlasViewer | null>(null);
  const reading = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [state, setState] = useState<ViewState>(() => ({
    ...initial,
    selected: initialSelected,
    hemisphere: resolved.hemisphere,
    isolated: resolved.isolated && initialSelected === resolved.selected,
    exploded: resolved.exploded,
    hiddenGroups: groupStart?.hiddenGroups ?? [],
  }));
  const [tour, setTour] = useState(initialGroup?.id ?? null);
  const [camera, setCamera] = useState(resolved.camera);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [choosing, setChoosing] = useState(!initialSelected);
  const [shareMessage, setShareMessage] = useState("");
  const [shareFailed, setShareFailed] = useState(false);
  const shareInput = useRef<HTMLInputElement>(null);
  const routeChange = useRef(onRouteChange);
  routeChange.current = onRouteChange;
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const selected = atlas.parts.find((part) => part.id === state.selected);
  const groupIndex = atlas.guide?.groups.findIndex((group) => group.id === tour) ?? -1;
  const activeGroup = atlas.guide?.groups[groupIndex];
  const boundary = selected ? atlas.guide?.labels[selected.key] : undefined;
  const protocol = selected ? atlas.boundaries?.labels[selected.key] : undefined;
  const relatedReading = atlas.relatedReading ?? (atlas.boundaries && {
    title: "Related anatomy & human evidence",
    scope: atlas.boundaries.readingScope,
    links: atlas.boundaries.reading,
  });
  const neighbors = selected && protocol ? boundaryNeighbors(atlas.parts, selected, protocol.neighbors) : [];
  const pointed = atlas.parts.find((part) => part.id === hover?.id);
  const assetHemisphere = atlas.assets ? state.hemisphere : null;
  const inScope = (part: SubregionName) => !state.hiddenGroups.includes(part.group);
  const visible = matchingSubregions(atlas.parts, "", state.hemisphere).filter(inScope);
  const assets = atlas.assets?.filter((asset) =>
    state.hemisphere === "both" || asset.hemisphere === state.hemisphere,
  );
  const transferBytes = assets
    ? assets.reduce((sum, asset) => sum + asset.geometry.compressedBytes, 0)
    : atlas.geometry.compressedBytes;
  const matches = matchingSubregions(atlas.parts, query, state.hemisphere).filter(inScope);
  if (large)
    matches.sort(
      (a, b) =>
        a.name.localeCompare(b.name) ||
        a.hemisphere.localeCompare(b.hemisphere),
    );
  const omitted = matchingSubregions(atlas.omitted ?? [], "", state.hemisphere).filter(inScope);
  const sourceCount = visible.length + omitted.length;
  const focusReading = (atDescription = false) => requestAnimationFrame(() => {
    const reader = panel.current;
    const heading = reading.current;
    if (reader) {
      const top = atDescription && heading
        ? reader.scrollTop + heading.getBoundingClientRect().top - reader.getBoundingClientRect().top - 22
        : 0;
      reader.scrollTo({ top });
    }
    heading?.focus({ preventScroll: true });
  });
  const choose = (id: string, inspect = false) => {
    setState((current) => ({
      ...current,
      selected: id,
      isolated: inspect || current.isolated,
      exploded: inspect ? 0 : current.exploded,
    }));
    if (large) {
      setChoosing(false);
      focusReading();
    }
  };
  const chooseRef = useRef(choose);
  chooseRef.current = choose;

  function showGroup(index: number) {
    const group = atlas.guide?.groups[index];
    if (!group) return;
    setTour(group.id);
    setState((current) => ({
      ...current,
      ...thalamicGroupSelection(atlas.parts, group, current.hemisphere),
      isolated: false,
      exploded: 0,
    }));
    setCamera(thalamicGroupCamera(group, state.hemisphere));
    setQuery("");
    setChoosing(false);
    focusReading();
  }

  function endTour() {
    setTour(null);
    setState((current) => ({ ...current, hiddenGroups: [], isolated: false, exploded: 0 }));
    setCamera("default");
    focusReading();
  }

  function changeHemisphere(hemisphere: string) {
    setState((current) => ({
      ...current,
      hemisphere,
      selected: null,
      isolated: false,
      exploded: 0,
      ...(activeGroup ? thalamicGroupSelection(atlas.parts, activeGroup, hemisphere) : {}),
    }));
    if (activeGroup) setCamera(thalamicGroupCamera(activeGroup, hemisphere));
    setQuery("");
    setChoosing(!activeGroup);
  }

  useEffect(() => {
    routeChange.current({
      kind,
      hemisphere: state.hemisphere as SubregionRoute["hemisphere"],
      selected: state.selected,
      isolated: state.isolated,
      exploded: state.exploded,
      camera,
      tour,
    });
    setShareMessage("");
    setShareFailed(false);
  }, [kind, state, camera, tour]);

  useEffect(() => {
    if (initialSelected) reading.current?.focus({ preventScroll: true });
  }, []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      setShareMessage("Atlas link copied.");
    } catch {
      setShareFailed(true);
      setShareMessage("Select and copy the link below.");
      requestAnimationFrame(() => shareInput.current?.select());
    }
  }

  useEffect(() => {
    if (!host.current) return;
    setReady(false);
    setError("");
    try {
      viewer.current = new AtlasViewer(
        host.current,
        {
          select: (id) => chooseRef.current(id),
          hover: (id, x, y) => setHover(id ? { id, x, y } : null),
          ready: () => setReady(true),
          error: setError,
          detail: () => {},
          stats: () => {},
          label: () => {},
        },
        {
          regions: assets ? visible : atlas.parts,
          compressedUrl: atlas.compressedUrl,
          rawUrl: atlas.rawUrl,
          assets,
          fitOnLoad: true,
          explodeFromCenter: true,
          label: `Interactive ${kind} atlas subdivisions. Drag to rotate, scroll to zoom, right-drag to pan. Use the part chooser for keyboard access.`,
        },
      );
      viewer.current.update(state);
    } catch {
      setError(
        "WebGL could not start. Part descriptions and source links remain available below.",
      );
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, [atlas, attempt, assetHemisphere]);

  useEffect(() => {
    viewer.current?.update(state);
  }, [state, ready]);

  useEffect(() => {
    if (ready) viewer.current?.view(camera);
  }, [camera, ready, state.hemisphere, state.isolated, state.exploded, tour]);

  return (
    <div className="subregion-explorer">
      <div className="subregion-stage">
        <div className="subregion-caption">
          <span className="subregion-frame">
            SEPARATE ATLAS · {atlas.source.spacingMm[0]} mm {atlas.probabilityEvidence === false ? "label" : "probability"} grid
            {large &&
              ` · ${state.hemisphere === "both" ? "Both sides" : state.hemisphere === "left" ? "Left" : "Right"}`}
            {kind === "cerebellum" && state.hemisphere !== "both" && " + vermis"}
            {activeGroup && ` · ${activeGroup.name} group`}
          </span>
          {selected ? (
            <button
              className="subregion-current"
              onClick={() => focusReading(true)}
              aria-label={`Read about ${subregionName(selected)}`}
              title="Return to this description"
            >
              <span className="subregion-current-label">READING ABOUT{selected.warning && ` · ${selected.warning.toUpperCase()}`}</span>
              <span className="subregion-current-name">
                {subregionName(selected)}<ChevronRight size={14} aria-hidden="true" />
              </span>
            </button>
          ) : (
            <p className="subregion-current-hint">Select a surface to inspect</p>
          )}
        </div>
        <div ref={host} className="subregion-canvas" />
        {!ready && !error && (
          <p className="subregion-loading" role="status">
            Loading atlas surfaces…
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
              top: Math.min(hover.y + 18, window.innerHeight - 90),
            }}
          >
            <small>POINTING AT</small>
            <strong>{subregionName(pointed)}</strong>
          </div>
        )}
      </div>
      <section
        className="subregion-reading"
        ref={panel}
        aria-label={`${name} part descriptions`}
      >
        <h2>Inside the {kind}.</h2>
        <p className="subregion-intro">
          {large
            ? `${visible.length} selectable ${visible.length === 1 ? "surface" : "surfaces"} from ${sourceCount} source ${sourceCount === 1 ? "label" : "labels"}${state.hemisphere === "both" ? " across both sides" : ` on the ${state.hemisphere}${kind === "cerebellum" ? " plus the vermis" : ""}`}${activeGroup ? " in this group" : ""}.`
            : "Select a surface or a name to inspect one of four atlas compartments."}
        </p>
        {route.selected && route.selected !== initialSelected && (
          <p className="subregion-link-notice" role="status">
            The linked part is unavailable in this view.
            Showing the available surfaces instead.
          </p>
        )}
        {large && (
          <>
            <label className="subregion-hemisphere">
              Hemisphere
              <select
                aria-label="Subregion hemisphere"
                value={state.hemisphere}
                onChange={(event) => changeHemisphere(event.target.value)}
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="both">Both</option>
              </select>
            </label>
          </>
        )}
        <label className="subregion-viewpoint">
          Viewpoint
          <select
            aria-label="Subregion anatomical viewpoint"
            value={camera}
            disabled={!ready}
            onChange={(event) => setCamera(event.target.value as SubregionView)}
          >
            {Object.entries(subregionViews).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {atlas.guide && (
          activeGroup ? (
            <div className="subregion-tour" aria-label="Thalamic nuclear group tour">
              <div className="subregion-tour-heading">
                <div>
                  <span className="eyebrow" role="status">GROUP {groupIndex + 1} OF {atlas.guide.groups.length}</span>
                  <h3>{activeGroup.name}</h3>
                </div>
                <button className="subregion-tour-end" onClick={endTour}>Show all groups</button>
              </div>
              <p>{activeGroup.text}</p>
              <p className="subregion-tour-scope">{state.isolated ? "One nucleus is isolated." : "Only this group is shown."}</p>
              <div className="subregion-tour-actions">
                <button disabled={groupIndex === 0} onClick={() => showGroup(groupIndex - 1)} aria-label="Previous nuclear group">← Previous</button>
                <button disabled={groupIndex === atlas.guide.groups.length - 1} onClick={() => showGroup(groupIndex + 1)} aria-label="Next nuclear group">Next →</button>
              </div>
            </div>
          ) : (
            <button className="subregion-tour-start" onClick={() => showGroup(0)}>Tour {atlas.guide.groups.length} nuclear groups →</button>
          )
        )}
        {large && (
          <button
            className="subregion-picker"
            aria-expanded={choosing}
            onClick={() => setChoosing((value) => !value)}
          >
            Choose {selected ? `another ${partWord}` : `a ${partWord}`}
            <ChevronDown size={14} />
          </button>
        )}
        {(!large || choosing) && (
          <div className={large ? "subregion-chooser" : ""}>
            {large && (
              <input
                aria-label={`Find an atlas ${partWord}`}
                placeholder="Name, abbreviation, or group…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && matches.length === 1) {
                    event.preventDefault();
                    choose(matches[0].id, true);
                  }
                }}
              />
            )}
            <div
              className={`subregion-parts${large ? " searchable" : ""}`}
              aria-label={`${name} subdivisions`}
            >
              {matches.map((part) => (
                <button
                  key={part.id}
                  aria-pressed={state.selected === part.id}
                  className={hover?.id === part.id ? "pointed" : ""}
                  onClick={() => choose(part.id, large)}
                >
                  <i style={{ background: part.color }} aria-hidden="true" />
                  {subregionName(part)}
                </button>
              ))}
            </div>
            {large && (
              <p className="subregion-match-count" role="status">
                {matches.length
                  ? `${matches.length} matching ${matches.length === 1 ? "surface" : "surfaces"}`
                  : activeGroup
                    ? "No matching surface in this group. Show all groups to broaden the search."
                    : "No matching surface. See coverage below for source labels without winner voxels."}
              </p>
            )}
          </div>
        )}
        <div
          className="subregion-description"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="eyebrow">
            {selected ? "READING ABOUT" : "WHAT THIS MODEL SHOWS"}
          </span>
          <h3 ref={reading} tabIndex={-1}>
            {selected
              ? subregionName(selected)
              : large
                ? "Atlas subregion surfaces"
                : "Four gross subdivisions"}
          </h3>
          <p>
            {boundary ?? selected?.description ??
              `Surfaces derived from ${kind === "cerebellum" ? "Diedrichsen Lab’s published cerebellar label map" : `FreeSurfer’s ${kind} probability atlas`}. Colors identify atlas labels; they do not show activity, tissue color, or individual cells.`}
          </p>
          {boundary && atlas.guide && (
            <>
              <p className="subregion-boundary-note">{atlas.guide.note}</p>
              <a className="subregion-boundary-source" href={atlas.guide.source} target="_blank" rel="noreferrer">Boundary protocol · Table 2 ↗</a>
            </>
          )}
        </div>
        {selected && protocol && atlas.boundaries && (
          <section className="subregion-boundary" aria-label={`${subregionName(selected)} boundary protocol`}>
            <h4>Boundary protocol</h4>
            <p>{protocol.text}</p>
            <p className="subregion-boundary-note">{atlas.boundaries.note}</p>
            <a className="subregion-boundary-source" href={atlas.boundaries.source} title={atlas.boundaries.sourceTitle} target="_blank" rel="noreferrer">Ex vivo MRI protocol · Table 2 ↗</a>
            <h4>Explore selected neighbors</h4>
            <p className="subregion-boundary-note">Choose a label to isolate its existing surface.</p>
            <div className="subregion-neighbors">
              {neighbors.map((part) => (
                <button key={part.id} disabled={!ready} onClick={() => choose(part.id, true)} aria-label={`Inspect ${subregionName(part)}`}>
                  {subregionName(part)}<ChevronRight size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        )}
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
          <button
            disabled={!ready}
            onClick={() => {
              setTour(null);
              setState((current) => ({
                ...initial,
                hemisphere: current.hemisphere,
              }));
              setQuery("");
              setChoosing(true);
            }}
          >
            All parts
          </button>
        </div>
        {selected && atlas.probabilityEvidence !== false && <ProbabilityDisclosure kind={kind} part={selected} />}
        <button className="subregion-share" onClick={copyLink}>
          <Link size={14} /> Copy this atlas view
        </button>
        <p className="subregion-share-hint">
          {tour && "Includes this group-tour stop. "}
          Shares the side, part, layout and chosen viewpoint. Manual rotation
          and zoom are not saved.
        </p>
        {shareMessage && (
          <p className="subregion-share-status" role="status">{shareMessage}</p>
        )}
        {shareFailed && (
          <input
            ref={shareInput}
            className="subregion-share-url"
            aria-label="Atlas view link"
            readOnly
            value={location.href}
          />
        )}
        {omitted.length > 0 && (
          <details className="subregion-omitted">
            <summary>{omitted.length} source {omitted.length === 1 ? "label" : "labels"} without a surface</summary>
            <p>
              The maximum-probability rule assigns no voxels to these labels,
              even though their probabilities are nonzero. No surface is
              created; this does not mean the nuclei are anatomically absent.
              Expand a label to inspect its source probabilities.
            </p>
            <ul>
              {omitted.map((part) => (
                <li key={part.id}>
                  <ProbabilityDisclosure kind={kind} part={part} omitted boundary={atlas.guide?.labels[part.key]} source={atlas.guide?.source} />
                </li>
              ))}
            </ul>
          </details>
        )}
        {relatedReading && (
          <details className="subregion-related">
            <summary>{relatedReading.title}</summary>
            <p>{relatedReading.scope}</p>
            {relatedReading.links.map((note) => (
              <button key={note.id} onClick={() => onReference(note.id)}>{note.label}<ChevronRight size={13} aria-hidden="true" /></button>
            ))}
          </details>
        )}
        <p className="subregion-scope">
          This separate {atlas.probabilityEvidence === false ? "anatomical" : "probability"} atlas is not registered to the whole-brain
          model or MRI templates.{" "}
          {atlasNotes[kind].scope}
        </p>
        <details className="subregion-sources">
          <summary>Sources, method & limitations</summary>
          {selected && (
            <p>
              Selected mask: {selected.voxels.toLocaleString()} {atlas.probabilityEvidence === false ? "labeled" : "winning"} voxels
              {selected.voxelConnectedComponents6 !== undefined &&
                ` in ${selected.voxelConnectedComponents6} separate voxel ${selected.voxelConnectedComponents6 === 1 ? "group" : "groups"} (connected through shared faces)`}.{" "}
              These describe the derived mask, not cells or a complete
              anatomical extent.
            </p>
          )}
          {atlas.probabilityEvidence === false ? <p>{atlas.source.method}</p> : <p>
            Each voxel takes its most probable label, including
            unknown/background. Surfaces use a 0.5 boundary on the resulting
            masks, without extra smoothing or resampling. The grid limits
            detail; crisp boundaries do not express certainty. Small
            disconnected surface portions are retained.
          </p>}
          <p>
            Source space: {atlas.source.frame}.{" "}
            {atlasNotes[kind].protocol}
          </p>
          <p>
            {atlas.source.attribution ?? "Modified FreeSurfer data"} ·{" "}
            {(transferBytes / 1000).toFixed(0)} kB compressed
            geometry, loaded on demand. Checked October 19, 2026.
          </p>
          <a href={atlas.source.documentation} target="_blank" rel="noreferrer">
            Atlas & original data ↗
          </a>
          <a href={atlas.source.protocol} target="_blank" rel="noreferrer">
            Segmentation protocol & boundary differences ↗
          </a>
          <a href={atlas.source.paper} target="_blank" rel="noreferrer">
            {atlas.source.paperTitle ?? (kind === "amygdala"
              ? "Saygin, Kliemann et al. (2017)"
              : `Iglesias et al. (${kind === "thalamus" ? "2018" : "2015"})`)}, original study ↗
          </a>
          {atlas.source.otherStudies?.map((study) => (
            <a key={study.url} href={study.url} target="_blank" rel="noreferrer">{study.title} ↗</a>
          ))}
          {atlas.source.labelDefinitions && (
            <a
              href={atlas.source.labelDefinitions}
              target="_blank"
              rel="noreferrer"
            >
              Original label definitions (Table 2) ↗
            </a>
          )}
          <a
            href={assetUrl(atlas.source.license)}
            target="_blank"
            rel="noreferrer"
          >
            {atlas.source.licenseTitle ?? "FreeSurfer license"} ↗
          </a>
          <a
            href={assetUrl(`/subregions/${kind}-provenance.json`)}
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
