import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BookOpen,
  Box,
  ChevronDown,
  Crosshair,
  ExternalLink,
  Layers,
  LoaderCircle,
  Plus,
  Search,
  X,
} from "lucide-react";
import { AtlasViewer, type Painter, type ViewState } from "../viewer";
import { assetUrl } from "../asset-url.ts";
import { regions, hemisphereLabel } from "../data";
import {
  matchesQuery,
  planes,
  voxelIndex,
  worldPoint,
  type ImagingManifest,
  type Plane,
  type Point3,
  type Volume,
} from "../imaging";
import { useJSON, useVolume } from "../useImagingData";
import {
  comparisonColors,
  displayToMni152,
  layerValue,
  lensColor,
  lensFraction,
  lensLabels,
  lensVolume,
  mni152ToDisplay,
  parseKey,
  regionStats,
  surfaceSample,
  unpackActivity,
  voxelAt,
  voxelPoint,
  type ActivityManifest,
  type Layer,
  type Lens,
  type Measure,
  type MetaActivity,
  type Pathway,
} from "../activity-compare.ts";
import pathwayData from "../activity-pathways.json";
import MRISlice from "./MRISlice";
import { withReferenceOrigin } from "../reference-navigation.ts";
import "./imaging.css";
import "./activity-compare.css";

type Stage = "model" | "slices" | "split";
type Entry = {
  key: string;
  source: "meta" | "ibc" | "pathway";
  title: string;
  subtitle: string;
  category: string;
  search: (string | string[])[];
};
type Packed = { url: string; bytes: number; rawBytes: number; sha256: string };
type Studies = { lists: Record<string, number[]>; titles: Record<string, string> };

const pathways = pathwayData.pathways as Pathway[];
const lenses: Lens[] = ["overlap", "a", "b", "a-only", "b-only", "shared"];
const defaultA = "meta:reading",
  defaultB = "meta:watching-films";
const cameraViews = [
  ["left", "Left side", "both"],
  ["right", "Right side", "both"],
  ["medial-left", "Left inner", "left"],
  ["medial-right", "Right inner", "right"],
  ["superior", "Top", "both"],
  ["inferior", "Bottom", "both"],
  ["anterior", "Front", "both"],
  ["posterior", "Back", "both"],
] as const;
const baseView: ViewState = {
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
const compareDataset = {
  regions,
  compressedUrl: "/models/atlas.mesh",
  rawUrl: "/models/atlas.bin",
  distanceScale: 0.85,
};
const packedCache = new Map<string, Promise<ArrayBuffer>>();
async function loadPacked(asset: Packed) {
  const cached = packedCache.get(asset.url);
  if (cached) return cached;
  const pending = (async () => {
    if (!("DecompressionStream" in window))
      throw new Error(
        "This view needs a browser with native gzip support. Use a recent version of Chrome, Firefox, Safari, or Edge.",
      );
    const response = await fetch(assetUrl(asset.url));
    if (!response.ok || !response.body)
      throw new Error("An activity map could not be loaded. Please retry.");
    const buffer = await new Response(
      response.body.pipeThrough(new DecompressionStream("gzip")),
    ).arrayBuffer();
    if (buffer.byteLength !== asset.rawBytes)
      throw new Error("An activity map is incomplete. Please retry.");
    return buffer;
  })();
  packedCache.set(asset.url, pending);
  // Keep the label grid plus a few recent activity maps.
  if (packedCache.size > 6) {
    const oldest = [...packedCache.keys()].find(
      (key) => !key.endsWith("labels.volume"),
    );
    if (oldest) packedCache.delete(oldest);
  }
  try {
    return await pending;
  } catch (error) {
    packedCache.delete(asset.url);
    throw error;
  }
}
function usePacked(asset: Packed | undefined) {
  const [state, setState] = useState<{ url: string; buffer: ArrayBuffer } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let current = true;
    setError("");
    if (!asset) return;
    loadPacked(asset)
      .then((buffer) => current && setState({ url: asset.url, buffer }))
      .catch((reason) => current && setError(reason.message));
    return () => {
      current = false;
    };
  }, [asset?.url, attempt]);
  return {
    buffer: state && state.url === asset?.url ? state.buffer : null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}
function readHash() {
  const params = new URLSearchParams(location.hash.slice(1));
  const lens = params.get("lens") as Lens | null;
  const stage = params.get("stage") as Stage | null;
  return {
    a: parseKey(params.get("a")) ? params.get("a")! : defaultA,
    b: params.has("b")
      ? parseKey(params.get("b"))
        ? params.get("b")
        : null
      : defaultB,
    lens: lens && lenses.includes(lens) ? lens : "overlap",
    stage:
      stage === "slices" || stage === "split" || stage === "model"
        ? stage
        : "model",
    measure: (params.get("measure") === "specificity"
      ? "specificity"
      : "consistency") as Measure,
  };
}
const partName = (id: string) => {
  const region = regions.find((part) => part.id === id);
  return region ? region.name : id;
};
const partSide = (id: string) => {
  const region = regions.find((part) => part.id === id);
  return region ? hemisphereLabel(region.hemisphere) : "";
};

export default function ActivityCompare({
  referenceOrigin = null,
  onReturnReference,
  onSingleMaps,
}: {
  referenceOrigin?: string | null;
  onReturnReference?: () => void;
  onSingleMaps: () => void;
}) {
  const initial = useMemo(readHash, []);
  const [aKey, setAKey] = useState(initial.a);
  const [bKey, setBKey] = useState<string | null>(initial.b);
  const [lens, setLens] = useState<Lens>(initial.lens);
  const [stage, setStage] = useState<Stage>(initial.stage);
  const [measure, setMeasure] = useState<Measure>(initial.measure);
  const [strictness, setStrictness] = useState(0);
  const [opacity, setOpacity] = useState(0.85);
  const [picking, setPicking] = useState<"a" | "b" | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [point, setPoint] = useState<Point3 | null>(null);
  const [primary, setPrimary] = useState<Plane>("axial");
  const [view, setView] = useState("left");
  const [deep, setDeep] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState("");
  const [studies, setStudies] = useState<Studies | null>(null);
  const [studiesOpen, setStudiesOpen] = useState<string | null>(null);
  const activity = useJSON<ActivityManifest>("/activity/manifest.json");
  const imaging = useJSON<ImagingManifest>("/imaging/manifest.json");
  const manifest = activity.value;
  const labelsAsset = usePacked(manifest?.labels.asset);
  const labels = useMemo(
    () => (labelsAsset.buffer ? new Uint8Array(labelsAsset.buffer) : null),
    [labelsAsset.buffer],
  );
  const parts = manifest?.labels.parts ?? [];
  const matrix = manifest?.labels.mni305ToMni152;
  const grid = manifest?.grid;

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const item of manifest?.activities ?? [])
      list.push({
        key: `meta:${item.id}`,
        source: "meta",
        title: item.title,
        subtitle: `${item.studies} studies · meta-analysis`,
        category: item.category,
        search: [item.title, item.category, item.description, item.terms],
      });
    for (const item of pathways)
      list.push({
        key: `pathway:${item.id}`,
        source: "pathway",
        title: item.title,
        subtitle: "Literature pathway · not an activation map",
        category: item.category,
        search: [item.title, item.description, "blind vision v1"],
      });
    for (const item of imaging.value?.maps ?? [])
      list.push({
        key: `ibc:${item.id}`,
        source: "ibc",
        title: item.title,
        subtitle: `One person · vs. ${item.negative}`,
        category: "One person (IBC task contrasts)",
        search: [item.title, item.task, item.domain, item.negative, item.contrast],
      });
    return list;
  }, [manifest, imaging.value]);
  const entryFor = (key: string | null) =>
    key ? entries.find((item) => item.key === key) : undefined;
  const metaFor = (key: string | null): MetaActivity | undefined => {
    const parsed = parseKey(key);
    return parsed?.source === "meta"
      ? manifest?.activities.find((item) => item.id === parsed.id)
      : undefined;
  };
  const ibcFor = (key: string | null) => {
    const parsed = parseKey(key);
    return parsed?.source === "ibc"
      ? imaging.value?.maps.find((item) => item.id === parsed.id)
      : undefined;
  };
  const pathwayFor = (key: string | null) => {
    const parsed = parseKey(key);
    return parsed?.source === "pathway"
      ? pathways.find((item) => item.id === parsed.id)
      : undefined;
  };
  const metaA = metaFor(aKey),
    metaB = metaFor(bKey);
  const ibcA = ibcFor(aKey),
    ibcB = ibcFor(bKey);
  const packedA = usePacked(metaA?.asset);
  const packedB = usePacked(metaB?.asset);
  const volumeA = useVolume(ibcA?.asset);
  const volumeB = useVolume(ibcB?.asset);
  const voxels = grid ? grid.shape[0] * grid.shape[1] * grid.shape[2] : 0;

  function layerFor(
    key: string | null,
    meta: MetaActivity | undefined,
    packed: ArrayBuffer | null,
    ibc: Volume | null,
  ): Layer | null | undefined {
    if (!key) return null;
    const pathway = pathwayFor(key);
    if (pathway)
      return {
        kind: "regions",
        key,
        parts: new Set(
          pathway.roles.filter((r) => r.role === "route").flatMap((r) => r.parts),
        ),
      };
    if (meta && packed) {
      const maps = unpackActivity(packed, voxels);
      return {
        kind: "volume",
        key,
        values: maps[measure],
        threshold: (meta.maps[measure].cutoff ?? 0) + strictness,
        proportion: maps.proportion,
      };
    }
    if (ibc instanceof Int16Array)
      return { kind: "volume", key, values: ibc, threshold: 3 + strictness };
    return undefined;
  }
  const layerA = useMemo(
    () => layerFor(aKey, metaA, packedA.buffer, volumeA.data),
    [aKey, metaA, packedA.buffer, volumeA.data, measure, strictness, voxels],
  );
  const layerB = useMemo(
    () => layerFor(bKey, metaB, packedB.buffer, volumeB.data),
    [bKey, metaB, packedB.buffer, volumeB.data, measure, strictness, voxels],
  );
  const effectiveLens: Lens = bKey ? lens : "a";
  const ready = layerA !== undefined && layerB !== undefined && !!labels;
  const damaged = useMemo(
    () =>
      new Set(
        [pathwayFor(aKey), pathwayFor(bKey)]
          .filter((item): item is Pathway => !!item)
          .flatMap((item) =>
            item.roles.filter((r) => r.role === "damaged").flatMap((r) => r.parts),
          ),
      ),
    [aKey, bKey],
  );
  const scale = (layer: Layer | null | undefined, key: string | null) => {
    if (!layer || layer.kind === "regions") return 1;
    const meta = metaFor(key);
    if (meta) return meta.maps[measure].peakZ;
    return ibcFor(key)?.maxZ ?? 8;
  };
  const scaleA = scale(layerA, aKey),
    scaleB = scale(layerB, bKey);
  const stats = useMemo(
    () =>
      ready && labels
        ? regionStats(labels, parts, layerA ?? null, layerB ?? null)
        : [],
    [ready, labels, parts, layerA, layerB],
  );
  const ranked = useMemo(
    () =>
      stats
        .filter(
          (stat) =>
            lensFraction(stat, effectiveLens) > 0 &&
            !["White matter", "Ventricles"].includes(
              parts.find((p) => p.id === stat.id)?.group ?? "",
            ),
        )
        .sort(
          (x, y) =>
            lensFraction(y, effectiveLens) - lensFraction(x, effectiveLens),
        ),
    [stats, effectiveLens, parts],
  );

  // Keep the URL shareable.
  useEffect(() => {
    const params = new URLSearchParams({ view: "activities", a: aKey });
    params.set("b", bKey ?? "");
    params.set("lens", effectiveLens);
    params.set("stage", stage);
    if (measure !== "consistency") params.set("measure", measure);
    history.replaceState(
      null,
      "",
      withReferenceOrigin(`#${params}`, referenceOrigin),
    );
  }, [aKey, bKey, effectiveLens, stage, measure, referenceOrigin]);

  // The 3D model is created once and kept while switching stages.
  const modelRef = useRef<HTMLDivElement>(null);
  const viewer = useRef<AtlasViewer | null>(null);
  const viewState = useRef<ViewState>({ ...baseView });
  const pickRef = useRef<(id: string, display: number[]) => void>(() => {});
  useEffect(() => {
    if (!modelRef.current) return;
    try {
      viewer.current = new AtlasViewer(
        modelRef.current,
        {
          select: () => {},
          hover: () => {},
          ready: () => {
            setModelReady(true);
            viewer.current?.view("left");
          },
          error: setModelError,
          stats: () => {},
          detail: () => {},
          label: () => {},
          point: (id, display) => pickRef.current(id, display),
        },
        // The model fills a panel, not the whole screen, so the camera sits closer.
        compareDataset,
      );
      viewer.current.update(viewState.current);
    } catch {
      setModelError(
        "WebGL could not start, so the 3D model is unavailable. The MRI slices still show every comparison.",
      );
    }
    return () => {
      viewer.current?.dispose();
      viewer.current = null;
    };
  }, []);
  useEffect(() => {
    viewer.current?.setActive(stage !== "slices");
  }, [stage]);

  // Paint the comparison onto every surface vertex.
  useEffect(() => {
    if (!viewer.current || !ready || !grid || !matrix) return;
    const painter: Painter = (region, positions, normals) => {
      const count = positions.length / 3;
      const color = new Float32Array(count * 3);
      const weight = new Float32Array(count);
      const position = [0, 0, 0],
        normal = [0, 0, 0];
      const isDamaged = damaged.has(region.id);
      const outward = region.kind === "cortex" ? 1 : -1;
      for (let i = 0; i < count; i++) {
        for (let k = 0; k < 3; k++) {
          position[k] = positions[i * 3 + k];
          normal[k] = normals[i * 3 + k];
        }
        const a = surfaceSample(layerA ?? null, region.id, position, normal, grid, matrix, outward);
        const b = surfaceSample(layerB ?? null, region.id, position, normal, grid, matrix, outward);
        const shown = lensColor(effectiveLens, a, b, scaleA, scaleB);
        if (shown) {
          color[i * 3] = shown[0][0] / 255;
          color[i * 3 + 1] = shown[0][1] / 255;
          color[i * 3 + 2] = shown[0][2] / 255;
          weight[i] = shown[1];
        } else if (isDamaged) {
          color[i * 3] = color[i * 3 + 1] = color[i * 3 + 2] = 0.16;
          weight[i] = 0.8;
        }
      }
      return { color, weight };
    };
    viewer.current.setPainter(painter);
  }, [ready, layerA, layerB, effectiveLens, damaged, grid, matrix, scaleA, scaleB, modelReady]);

  // Clicks on the model choose a part and move the slice crosshair to that point.
  pickRef.current = (id, display) => {
    if (!grid || !matrix) return;
    const voxel = voxelAt(displayToMni152(display, matrix), grid);
    setSelected(id);
    if (voxel) setPoint(voxel);
    viewer.current?.setMarker(display as [number, number, number]);
  };
  function choosePoint(next: Point3) {
    setPoint(next);
    if (!labels || !grid || !matrix) return;
    const label = labels[voxelIndex(next, grid.shape)];
    setSelected(label ? parts[label - 1].id : null);
    viewer.current?.setMarker(mni152ToDisplay(worldPoint(next, grid), matrix));
  }
  function chooseRegion(id: string, voxel: number) {
    if (!grid || !matrix) return;
    const next = voxelPoint(voxel, grid.shape);
    setSelected(id);
    setPoint(next);
    viewer.current?.setMarker(mni152ToDisplay(worldPoint(next, grid), matrix));
    const region = regions.find((part) => part.id === id);
    if (region && stage !== "slices") {
      // Deep parts are revealed through see-through cortex; medial parcels from the inside.
      const side = region.hemisphere === "right" ? "right" : "left";
      const deepPart = region.kind !== "cortex";
      setDeep(deepPart);
      applyView(
        !deepPart && Math.abs(region.center[0]) < 22 ? `medial-${side}` : side,
        deepPart,
      );
    }
  }
  function applyView(name: string, seeThrough = deep) {
    const option = cameraViews.find(([id]) => id === name);
    viewState.current = {
      ...viewState.current,
      hemisphere: option?.[2] ?? "both",
      opacity: seeThrough ? 0.18 : 1,
    };
    viewer.current?.update(viewState.current);
    setView(name);
    const camera =
      name === "medial-left" ? "right" : name === "medial-right" ? "left" : name;
    viewer.current?.view(camera);
  }
  useEffect(() => {
    viewState.current = { ...viewState.current, selected };
    viewer.current?.update(viewState.current);
  }, [selected]);

  // Center the slices on the first peak whenever activity A changes.
  useEffect(() => {
    if (!grid) return;
    const meta = metaFor(aKey);
    const ibc = ibcFor(aKey);
    const peak = meta?.maps[measure].peakVoxel ?? ibc?.peakVoxel;
    if (peak) setPoint(peak as Point3);
    else if (!point) setPoint([48, 66, 45]);
  }, [aKey, grid, manifest, imaging.value]);

  const t1 = imaging.value?.scans.find((scan) => scan.id === "t1");
  const structural = useVolume(stage === "model" ? undefined : t1?.asset);
  const colorAt = useMemo(
    () =>
      labels
        ? (voxel: number) => {
            const label = labels[voxel];
            const part = label ? parts[label - 1].id : null;
            return lensColor(
              effectiveLens,
              layerValue(layerA ?? null, voxel, part),
              layerValue(layerB ?? null, voxel, part),
              scaleA,
              scaleB,
            );
          }
        : undefined,
    [labels, parts, layerA, layerB, effectiveLens, scaleA, scaleB],
  );
  const sliceOptions = useMemo(
    () => ({
      contrast: 1.1,
      threshold: 0,
      maximum: 8,
      opacity,
      polarity: "both" as const,
      backgroundGrid: t1?.grid,
      colorAt,
    }),
    [opacity, t1?.grid, colorAt],
  );

  const pointIndex = point && grid ? voxelIndex(point, grid.shape) : -1;
  const pointPart =
    pointIndex >= 0 && labels?.[pointIndex]
      ? parts[labels[pointIndex] - 1].id
      : null;
  const selectedStat = stats.find((stat) => stat.id === selected);
  const errors = [
    activity.error,
    imaging.error,
    labelsAsset.error,
    packedA.error,
    packedB.error,
    volumeA.error,
    volumeB.error,
  ].filter(Boolean);
  const entryA = entryFor(aKey),
    entryB = entryFor(bKey);
  const mixed =
    entryA && entryB && entryA.source !== entryB.source;
  const categories = [...new Set(entries.map((item) => item.category))];
  const matches = entries.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      matchesQuery(query, item.search),
  );

  function describeValue(key: string | null, layer: Layer | null | undefined) {
    if (!key || !layer || pointIndex < 0) return "—";
    if (layer.kind === "regions")
      return pointPart && layer.parts.has(pointPart)
        ? "In the highlighted pathway"
        : damaged.has(pointPart ?? "")
          ? "Damaged in blindsight"
          : "Outside the pathway";
    const z = layer.values[pointIndex] * 0.01;
    const proportion = layer.proportion
      ? Math.round(layer.proportion[pointIndex] / 2)
      : null;
    const active = z >= layer.threshold && z > 0;
    if (proportion !== null)
      return `${active ? `z ${z.toFixed(1)} · ` : "Not significant · "}${proportion}% of studies report a peak within 10 mm`;
    return `Z ${z.toFixed(2)}${active ? "" : " · below threshold"}`;
  }
  async function openStudies(id: string) {
    setStudiesOpen((current) => (current === id ? null : id));
    if (!studies) {
      try {
        const response = await fetch(assetUrl("/activity/studies.json"));
        if (response.ok) setStudies(await response.json());
      } catch {
        /* The study list is optional; the PubMed link remains available. */
      }
    }
  }
  function choose(key: string) {
    if (picking === "a") {
      setAKey(key);
      if (key === bKey) setBKey(null);
    } else {
      setBKey(key === aKey ? null : key);
      if (lens === "a") setLens("overlap");
    }
    setPicking(null);
    setQuery("");
  }

  const legend = [
    ["a-only", comparisonColors.a, entryA ? `Only ${entryA.title}` : "Only A"],
    ["shared", comparisonColors.shared, "Shared"],
    ["b-only", comparisonColors.b, entryB ? `Only ${entryB.title}` : "Only B"],
  ] as const;
  const volumeOf = (target: Lens) =>
    stats.length ? lensVolume(stats, target).toFixed(1) : "…";

  return (
    <main
      className="imaging-workspace activity-compare"
      aria-label="Compare brain activity"
    >
      <div className="imaging-heading">
        <div>
          {referenceOrigin && (
            <button className="reference-return" onClick={onReturnReference}>
              <ArrowLeft size={12} /> Back to reference note
            </button>
          )}
          <span className="eyebrow">COMPARE BRAIN ACTIVITY</span>
          <h1>What changes between two activities?</h1>
        </div>
        <button className="research-index-button" onClick={onSingleMaps}>
          <Layers size={14} />
          <span>Single-person task maps</span>
          <ArrowUpRight size={13} />
        </button>
      </div>
      <section className="compare-slots" aria-label="Activities to compare">
        {(["a", "b"] as const).map((side) => {
          const entry = side === "a" ? entryA : entryB;
          return (
            <div className={`compare-slot slot-${side}`} key={side}>
              <span className="slot-badge" aria-hidden="true">
                {side.toUpperCase()}
              </span>
              <button
                className="slot-choice"
                onClick={() => {
                  setPicking(side);
                  setQuery("");
                }}
                aria-label={`Choose activity ${side.toUpperCase()}${entry ? `, currently ${entry.title}` : ""}`}
              >
                <span>
                  {entry ? entry.title : side === "b" ? "Add a second activity" : "Choose an activity"}
                  <small>{entry?.subtitle ?? "Compare what they share and what differs"}</small>
                </span>
                {entry ? <ChevronDown size={14} /> : <Plus size={14} />}
              </button>
              {side === "b" && entry && (
                <button
                  className="slot-clear"
                  aria-label="Remove activity B"
                  onClick={() => {
                    setBKey(null);
                    setLens("a");
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          );
        })}
        <button
          className="slot-swap"
          disabled={!bKey}
          aria-label="Swap A and B"
          title="Swap A and B"
          onClick={() => {
            if (!bKey) return;
            setAKey(bKey);
            setBKey(aKey);
            setLens((current) =>
              current === "a"
                ? "b"
                : current === "b"
                  ? "a"
                  : current === "a-only"
                    ? "b-only"
                    : current === "b-only"
                      ? "a-only"
                      : current,
            );
          }}
        >
          <ArrowLeftRight size={15} />
        </button>
      </section>
      <div className="compare-toolbar">
        <div className="lens-switch" role="group" aria-label="What to show">
          {lenses
            .filter((item) => bKey || item === "a")
            .map((item) => (
              <button
                key={item}
                aria-pressed={effectiveLens === item}
                className={effectiveLens === item ? "active" : ""}
                onClick={() => setLens(item)}
              >
                <i className={`lens-swatch lens-${item}`} aria-hidden="true" />
                {item === "a" && entryA
                  ? bKey
                    ? `All ${entryA.title}`
                    : entryA.title
                  : item === "b" && entryB
                    ? `All ${entryB.title}`
                    : lensLabels[item]}
              </button>
            ))}
        </div>
        <div className="stage-switch" role="group" aria-label="View">
          {(
            [
              ["model", "3D brain", Box],
              ["slices", "MRI slices", Layers],
              ["split", "Side by side", ArrowLeftRight],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`${stage === id ? "active" : ""} stage-${id}`}
              aria-pressed={stage === id}
              onClick={() => setStage(id)}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>
      <div className="imaging-layout">
        <div className="scan-stage">
          {errors.length > 0 && (
            <div className="imaging-message" role="alert">
              <strong>Some comparison data could not load.</strong>
              <p>{errors[0]}</p>
              <button
                onClick={() => {
                  activity.retry();
                  imaging.retry();
                  labelsAsset.retry();
                  packedA.retry();
                  packedB.retry();
                  volumeA.retry();
                  volumeB.retry();
                }}
              >
                Retry
              </button>
            </div>
          )}
          <div className={`compare-stage stage-${stage}`}>
            <section
              className="compare-model"
              aria-label="3D brain colored by the comparison"
              hidden={stage === "slices"}
            >
              <div className="compare-model-canvas" ref={modelRef} />
              {(!modelReady || !ready) && !modelError && (
                <div className="compare-loading" role="status">
                  <LoaderCircle className="spin" size={22} />
                  {modelReady ? "Loading activity maps…" : "Loading the 3D brain…"}
                </div>
              )}
              {modelError && (
                <div className="compare-loading" role="alert">
                  {modelError}
                </div>
              )}
              <div className="model-view-controls">
                <select
                  aria-label="Model viewpoint"
                  value={view}
                  onChange={(event) => applyView(event.target.value)}
                >
                  {cameraViews.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  aria-pressed={deep}
                  className={deep ? "active" : ""}
                  onClick={() => {
                    setDeep(!deep);
                    applyView(view, !deep);
                  }}
                  title="Make the cortex see-through to reveal deep structures"
                >
                  {deep ? "Show cortex" : "See deep structures"}
                </button>
              </div>
            </section>
            {stage !== "model" && (
              <section className="compare-slices" aria-label="Linked MRI slices">
                {grid && structural.data && point ? (
                  <div className="linked-slices">
                    {[primary, ...planes.filter((plane) => plane !== primary)].map(
                      (plane, index) => (
                        <MRISlice
                          key={plane}
                          plane={plane}
                          primary={index === 0}
                          onFocus={() => setPrimary(plane)}
                          point={point}
                          onPoint={choosePoint}
                          grid={grid}
                          scan={structural.data!}
                          overlay={null}
                          options={sliceOptions}
                          crosshairs
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="imaging-message" role="status">
                    <LoaderCircle className="spin" size={22} />
                    <p>Loading the MRI template…</p>
                  </div>
                )}
              </section>
            )}
          </div>
          <div className="compare-legend" aria-label="Color key">
            {effectiveLens === "a" || effectiveLens === "b" ? (
              <span>
                <i
                  style={{
                    background:
                      effectiveLens === "a" ? comparisonColors.a : comparisonColors.b,
                  }}
                />
                {(effectiveLens === "a" ? entryA : entryB)?.title} · stronger
                evidence is more opaque
              </span>
            ) : (
              legend
                .filter(([id]) => effectiveLens === "overlap" || effectiveLens === id)
                .map(([id, color, label]) => (
                  <span key={id}>
                    <i style={{ background: color }} />
                    {label}
                  </span>
                ))
            )}
            {damaged.size > 0 && (
              <span>
                <i style={{ background: "#2a2a2a" }} />
                V1 · damaged in blindsight
              </span>
            )}
            <small>
              {stage === "slices"
                ? "Click a slice to move the crosshairs; the 3D marker follows."
                : "Click the brain to inspect a point; the slices follow."}
            </small>
          </div>
        </div>
        <aside className="imaging-inspector compare-inspector" aria-label="Comparison results">
          <div className="imaging-inspector-label">
            <span className="eyebrow">
              {bKey ? "WHAT THEY SHARE AND WHERE THEY DIFFER" : "WHERE IT IS ACTIVE"}
            </span>
          </div>
          {bKey ? (
            <div className="compare-totals">
              {legend.map(([id, color, label]) => (
                <button
                  key={id}
                  className={effectiveLens === id ? "active" : ""}
                  onClick={() => setLens(id)}
                >
                  <i style={{ background: color }} />
                  <span>{label}</span>
                  <strong>{volumeOf(id)} cm³</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="compare-totals">
              <button className="active">
                <i style={{ background: comparisonColors.a }} />
                <span>{entryA?.title}</span>
                <strong>{volumeOf("a")} cm³</strong>
              </button>
            </div>
          )}
          <p className="compare-volume-note">
            Volumes count labelled brain voxels (2 mm) in this model’s parts.
          </p>
          {point && grid && (
            <div className="compare-point">
              <h3>
                <Crosshair size={13} />
                {pointPart ? partName(pointPart) : "Outside labelled anatomy"}
                <small>
                  {pointPart ? `${partSide(pointPart)} · ` : ""}MNI{" "}
                  {worldPoint(point, grid).join(", ")}
                </small>
              </h3>
              <dl className="image-facts">
                <div>
                  <dt>
                    <i className="dot-a" /> {entryA?.title ?? "A"}
                  </dt>
                  <dd>{describeValue(aKey, layerA)}</dd>
                </div>
                {bKey && (
                  <div>
                    <dt>
                      <i className="dot-b" /> {entryB?.title ?? "B"}
                    </dt>
                    <dd>{describeValue(bKey, layerB)}</dd>
                  </div>
                )}
              </dl>
              {selectedStat && selected && (
                <p className="compare-part-summary">
                  {partName(selected)}: {Math.round((selectedStat.a / selectedStat.voxels) * 100)}% active in A
                  {bKey
                    ? `, ${Math.round((selectedStat.b / selectedStat.voxels) * 100)}% in B, ${Math.round((selectedStat.shared / selectedStat.voxels) * 100)}% in both`
                    : ""}
                  .
                </p>
              )}
            </div>
          )}
          <h3 className="compare-section-title">
            {effectiveLens === "overlap"
              ? "Parts with any activity"
              : `Parts: ${effectiveLens === "a" && entryA ? entryA.title : effectiveLens === "b" && entryB ? entryB.title : lensLabels[effectiveLens].toLowerCase()}`}
            <small>{ranked.length} parts</small>
          </h3>
          <div className="compare-region-list">
            {!ready && <p className="threshold-note">Loading maps…</p>}
            {ready && !ranked.length && (
              <p className="threshold-note">
                No labelled part has voxels in this view at the current threshold.
              </p>
            )}
            {ranked.slice(0, 12).map((stat) => {
              const pct = (value: number) =>
                `${Math.round((value / stat.voxels) * 100)}%`;
              return (
                <button
                  key={stat.id}
                  className={selected === stat.id ? "active" : ""}
                  onClick={() => chooseRegion(stat.id, stat.peakVoxel)}
                >
                  <span>
                    {partName(stat.id)}
                    <small>{partSide(stat.id)}</small>
                  </span>
                  <span className="region-bars" aria-label={`${pct(stat.a)} active in A${bKey ? `, ${pct(stat.b)} in B` : ""}`}>
                    <i className="bar-a" style={{ width: pct(stat.a) }} />
                    {bKey && <i className="bar-b" style={{ width: pct(stat.b) }} />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="imaging-adjustments">
            {(metaA || metaB) && (
              <label>
                Meta-analysis map
                <select
                  aria-label="Meta-analysis map"
                  value={measure}
                  onChange={(event) => setMeasure(event.target.value as Measure)}
                >
                  <option value="consistency">Consistently reported</option>
                  <option value="specificity">More likely than in other studies</option>
                </select>
              </label>
            )}
            <label>
              Stricter threshold <strong>+{strictness.toFixed(1)} z</strong>
              <input
                aria-label="Raise the activation threshold"
                type="range"
                min={0}
                max={6}
                step={0.5}
                value={strictness}
                onChange={(event) => setStrictness(Number(event.target.value))}
              />
            </label>
            {stage !== "model" && (
              <label>
                Slice overlay opacity <strong>{Math.round(opacity * 100)}%</strong>
                <input
                  aria-label="Slice overlay opacity"
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={opacity}
                  onChange={(event) => setOpacity(Number(event.target.value))}
                />
              </label>
            )}
            <p className="threshold-note">
              {measure === "consistency"
                ? "“Consistently reported” shows where studies of the activity report activation more often than across the brain overall."
                : "“More likely than in other studies” shows where activation is reported more often for this activity than in the rest of the literature."}{" "}
              Meta-analysis maps start at their FDR-corrected cutoff (q &lt; 0.01);
              one-person maps start at Z ≥ 3, uncorrected.
            </p>
          </div>
          <div className="compare-evidence">
            {[
              [aKey, entryA, "a"],
              [bKey, entryB, "b"],
            ].map(([key, entry, side]) => {
              if (!key || !entry) return null;
              const e = entry as Entry;
              const meta = metaFor(key as string);
              const ibc = ibcFor(key as string);
              const pathway = pathwayFor(key as string);
              return (
                <details key={side as string} open={!!pathway}>
                  <summary>
                    <i className={`dot-${side}`} />
                    About {e.title}
                  </summary>
                  {meta && (
                    <>
                      <p>{meta.description}</p>
                      <p className="image-note">
                        Coordinate-based meta-analysis of {meta.studies} studies whose
                        title, abstract, or keywords mention{" "}
                        {meta.terms.map((t) => `“${t}”`).join(", ")}. It uses every
                        coordinate those papers report, not only the matching
                        experiment.
                      </p>
                      <button
                        className="peak-button"
                        onClick={() => choosePoint(meta.maps[measure].peakVoxel)}
                      >
                        <Crosshair size={13} /> Jump to strongest evidence
                        <small>z {meta.maps[measure].peakZ.toFixed(1)}</small>
                      </button>
                      <button
                        className="peak-button"
                        onClick={() => void openStudies(meta.id)}
                        aria-expanded={studiesOpen === meta.id}
                      >
                        <BookOpen size={13} /> Studies in this map
                        <small>{meta.studies}</small>
                      </button>
                      {studiesOpen === meta.id && (
                        <ul className="compare-study-list">
                          {!studies && <li>Loading study titles…</li>}
                          {studies?.lists[meta.id]?.map((pmid) => (
                            <li key={pmid}>
                              <a
                                href={`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {studies.titles[pmid] ?? `PubMed ${pmid}`}
                                <ArrowUpRight size={11} />
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                  {ibc && (
                    <>
                      <p>
                        {ibc.positive} compared with {ibc.negative}, measured in one
                        Individual Brain Charting participant ({ibc.participant},{" "}
                        {ibc.task}).
                      </p>
                      <p className="image-note">
                        Only the positive direction of the contrast is compared. A
                        single person's map is not a population average.
                      </p>
                      <a className="peak-button" href={ibc.source} target="_blank" rel="noreferrer">
                        <ExternalLink size={13} /> Original map on NeuroVault
                      </a>
                    </>
                  )}
                  {pathway && (
                    <>
                      <p>{pathway.summary}</p>
                      {pathway.roles.map((role) => (
                        <div className="pathway-role" key={role.label}>
                          <strong className={`role-${role.role}`}>{role.label}</strong>
                          <p>{role.text}</p>
                          <div className="pathway-parts">
                            {role.parts.map((id) => (
                              <button
                                key={id}
                                onClick={() => {
                                  const stat = stats.find((s) => s.id === id);
                                  if (stat) chooseRegion(id, stat.peakVoxel);
                                }}
                              >
                                {partName(id)} · {partSide(id)}
                              </button>
                            ))}
                          </div>
                          <p className="pathway-sources">
                            {role.sources.map((source) => (
                              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                                {source.label}
                                <ArrowUpRight size={10} />
                              </a>
                            ))}
                          </p>
                        </div>
                      ))}
                      <p className="image-note">{pathway.caution}</p>
                    </>
                  )}
                </details>
              );
            })}
          </div>
          <p className="image-note compare-caution">
            {mixed
              ? "These two sides use different kinds of evidence, so overlap is only a rough guide. "
              : ""}
            “Only A” means B did not reach its threshold there, not that B leaves it
            inactive. Activities with more studies reach significance more easily.
            The corpus treats every reported coordinate as MNI, although some
            studies use Talairach space. The 3D model is fsaverage, mapped with
            FreeSurfer’s MNI305-to-MNI152 transform, so locations are approximate.
          </p>
          <a
            className="manifest-link"
            href={assetUrl("/activity/manifest.json")}
            target="_blank"
            rel="noreferrer"
          >
            Method, sources & checksums <ArrowUpRight size={12} />
          </a>
        </aside>
      </div>
      {picking && (
        <section
          className="activity-chooser compare-chooser"
          aria-label={`Choose activity ${picking.toUpperCase()}`}
        >
          <div className="activity-chooser-heading">
            <div>
              <span className="eyebrow">ACTIVITY {picking.toUpperCase()}</span>
              <h2>Choose what the brain is doing.</h2>
            </div>
            <button aria-label="Close activity list" onClick={() => setPicking(null)}>
              <X size={18} />
            </button>
          </div>
          <div className="activity-search">
            <Search size={15} />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setPicking(null);
              }}
              placeholder="Search music, anger, reading, blindsight…"
              aria-label="Search activities"
            />
          </div>
          <select
            aria-label="Filter by category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <div className="activity-results-count" role="status">
            {matches.length} activities
          </div>
          <div className="activity-map-list">
            {categories.map((group) => {
              const items = matches.filter((item) => item.category === group);
              if (!items.length) return null;
              return (
                <div key={group} className="compare-chooser-group">
                  <div className="compare-chooser-label">{group}</div>
                  {items.map((item) => (
                    <button
                      key={item.key}
                      className={
                        item.key === (picking === "a" ? aKey : bKey) ? "active" : ""
                      }
                      onClick={() => choose(item.key)}
                    >
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.subtitle}</small>
                      </span>
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
                </div>
              );
            })}
            {!matches.length && (
              <p className="no-imaging-results">
                No matching activities. Try a broader word, such as emotion or
                language.
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
