import React, {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Eye,
  EyeOff,
  Film,
  Focus,
  Layers3,
  Link,
  LoaderCircle,
  Maximize,
  Minus,
  MousePointer2,
  Move,
  Orbit,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Split,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AtlasViewer, type ViewState } from "./viewer";
import { assetUrl } from "./asset-url.ts";
import { matchedAnatomicalTerms, searchRegions } from "./anatomical-search.ts";
import { RegionVideos, VideoLibrary } from "./components/DissectionVideos";
import RegionCallout from "./components/RegionCallout";
import {
  LearningLibrary,
  LearningHeader,
  LearningExplanation,
  LearningNavigation,
} from "./components/LearningPaths";
import {
  learningFromHash,
  learningHash,
  learningView,
  type LearningPath,
  type LearningPosition,
} from "./learning";
import {
  atlas,
  groupColors,
  groups,
  hemisphereLabel,
  infoFor,
  regions,
  relatedRegions,
  sources,
} from "./data";

const ImagingWorkspace = lazy(() => import("./components/ImagingWorkspace"));
const ReferenceLibrary = lazy(() => import("./components/ReferenceLibrary"));
type Section = "anatomy" | "scans" | "activities";
type LibraryTab = "structures" | "paths" | "reference";
const libraryTabs: { id: LibraryTab; label: string }[] = [
  { id: "structures", label: "Structures" },
  { id: "paths", label: "Learning paths" },
  { id: "reference", label: "Reference" },
];

const defaultView: ViewState = {
  selected: null,
  isolated: false,
  exploded: 0,
  explodeMode: "lobes",
  opacity: 1,
  hemisphere: "both",
  hiddenGroups: ["Ventricles", "White matter"],
  labels: false,
  autoRotate: false,
  colorMode: "tissue",
  section: "none",
  sectionOffset: 0,
};
const groupTitle = (name: string) =>
  ["Frontal", "Parietal", "Temporal", "Occipital"].includes(name)
    ? `${name} lobe`
    : name === "Limbic"
      ? "Limbic cortex"
      : name === "Insula"
        ? "Insular cortex"
        : name;
const readSaved = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem("cerebra-saved") || "[]").filter(
      (id: string) => regions.some((p) => p.id === id),
    );
  } catch {
    return [];
  }
};
function IconButton({
  icon: Icon,
  label,
  active,
  onClick,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      className={`icon-button ${active ? "active" : ""} ${className}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
    >
      <Icon size={17} />
    </button>
  );
}
export default function App() {
  const [section, setSection] = useState<Section>(() => {
    const view = new URLSearchParams(location.hash.slice(1)).get("view");
    return view === "scans" || view === "activities" ? view : "anatomy";
  });
  const [navigationVersion, setNavigationVersion] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<AtlasViewer | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const [learning, setLearning] = useState<LearningPosition | null>(() =>
    learningFromHash(location.hash),
  );
  const [libraryTab, setLibraryTab] = useState<LibraryTab>(() =>
    new URLSearchParams(location.hash.slice(1)).has("reference")
      ? "reference"
      : "structures",
  );
  const [referenceId, setReferenceId] = useState<string | null>(
    () => new URLSearchParams(location.hash.slice(1)).get("reference") || null,
  );
  const [state, setState] = useState<ViewState>(() => {
    const position = learningFromHash(location.hash);
    if (position) return learningView(position, defaultView);
    const id = new URLSearchParams(location.hash.slice(1)).get("region");
    return {
      ...defaultView,
      selected: regions.some((p) => p.id === id) ? id : null,
    };
  });
  const [detailStatus, setDetailStatus] = useState<{
    id: string;
    status: string;
  } | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [tab, setTab] = useState("overview");
  const [modal, setModal] = useState<"sources" | "help" | "videos" | null>(
    null,
  );
  const [saved, setSaved] = useState<string[]>(readSaved);
  const [savedOnly, setSavedOnly] = useState(false);
  const [hover, setHover] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [labels, setLabels] = useState<{ id: string; x: number; y: number }[]>(
    [],
  );
  const [toast, setToast] = useState("");
  const [sidebar, setSidebar] = useState(() =>
    new URLSearchParams(location.hash.slice(1)).has("reference"),
  );
  const [settings, setSettings] = useState(false);
  const [cameraView, setCameraView] = useState("default");
  const selected = regions.find((p) => p.id === state.selected);
  const readingReference = sidebar && libraryTab === "reference";
  const hovered = regions.find((p) => p.id === hover?.id);
  const selectedVisible =
    selected &&
    (state.isolated ||
      (!state.hiddenGroups.includes(selected.group) &&
        (state.hemisphere === "both" ||
          selected.hemisphere === "midline" ||
          selected.hemisphere === state.hemisphere))) &&
    (selected.kind !== "cortex" || state.opacity > 0);
  const info = selected ? infoFor(selected) : null;
  function update(patch: Partial<ViewState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }
  function notify(message: string) {
    setToast(message);
  }
  function select(id: string) {
    setLearning(null);
    setHover(null);
    const region = regions.find((p) => p.id === id)!;
    setState((prev) => ({
      ...prev,
      selected: id,
      hiddenGroups: prev.hiddenGroups.filter((g) => g !== region.group),
      hemisphere:
        prev.hemisphere !== "both" && prev.hemisphere !== region.hemisphere
          ? "both"
          : prev.hemisphere,
    }));
    setTab((current) => (current === "videos" ? current : "overview"));
    setSidebar(false);
    history.replaceState(null, "", `#region=${encodeURIComponent(id)}`);
  }
  function goToLearning(path: LearningPath, step = 0) {
    const position = { path, step };
    setLearning(position);
    setState(learningView(position, defaultView));
    setSection("anatomy");
    setTab("overview");
    setSidebar(false);
    setSettings(false);
    setHover(null);
    history.replaceState(null, "", learningHash(path, step));
    if (!learning || learning.path.id !== path.id)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>(".region-name")?.focus(),
      );
  }
  function openPaths() {
    switchLibraryTab("paths");
    setSidebar(true);
    setSettings(false);
    setHover(null);
  }
  function openReference(id: string | null) {
    setReferenceId(id);
    setLibraryTab("reference");
    setSidebar(true);
    setSettings(false);
    setHover(null);
    history.replaceState(
      null,
      "",
      id ? `#reference=${encodeURIComponent(id)}` : "#reference",
    );
  }
  function switchLibraryTab(next: LibraryTab) {
    if (next === "reference") {
      openReference(referenceId);
      return;
    }
    setLibraryTab(next);
    if (new URLSearchParams(location.hash.slice(1)).has("reference"))
      history.replaceState(null, "", location.pathname + anatomyHash());
  }
  function closeLibrary() {
    setSidebar(false);
    if (new URLSearchParams(location.hash.slice(1)).has("reference"))
      history.replaceState(null, "", location.pathname + anatomyHash());
  }
  function exploreReferenceRegion(id: string) {
    const region = regions.find((item) => item.id === id)!;
    select(id);
    setState({
      ...defaultView,
      selected: id,
      opacity: region.kind === "cortex" ? 1 : 0.15,
      hiddenGroups: defaultView.hiddenGroups.filter(
        (group) => group !== region.group,
      ),
    });
    camera(region.kind === "cortex" ? region.hemisphere : "default");
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".region-name")?.focus(),
    );
  }
  function endLearning(completed = false) {
    setLearning(null);
    history.replaceState(
      null,
      "",
      location.pathname + (state.selected ? `#region=${state.selected}` : ""),
    );
    if (completed)
      notify("Path complete. Keep exploring, or choose another learning path.");
  }
  const selectRef = useRef(select);
  selectRef.current = select;
  useEffect(() => {
    const navigate = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      const view = params.get("view");
      const next = view === "scans" || view === "activities" ? view : "anatomy";
      setSection(next);
      setNavigationVersion((version) => version + 1);
      setSidebar(false);
      setSettings(false);
      setHover(null);
      if (next === "anatomy") {
        if (params.has("reference")) {
          setReferenceId(params.get("reference") || null);
          setLibraryTab("reference");
          setSidebar(true);
          return;
        }
        const position = learningFromHash(location.hash);
        if (position) {
          goToLearning(position.path, position.step);
          return;
        }
        setLearning(null);
        const region = regions.find((item) => item.id === params.get("region"));
        if (region) selectRef.current(region.id);
        else
          setState((current) => ({
            ...current,
            selected: null,
            isolated: false,
          }));
      }
    };
    window.addEventListener("hashchange", navigate);
    return () => window.removeEventListener("hashchange", navigate);
  }, []);
  useEffect(() => {
    if (section !== "anatomy") {
      viewer.current?.setActive(false);
      return;
    }
    if (!canvasRef.current) return;
    if (viewer.current) {
      viewer.current.setActive(true);
      return;
    }
    try {
      viewer.current = new AtlasViewer(canvasRef.current, {
        select: (id) => selectRef.current(id),
        hover: (id, x, y) => setHover(id ? { id, x, y } : null),
        ready: () => setReady(true),
        error: setError,
        detail: (id, status) => setDetailStatus({ id, status }),
        stats: () => {},
        label: setLabels,
      });
      viewer.current.update(state);
    } catch {
      setError(
        "WebGL could not start. Enable hardware acceleration or try a browser with WebGL 2 support. You can still browse all 104 regions and their notes.",
      );
    }
  }, [section]);
  useEffect(() => () => viewer.current?.dispose(), []);
  useEffect(() => {
    viewer.current?.update(state);
  }, [state]);
  useEffect(() => {
    if (!learning || !ready) return;
    const camera = learning.path.steps[learning.step].view.camera;
    setCameraView(camera);
    viewer.current?.view(camera);
  }, [learning, ready]);
  useEffect(() => {
    try {
      localStorage.setItem("cerebra-saved", JSON.stringify(saved));
    } catch {
      /* Saving is optional when browser storage is unavailable. */
    }
  }, [saved]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (modal) modalRef.current?.showModal();
    else modalRef.current?.close();
  }, [modal]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const input =
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLSelectElement;
      if ((event.ctrlKey || event.metaKey) && event.key === "k" && !modal) {
        event.preventDefault();
        changeSection("anatomy");
        setLibraryTab("structures");
        setSidebar(true);
        setSettings(false);
        requestAnimationFrame(() => searchRef.current?.focus());
        return;
      }
      if (event.key === "Escape" && !modal && section === "anatomy") {
        if (sidebar) closeLibrary();
        else if (settings) setSettings(false);
        else closeRegion();
        document
          .querySelector<HTMLElement>('[aria-label="Open anatomy library"]')
          ?.focus();
        return;
      }
      if (input || modal || section !== "anatomy") return;
      if (event.key.toLowerCase() === "e")
        setState((p) => ({
          ...p,
          exploded: p.exploded ? 0 : 0.65,
          isolated: false,
        }));
      if (event.key.toLowerCase() === "r") reset();
      if (event.key.toLowerCase() === "l")
        setState((p) => ({ ...p, labels: !p.labels }));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [modal, section, learning, state.selected, sidebar, settings]);
  const search = query.trim().toLowerCase();
  const results = useMemo(
    () =>
      searchRegions(query).filter((p) => !savedOnly || saved.includes(p.id)),
    [query, savedOnly, saved],
  );
  const matchedTerms = matchedAnatomicalTerms(query);
  function toggleGroup(group: string) {
    update({
      hiddenGroups: state.hiddenGroups.includes(group)
        ? state.hiddenGroups.filter((g) => g !== group)
        : [...state.hiddenGroups, group],
    });
  }
  function toggleSaved(id: string) {
    setSaved((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function reset() {
    setLearning(null);
    setSidebar(false);
    setSettings(false);
    setSection("anatomy");
    setState({ ...defaultView });
    setCameraView("default");
    viewer.current?.reset();
    history.replaceState(null, "", location.pathname);
  }
  function inspect() {
    if (selected) {
      update({
        isolated: !state.isolated,
        opacity: 1,
        exploded: 0,
        section: "none",
      });
    }
  }
  function camera(name: string) {
    setCameraView(name);
    viewer.current?.view(name);
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(location.href);
      notify("Region link copied");
    } catch {
      notify("Copy the address bar to share this region");
    }
  }
  function changeSection(next: Section) {
    setSection(next);
    setSidebar(false);
    setSettings(false);
    setHover(null);
    const hash = next === "anatomy" ? anatomyHash() : `#view=${next}`;
    history.replaceState(null, "", location.pathname + hash);
  }
  function anatomyHash() {
    return learning
      ? learningHash(learning.path, learning.step)
      : state.selected
        ? `#region=${state.selected}`
        : "";
  }
  function openLibrary() {
    if (sidebar) {
      closeLibrary();
      return;
    }
    switchLibraryTab("structures");
    setSidebar((current) => !current);
    setSettings(false);
    setSavedOnly(false);
    requestAnimationFrame(() => searchRef.current?.focus());
  }
  function closeRegion() {
    setLearning(null);
    update({ selected: null, isolated: false });
    history.replaceState(null, "", location.pathname);
  }
  useEffect(() => {
    document.querySelector(".region-content")?.scrollTo(0, 0);
  }, [state.selected, tab, learning?.path.id, learning?.step]);
  const controlsDisabled = !!error || !ready;
  return (
    <div
      className={`app-shell ${section === "anatomy" && selected && !readingReference ? "has-selection" : ""} ${sidebar ? "library-open" : ""} section-${section}`}
    >
      <header className="app-header">
        <button className="brand" onClick={reset} aria-label="Cerebra home">
          <Brain size={24} strokeWidth={1.3} />
          <span>
            Cerebra<small>HUMAN BRAIN ATLAS</small>
          </span>
        </button>
        <nav className="section-switch" aria-label="Explorer sections">
          {(["anatomy", "scans", "activities"] as Section[]).map((value) => (
            <button
              key={value}
              aria-current={section === value ? "page" : undefined}
              className={section === value ? "active" : ""}
              onClick={() => changeSection(value)}
            >
              {value === "anatomy"
                ? "Anatomy"
                : value === "scans"
                  ? "Brain scans"
                  : "Activations"}
            </button>
          ))}
        </nav>
        <nav className="header-actions" aria-label="Atlas resources">
          <button
            className="resource-button"
            onClick={() => setModal("videos")}
            title="Dissection videos"
          >
            <Film size={17} />
            <span>Dissections</span>
          </button>
          <IconButton
            icon={BookOpen}
            label="Atlas sources and coverage"
            onClick={() => setModal("sources")}
          />
          <IconButton
            icon={CircleHelp}
            label="How to explore"
            onClick={() => setModal("help")}
          />
        </nav>
      </header>
      <div className="workspace" hidden={section !== "anatomy"}>
        {sidebar && (
          <aside className="structure-panel" aria-label="Anatomy library">
            <div className="sidebar-heading">
              <span className="eyebrow">EXPLORE ANATOMY</span>
              {libraryTab === "structures" && (
                <span className="count-badge">{regions.length}</span>
              )}
              <IconButton
                className="mobile-close"
                icon={X}
                label="Close anatomy library"
                onClick={closeLibrary}
              />
            </div>
            <h1>
              {libraryTab === "paths"
                ? "See the connections."
                : libraryTab === "reference"
                  ? "Understand the details."
                  : "Find your focus."}
            </h1>
            <div
              className="library-tabs"
              role="tablist"
              aria-label="Anatomy library categories"
              onKeyDown={(event) => {
                if (
                  !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const current = libraryTabs.findIndex(
                  (item) => item.id === libraryTab,
                );
                const next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? 2
                      : (current + (event.key === "ArrowRight" ? 1 : 2)) % 3;
                switchLibraryTab(libraryTabs[next].id);
                document
                  .getElementById(`library-tab-${libraryTabs[next].id}`)
                  ?.focus();
              }}
            >
              {libraryTabs.map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  id={`library-tab-${item.id}`}
                  aria-controls="library-content"
                  aria-selected={libraryTab === item.id}
                  tabIndex={libraryTab === item.id ? 0 : -1}
                  onClick={() => switchLibraryTab(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <div
              className="library-body"
              id="library-content"
              role="tabpanel"
              aria-labelledby={`library-tab-${libraryTab}`}
            >
              {libraryTab === "reference" ? (
                <Suspense
                  fallback={
                    <p className="learning-intro" role="status">
                      Loading reference notes…
                    </p>
                  }
                >
                  <ReferenceLibrary
                    articleId={referenceId}
                    onOpen={openReference}
                    onRegion={exploreReferenceRegion}
                  />
                </Suspense>
              ) : libraryTab === "paths" ? (
                <LearningLibrary onStart={(path) => goToLearning(path)} />
              ) : (
                <>
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Find a brain region…"
                      aria-label="Search brain regions"
                    />
                    {query ? (
                      <button
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                      >
                        <X size={13} />
                      </button>
                    ) : (
                      <kbd>⌘ K</kbd>
                    )}
                  </div>
                  <div className="library-toolbar">
                    <span>
                      {savedOnly
                        ? "SAVED REGIONS"
                        : search
                          ? `${results.length} RESULTS`
                          : "BROWSE STRUCTURES"}
                    </span>
                    {savedOnly ? (
                      <button onClick={() => setSavedOnly(false)}>
                        Show all
                      </button>
                    ) : (
                      <button
                        className="saved-filter"
                        onClick={() => setSavedOnly(true)}
                      >
                        <Bookmark size={13} /> Saved
                        {saved.length > 0 ? ` (${saved.length})` : ""}
                      </button>
                    )}
                  </div>
                  <div className="structure-list">
                    {matchedTerms.map((term) => (
                      <div className="anatomical-term-note" key={term.name}>
                        <strong>{term.name}</strong>
                        <p>{term.note}</p>
                        <a href={term.source} target="_blank" rel="noreferrer">
                          About this term ↗
                        </a>
                      </div>
                    ))}
                    {results.length === 0 && (
                      <div className="empty-state">
                        <Search size={23} />
                        <strong>
                          {savedOnly
                            ? "Your collection starts here."
                            : "No matching regions."}
                        </strong>
                        <p>
                          {savedOnly
                            ? "Save a region using the bookmark in its detail panel."
                            : "Try an anatomical name or a function such as memory or vision."}
                        </p>
                        {!savedOnly && (
                          <button
                            className="reference-search-link"
                            onClick={() => openReference(null)}
                          >
                            Browse the reference notes
                          </button>
                        )}
                      </div>
                    )}
                    {groups.map((group, index) => {
                      const parts = results.filter((p) => p.group === group);
                      if (!parts.length) return null;
                      const open =
                        search || savedOnly || expanded.includes(group);
                      return (
                        <React.Fragment key={group}>
                          {index === 6 && !search && !savedOnly && (
                            <div className="list-section-label">
                              BENEATH THE SURFACE
                            </div>
                          )}
                          <div className={`region-group ${open ? "open" : ""}`}>
                            <div className="group-row">
                              <button
                                className="group-toggle"
                                aria-expanded={!!open}
                                onClick={() =>
                                  setExpanded((prev) =>
                                    prev.includes(group)
                                      ? prev.filter((x) => x !== group)
                                      : [...prev, group],
                                  )
                                }
                              >
                                <span
                                  className="color-dot"
                                  style={{ background: groupColors[group] }}
                                />
                                <span>{groupTitle(group)}</span>
                                <small>{parts.length}</small>
                                <ChevronRight
                                  size={14}
                                  className="group-chevron"
                                />
                              </button>
                              <button
                                className={`visibility-button ${state.hiddenGroups.includes(group) ? "hidden" : ""}`}
                                title={`${state.hiddenGroups.includes(group) ? "Show" : "Hide"} ${groupTitle(group)}`}
                                aria-label={`${state.hiddenGroups.includes(group) ? "Show" : "Hide"} ${groupTitle(group)}`}
                                onClick={() => toggleGroup(group)}
                              >
                                {state.hiddenGroups.includes(group) ? (
                                  <EyeOff size={14} />
                                ) : (
                                  <Eye size={14} />
                                )}
                              </button>
                            </div>
                            {open && (
                              <div className="group-children">
                                {parts.map((part) => (
                                  <button
                                    key={part.id}
                                    className={`region-row ${state.selected === part.id ? "selected" : ""}`}
                                    onClick={() => select(part.id)}
                                  >
                                    <span>{part.name}</span>
                                    <small>
                                      {part.hemisphere === "left"
                                        ? "L"
                                        : part.hemisphere === "right"
                                          ? "R"
                                          : "M"}
                                    </small>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </aside>
        )}
        <main className="brain-stage" aria-label="3D brain explorer">
          <div className="viewport" ref={canvasRef} />
          {!ready && !error && (
            <div className="loading-screen">
              <LoaderCircle size={28} className="spin" />
              <span>Preparing your perspective</span>
              <small>Loading the reference anatomy…</small>
            </div>
          )}
          {error && (
            <div className="error-card">
              <Brain size={30} />
              <h2>Let’s restore the view.</h2>
              <p>{error}</p>
              <button
                className="primary-button"
                onClick={() => location.reload()}
              >
                Reload atlas
              </button>
            </div>
          )}
          <div
            className="stage-toolbar"
            role="toolbar"
            aria-label="Brain controls"
          >
            <IconButton
              icon={Search}
              label="Open anatomy library"
              onClick={openLibrary}
            />
            <div className="view-segment">
              <button
                className={!state.exploded && !state.isolated ? "active" : ""}
                onClick={() => update({ exploded: 0, isolated: false })}
              >
                <Brain size={16} /> <span>Whole brain</span>
              </button>
              <button
                className={state.exploded > 0 ? "active" : ""}
                onClick={() =>
                  update({
                    exploded: state.exploded ? 0 : 0.65,
                    isolated: false,
                  })
                }
              >
                <Split size={16} /> <span>Explode</span>
              </button>
            </div>
            <button
              aria-label="View settings"
              className={`stage-option ${settings ? "active" : ""}`}
              onClick={() => {
                setSettings(!settings);
                setSidebar(false);
              }}
              aria-expanded={settings}
            >
              <SlidersHorizontal size={15} />
              <span>View</span>
              <ChevronDown size={12} />
            </button>
            <span className="dock-rule" />
            <IconButton
              icon={RotateCcw}
              label="Reset view (R)"
              onClick={reset}
            />
          </div>
          {settings && (
            <section className="settings-popover" aria-label="View settings">
              <div className="popover-title">
                View controls
                <IconButton
                  icon={X}
                  label="Close view settings"
                  onClick={() => setSettings(false)}
                />
              </div>
              <div className="settings-field">
                Hemisphere
                <div
                  className="small-segment"
                  role="group"
                  aria-label="Hemisphere"
                >
                  {["both", "left", "right"].map((h) => (
                    <button
                      key={h}
                      className={state.hemisphere === h ? "active" : ""}
                      aria-pressed={state.hemisphere === h}
                      onClick={() => update({ hemisphere: h })}
                    >
                      {h === "both" ? "Both" : h === "left" ? "Left" : "Right"}
                    </button>
                  ))}
                </div>
              </div>
              <label>
                Surface color
                <select
                  value={state.colorMode}
                  onChange={(e) => update({ colorMode: e.target.value })}
                >
                  <option value="atlas">Anatomical regions</option>
                  <option value="tissue">Natural tissue</option>
                </select>
              </label>
              <label>
                Cortical opacity <span>{Math.round(state.opacity * 100)}%</span>
                <input
                  aria-label="Cortical opacity"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={state.opacity}
                  onChange={(e) => update({ opacity: Number(e.target.value) })}
                />
              </label>
              <label>
                Section plane
                <select
                  value={state.section}
                  onChange={(e) =>
                    update({ section: e.target.value, sectionOffset: 0 })
                  }
                >
                  <option value="none">No section</option>
                  <option value="sagittal">Sagittal · left / right</option>
                  <option value="coronal">Coronal · front / back</option>
                  <option value="axial">Axial · upper / lower</option>
                </select>
              </label>
              {state.section !== "none" && (
                <label>
                  Section position <span>{state.sectionOffset} mm</span>
                  <input
                    aria-label="Section position"
                    type="range"
                    min="-100"
                    max="100"
                    value={state.sectionOffset}
                    onChange={(e) =>
                      update({ sectionOffset: Number(e.target.value) })
                    }
                  />
                  <small className="setting-note">
                    Surface cutaway; internal cut faces are not reconstructed.
                  </small>
                </label>
              )}
              <div className="settings-tools">
                <button onClick={() => viewer.current?.screenshot()}>
                  <ArrowDownToLine size={15} /> Save image
                </button>
                <button
                  onClick={() => {
                    if (document.fullscreenElement)
                      void document.exitFullscreen();
                    else
                      void document.documentElement
                        .requestFullscreen()
                        .catch(() =>
                          notify("Fullscreen is unavailable in this preview"),
                        );
                  }}
                >
                  <Maximize size={15} /> Full screen
                </button>
              </div>
              <div className="settings-toggles">
                <button
                  className={state.labels ? "on" : ""}
                  aria-pressed={state.labels}
                  onClick={() => update({ labels: !state.labels })}
                >
                  <span>Region labels</span>
                  <span className="switch" />
                </button>
                <button
                  className={state.autoRotate ? "on" : ""}
                  aria-pressed={state.autoRotate}
                  onClick={() => update({ autoRotate: !state.autoRotate })}
                >
                  <span>Slow rotation</span>
                  <span className="switch" />
                </button>
              </div>
            </section>
          )}
          {state.isolated && selected && (
            <div className="isolation-notice">
              <button onClick={() => update({ isolated: false })}>
                <ArrowLeft size={14} /> Back to whole brain
              </button>
              <span>
                <Focus size={12} />{" "}
                {detailStatus?.id === selected.id &&
                detailStatus.status === "ready"
                  ? `DETAIL MESH · ${selected.detail.triangles.toLocaleString()} FACES`
                  : detailStatus?.id === selected.id &&
                      detailStatus.status === "error"
                    ? "DETAIL UNAVAILABLE · OVERVIEW MESH"
                    : "LOADING FINER SURFACE…"}
              </span>
            </div>
          )}
          {state.labels &&
            !state.isolated &&
            labels.map((point) => (
              <button
                className="model-label"
                key={point.id}
                style={{ left: point.x, top: point.y }}
                onClick={() => select(point.id)}
              >
                <span />
                {regions.find((p) => p.id === point.id)?.group === "Cerebellum"
                  ? "Cerebellum"
                  : groupTitle(
                      regions.find((p) => p.id === point.id)?.group || "",
                    )}
              </button>
            ))}
          <div className="stage-bottom">
            {state.exploded > 0 ? (
              <div className="explosion-control">
                <Split size={15} />
                <select
                  aria-label="Explode by"
                  value={state.explodeMode}
                  onChange={(e) => update({ explodeMode: e.target.value })}
                >
                  <option value="lobes">Lobes</option>
                  <option value="regions">Parcels</option>
                </select>
                <label htmlFor="explode">Separation</label>
                <input
                  id="explode"
                  type="range"
                  min="0"
                  max="1.4"
                  step="0.01"
                  value={state.exploded}
                  onChange={(e) => update({ exploded: Number(e.target.value) })}
                />
                <span>{Math.round(state.exploded * 100)}%</span>
              </div>
            ) : null}
          </div>
          <div className="camera-tools">
            <IconButton
              icon={Minus}
              label="Zoom out"
              onClick={() => viewer.current?.zoom(1.15)}
            />
            <IconButton
              icon={Plus}
              label="Zoom in"
              onClick={() => viewer.current?.zoom(0.85)}
            />
            <IconButton
              icon={Orbit}
              active={state.autoRotate}
              label="Toggle slow rotation"
              onClick={() => update({ autoRotate: !state.autoRotate })}
            />
            <select
              aria-label="Camera view"
              value={cameraView}
              onChange={(e) => camera(e.target.value)}
            >
              <option value="default">Perspective</option>
              <option value="left">Left lateral</option>
              <option value="right">Right lateral</option>
              <option value="anterior">Anterior</option>
              <option value="posterior">Posterior</option>
              <option value="superior">Superior</option>
              <option value="inferior">Inferior</option>
            </select>
          </div>
        </main>
        {selected && info && !readingReference && (
          <aside className="detail-panel" aria-label="Region information">
            <>
              <div className="detail-topline">
                {learning ? (
                  <LearningHeader position={learning} onChoose={openPaths} />
                ) : (
                  <span className="eyebrow">READING ABOUT</span>
                )}
                <div>
                  <IconButton
                    icon={Link}
                    label="Copy region link"
                    onClick={() => void copyLink()}
                  />
                  <IconButton
                    icon={Bookmark}
                    label={
                      saved.includes(selected.id)
                        ? "Unsave region"
                        : "Save region"
                    }
                    active={saved.includes(selected.id)}
                    onClick={() => toggleSaved(selected.id)}
                  />
                  <IconButton
                    icon={X}
                    label={
                      learning ? "Close learning path" : "Close region details"
                    }
                    onClick={closeRegion}
                  />
                </div>
              </div>
              <div className="region-eyebrow">
                <span
                  className="color-dot"
                  style={{ background: selected.color }}
                />
                {selected.group.toUpperCase()}
              </div>
              <h2 className="region-name" tabIndex={-1}>
                {selected.name}
              </h2>
              <div className="region-meta">
                <span>{hemisphereLabel(selected.hemisphere)}</span>
                <span>
                  {selected.kind === "cortex"
                    ? "Cortical region"
                    : "Deep anatomy"}
                </span>
              </div>
              <p
                className={`selection-key ${selectedVisible ? "" : "is-hidden"}`}
              >
                <span />
                {selectedVisible
                  ? "Teal highlight on the model"
                  : "Hidden in this view"}
              </p>
              <div
                className="detail-tabs"
                role="tablist"
                aria-label="Region details"
              >
                {["overview", "anatomy", "connections", "videos"].map((t) => (
                  <button
                    role="tab"
                    aria-selected={tab === t}
                    key={t}
                    className={tab === t ? "active" : ""}
                    onClick={() => setTab(t)}
                  >
                    {t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="region-content" role="tabpanel">
                {tab === "overview" && (
                  <>
                    {learning && <LearningExplanation position={learning} />}
                    <p className="region-summary">{info.summary}</p>
                    <h3>Key roles</h3>
                    <div className="function-list">
                      {info.functions.map((f) => (
                        <div key={f}>
                          <span className="function-dot" />
                          {f}
                        </div>
                      ))}
                    </div>
                    <p className="network-note">
                      These roles emerge through networks of regions working
                      together.
                    </p>
                  </>
                )}
                {tab === "anatomy" && (
                  <>
                    <h3>LOCATION & ORGANIZATION</h3>
                    <p className="region-summary">{info.anatomy}</p>
                    <h3>ANATOMICAL DETAIL</h3>
                    <ul className="anatomy-list">
                      {info.subdivisions.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                    <div className="method-note">
                      <strong>About this geometry</strong>
                      <p>
                        {selected.kind === "cortex"
                          ? "A pial surface parcel from the Desikan–Killiany atlas. Detail mode loads an fsaverage6 mesh with finer spatial sampling."
                          : "A smoothed surface extracted from the fsaverage aseg label volume. Detail mode loads the surface at its finer sampling resolution."}
                      </p>
                      <p>{info.context}</p>
                      <button
                        className="reference-search-link"
                        onClick={() =>
                          openReference(
                            selected.kind === "cortex"
                              ? "cortical-layers"
                              : "atlas-boundaries",
                          )
                        }
                      >
                        Understand what this model shows
                      </button>
                    </div>
                  </>
                )}
                {tab === "connections" && (
                  <>
                    <p className="region-summary">
                      Explore related structures in this region’s broader
                      anatomical and functional context.
                    </p>
                    <div className="related-list">
                      {relatedRegions(selected).map((p) => (
                        <button key={p.id} onClick={() => select(p.id)}>
                          <span
                            className="color-dot"
                            style={{ background: p.color }}
                          />
                          <span>
                            {p.name}
                            <small>{hemisphereLabel(p.hemisphere)}</small>
                          </span>
                          <ArrowUpRight size={15} />
                        </button>
                      ))}
                    </div>
                    <div className="method-note">
                      <strong>Context, rather than a tract map</strong>
                      <p>
                        These are selected anatomical and network relationships.
                        They do not display measured fiber tracts, direction,
                        connection strength, or an exhaustive connectome.
                      </p>
                    </div>
                  </>
                )}
                {tab === "videos" && (
                  <RegionVideos
                    region={selected}
                    openLibrary={() => setModal("videos")}
                  />
                )}
                {tab !== "videos" && (
                  <button
                    className="video-region-link"
                    onClick={() => setTab("videos")}
                  >
                    <Film size={15} />
                    <span>
                      See real brain specimens
                      <small>Dissection videos for this anatomy</small>
                    </span>
                    <ArrowUpRight size={14} />
                  </button>
                )}
                <a
                  className="source-link"
                  href={info.source}
                  target="_blank"
                  rel="noreferrer"
                >
                  <BookOpen size={14} /> Read the reference{" "}
                  <ArrowUpRight size={13} />
                </a>
                <a
                  className="research-link"
                  href={`https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(selected.name + " human brain")}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Find current research on PubMed <ArrowUpRight size={12} />
                </a>
              </div>
              <div className="detail-bottom">
                {learning && (
                  <LearningNavigation
                    position={learning}
                    onStep={(step) => goToLearning(learning.path, step)}
                    onFinish={() => endLearning(true)}
                  />
                )}
                <button
                  className="primary-button"
                  onClick={inspect}
                  disabled={controlsDisabled}
                >
                  {state.isolated ? (
                    <ArrowLeft size={16} />
                  ) : (
                    <Focus size={16} />
                  )}{" "}
                  {state.isolated
                    ? "Return to whole brain"
                    : "Isolate & inspect"}
                  <ArrowUpRight size={15} />
                </button>
                <p>
                  {state.isolated
                    ? "Drag to inspect the detailed surface."
                    : "Open the higher resolution region model."}
                </p>
              </div>
            </>
          </aside>
        )}
      </div>
      {section === "anatomy" && !selected && !sidebar && (
        <div className="intro-caption">
          <span className="eyebrow">104 STRUCTURES. ONE CONNECTED SYSTEM.</span>
          <h1>The human brain.</h1>
          <p>Hover to identify a part. Click to read about it.</p>
          <button className="learning-start" onClick={openPaths}>
            <BookOpen size={14} /> Explore guided learning paths{" "}
            <ChevronRight size={13} />
          </button>
        </div>
      )}
      {section === "anatomy" && (
        <div className="canvas-footnote">
          <span className="status-dot" />
          {ready ? "MRI-derived reference anatomy" : "Loading anatomy…"}
          <span>Drag to rotate · Scroll to zoom</span>
        </div>
      )}
      {section !== "anatomy" && (
        <Suspense
          fallback={
            <div className="section-loading">
              <LoaderCircle className="spin" size={24} />
              Loading imaging workspace…
            </div>
          }
        >
          <ImagingWorkspace key={navigationVersion} mode={section} />
        </Suspense>
      )}
      {hover &&
        hovered &&
        section === "anatomy" &&
        !settings &&
        !sidebar &&
        !modal && (
          <RegionCallout
            region={hovered}
            x={hover.x}
            y={hover.y}
            selected={hovered.id === selected?.id}
          />
        )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
      <dialog
        ref={modalRef}
        className="atlas-dialog"
        aria-label={
          modal === "videos"
            ? "Dissection video library"
            : modal === "sources"
              ? "Atlas sources and coverage"
              : "How to explore"
        }
        onCancel={() => setModal(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setModal(null);
        }}
      >
        <div className="dialog-header">
          <span className="eyebrow">
            {modal === "sources"
              ? "SOURCES & COVERAGE"
              : modal === "videos"
                ? "THE DISSECTION FILM LIBRARY"
                : "EXPLORER GUIDE"}
          </span>
          <IconButton
            icon={X}
            label="Close dialog"
            onClick={() => setModal(null)}
          />
        </div>
        {modal === "sources" ? (
          <>
            <h2>Atlas sources & coverage</h2>
            <p className="dialog-intro">
              Cerebra brings a defined anatomical atlas into three dimensions.
              It is a curated educational reference, not an exhaustive
              collection of brain knowledge or a clinical tool.
            </p>
            <div className="coverage-grid">
              <div>
                <strong>{regions.length}</strong>
                <span>modeled regions</span>
              </div>
              <div>
                <strong>68</strong>
                <span>cortical parcels</span>
              </div>
              <div>
                <strong>{(atlas.totalTriangles / 1000).toFixed(0)}k</strong>
                <span>overview mesh faces</span>
              </div>
            </div>
            <div className="coverage-notice">
              <strong>What the model includes</strong>
              <p>
                Desikan–Killiany cortical parcels in both hemispheres, deep gray
                matter labels, cerebellar cortex, the brainstem, ventricular
                compartments, choroid plexus, and selected white matter
                compartments. Region detail meshes load on demand.
              </p>
              <strong>What remains outside this atlas</strong>
              <p>
                Individual neurons, cortical layers, most small nuclei, detailed
                vessels, cranial nerves, complete fiber pathways, molecular
                data, disease models, and the full research literature. Internal
                subdivisions are described in notes and are not separately
                segmented. Anatomy differs between individuals, and atlas
                boundaries differ between atlases.
              </p>
              <strong>Evidence & updates</strong>
              <p>
                Collections show their own source-check dates. Reference notes
                were checked October 19, 2026. This app does not automatically
                ingest new research. PubMed links open a live literature search.
              </p>
            </div>
            <div className="source-grid">
              {sources.map((s) => (
                <a key={s.title} href={s.url} target="_blank" rel="noreferrer">
                  <span>
                    {s.label}
                    <ArrowUpRight size={15} />
                  </span>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </a>
              ))}
            </div>
            <a
              className="manifest-link"
              href={assetUrl("/models/atlas.json")}
              target="_blank"
              rel="noreferrer"
            >
              View mesh manifest & source checksums <ArrowUpRight size={13} />
            </a>
            <a
              className="manifest-link"
              href={assetUrl("/licenses/NOTICE.txt")}
              target="_blank"
              rel="noreferrer"
            >
              Attributions & licenses <ArrowUpRight size={13} />
            </a>
          </>
        ) : modal === "videos" ? (
          <VideoLibrary />
        ) : (
          <>
            <h2>Explore the anatomy.</h2>
            <p className="dialog-intro">
              A few simple movements open up a different perspective.
            </p>
            <div className="help-grid">
              {[
                [
                  MousePointer2,
                  "Rotate",
                  "Drag with the left mouse button, or one finger.",
                ],
                [
                  Move,
                  "Pan",
                  "Drag with the right mouse button, or two fingers.",
                ],
                [Plus, "Zoom", "Scroll, pinch, or use the + and − controls."],
                [
                  Focus,
                  "Inspect",
                  "Select a region, then choose Isolate & inspect.",
                ],
                [
                  Split,
                  "Separate",
                  "Choose Exploded and adjust the separation slider.",
                ],
                [
                  Layers3,
                  "Reveal",
                  "Use opacity, hemispheres, and layer visibility to reach deeper anatomy.",
                ],
              ].map(([Icon, title, text]) => {
                const I = Icon as LucideIcon;
                return (
                  <div key={String(title)}>
                    <I size={23} />
                    <strong>{String(title)}</strong>
                    <p>{String(text)}</p>
                  </div>
                );
              })}
            </div>
            <div className="shortcut-list">
              <span>
                <kbd>⌘ / Ctrl K</kbd> Find a region
              </span>
              <span>
                <kbd>E</kbd> Explode
              </span>
              <span>
                <kbd>R</kbd> Reset
              </span>
              <span>
                <kbd>L</kbd> Labels
              </span>
              <span>
                <kbd>Esc</kbd> Back to overview
              </span>
            </div>
            <p className="help-footnote">
              All structures can also be selected using the keyboard in the
              anatomy library.
            </p>
          </>
        )}
      </dialog>
    </div>
  );
}
