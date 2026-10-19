import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ChevronDown, Download, Search, X } from "lucide-react";
import { matchesQuery } from "../imaging";
import type { ImagingManifest, ProtocolIndex } from "../imaging";
import { useJSON } from "../useImagingData";
import { assetUrl } from "../asset-url.ts";
import {
  datasets,
  interpretationSources,
  modalities,
} from "../imaging-resources";

export default function ImagingResearch({
  manifest,
  onClose,
}: {
  manifest: ImagingManifest | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const {
    value: index,
    error,
    retry,
  } = useJSON<ProtocolIndex>("/imaging/protocols.json");
  const [tab, setTab] = useState("overview");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(60);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  useEffect(() => {
    setLimit(60);
    ref.current?.scrollTo(0, 0);
  }, [query, tab]);
  const protocolMatches =
    index?.protocols.filter((item) =>
      matchesQuery(query, [
        item.title,
        item.domains,
        ...item.contrasts.map((c) => c.id),
      ]),
    ) ?? [];
  const contrastMatches =
    index?.contrasts.filter((item) =>
      matchesQuery(query, [
        item.task || "",
        item.id,
        item.positive,
        item.negative,
        item.tags,
      ]),
    ) ?? [];
  const hcpMatches =
    index?.hcp.filter((item) =>
      matchesQuery(query, [item.name, item.contrast || ""]),
    ) ?? [];
  const datasetMatches = datasets.filter((item) =>
    matchesQuery(query, [
      item.name,
      item.category,
      item.description,
      item.modalities,
    ]),
  );
  const modalityMatches = modalities.filter((item) =>
    matchesQuery(query, [item.name, item.kind, item.measures, item.use]),
  );
  return (
    <dialog
      ref={ref}
      className="atlas-dialog imaging-research-dialog"
      aria-label="Brain imaging research compilation"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dialog-header">
        <span className="eyebrow">BRAIN IMAGING · RESEARCH COMPILATION</span>
        <button aria-label="Close research compilation" onClick={onClose}>
          <X size={19} />
        </button>
      </div>
      <h2>Scans, tasks & evidence.</h2>
      <p className="dialog-intro">
        A dated, sourced guide to imaging methods, datasets, and experimental
        contrasts. Locally viewable images are explicitly marked; linked
        collections remain with their providers.
      </p>
      <div
        className="research-tabs"
        role="tablist"
        aria-label="Research categories"
      >
        {[
          ["overview", "Overview"],
          ["modalities", `Methods ${modalities.length}`],
          ["datasets", `Datasets ${datasets.length}`],
          ["protocols", `Protocols ${index?.protocols.length ?? 87}`],
          ["contrasts", `Contrasts ${index?.contrasts.length ?? 799}`],
          ["hcp", `HCP ${index?.hcp.length ?? 48}`],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => {
              setTab(id);
              setQuery("");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "overview" ? (
        <div className="research-overview">
          <div className="research-counts">
            <div>
              <strong>3</strong>
              <span>MRI template contrasts</span>
            </div>
            <div>
              <strong>{manifest?.maps.length ?? 117}</strong>
              <span>local measured Z maps</span>
            </div>
            <div>
              <strong>{index?.protocols.length ?? 87}</strong>
              <span>documented task protocols</span>
            </div>
          </div>
          <h3>What is actually included</h3>
          <p>
            Three MNI/ICBM152 population MRI templates: T1, T2, and proton
            density. The activation viewer includes one example of every
            distinct contrast available for participant sub-01 in IBC NeuroVault
            collection 4438, deduplicated by contrast name using the earliest
            image ID. These {manifest?.maps.length ?? 117} images span 12 task
            paradigms. Other participants and repeated uploads are not bundled.
          </p>
          <h3>The wider compilation</h3>
          <p>
            The index contains all {index?.protocols.length ?? 87} protocols
            documented on the IBC task page and all{" "}
            {index?.contrasts.length ?? 799} rows in its public contrast table
            at the recorded snapshot. Some protocol variants share contrast
            definitions. The 48 archived HCP maps are external references to a
            separate cohort, with provider terms. They are not the local IBC
            examples. The 20 dataset entries extend discovery to natural scenes,
            music, movies, games, lifespan imaging, electrophysiology, and
            molecular imaging.
          </p>
          <h3>How to read an activation map</h3>
          <p>
            A contrast compares conditions A and B. Warm colors show larger
            modeled BOLD responses for A; cool colors show the reverse. Z values
            are statistical evidence under the analysis model, not a percentage
            of brain activity. They do not establish that a region uniquely
            causes a behavior. An empty voxel can reflect thresholding, limited
            coverage, or a small effect.
          </p>
          <h3>Processing & limits</h3>
          <p>
            {manifest?.processing} The backgrounds retain 1 mm sampling; maps
            and crosshair coordinates use a shared RAS+ grid at 2 mm. Display
            values have been reduced for efficient viewing. MNI template
            variants and individual anatomy differ; no registration to the
            separate 3D surface atlas is claimed. The threshold slider applies
            no multiple-comparison correction. No raw BOLD time series is
            bundled, and the maps do not show activity evolving in time.
          </p>
          <h3>Coverage and date</h3>
          <p>
            Checked October 18, 2026. This is a broad compilation with complete
            coverage of the stated source snapshots, not every scan or finding
            ever published. No private scans or access-controlled datasets were
            downloaded. Provider releases, access rules, and scientific
            conclusions can change.
          </p>
          <div className="research-downloads">
            <a href={assetUrl("/imaging/IMAGING_RESEARCH.md")} download>
              <Download size={14} />
              Research notes
            </a>
            <a href={assetUrl("/imaging/protocols.json")} download>
              <Download size={14} />
              Full research index · JSON
            </a>
            <a href={assetUrl("/imaging/ibc-contrasts.tsv")} download>
              <Download size={14} />
              799 contrasts · TSV
            </a>
            <a href={assetUrl("/imaging/manifest.json")} download>
              <Download size={14} />
              Image provenance
            </a>
          </div>
          <div className="research-references">
            {interpretationSources.map((source) => (
              <a
                key={source.url}
                href={source.url}
                target="_blank"
                rel="noreferrer"
              >
                {source.name}
                <ArrowUpRight size={12} />
              </a>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="activity-search research-search">
            <Search size={15} />
            <input
              aria-label="Search research compilation"
              placeholder="Search this research section…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          {error && (
            <div role="alert">
              {error}
              <button onClick={retry}>Retry</button>
            </div>
          )}
          {!index &&
            !error &&
            ["protocols", "contrasts", "hcp"].includes(tab) && (
              <p className="research-loading">Loading the research index…</p>
            )}
          {tab === "modalities" && (
            <>
              <p className="research-result-count">
                {modalityMatches.length} imaging and recording methods
              </p>
              <div className="research-card-grid">
                {modalityMatches.map((item) => (
                  <article className="research-card" key={item.id}>
                    <div className="research-card-kicker">
                      {item.kind}
                      <span>
                        {item.local ? "Local example" : "Guide & source"}
                      </span>
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.measures}</p>
                    <p>{item.use}</p>
                    <small>{item.limit}</small>
                    <a href={item.source} target="_blank" rel="noreferrer">
                      Read the source
                      <ArrowUpRight size={12} />
                    </a>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "datasets" && (
            <>
              <p className="research-result-count">
                {datasetMatches.length} dataset and repository resources
              </p>
              <div className="research-card-grid">
                {datasetMatches.map((item) => (
                  <article className="research-card" key={item.name}>
                    <div className="research-card-kicker">
                      {item.category}
                      <span>
                        {item.local ? "Local derivative" : "External resource"}
                      </span>
                    </div>
                    <h3>{item.name}</h3>
                    <p>{item.description}</p>
                    <div className="research-tags">
                      {item.modalities.map((value) => (
                        <span key={value}>{value}</span>
                      ))}
                    </div>
                    <small>Access: {item.access}</small>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      Visit the dataset
                      <ArrowUpRight size={12} />
                    </a>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "protocols" && (
            <>
              <p className="research-result-count">
                {protocolMatches.length} task protocols · experimental
                paradigms, not unique everyday activities
              </p>
              <div className="research-protocol-list">
                {protocolMatches.slice(0, limit).map((item) => (
                  <details key={item.id}>
                    <summary>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.domains.slice(0, 4).join(" · ")}</small>
                      </span>
                      <span>{item.contrasts.length || "—"} contrasts</span>
                      <ChevronDown size={14} />
                    </summary>
                    <div>
                      <p>{item.domains.join(" · ")}</p>
                      <a href={item.source} target="_blank" rel="noreferrer">
                        Read full protocol, conditions & demonstrations
                        <ArrowUpRight size={12} />
                      </a>
                      {item.contrasts.length ? (
                        <ul>
                          {item.contrasts.map((c, i) => (
                            <li key={c.id + i}>
                              <strong>{c.id}</strong>
                              <span>
                                {c.positive} <b>versus</b> {c.negative}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>
                          No matching contrast row in this table snapshot.
                          Consult the protocol’s conditions and associated
                          release.
                        </p>
                      )}
                    </div>
                  </details>
                ))}
              </div>
            </>
          )}
          {tab === "contrasts" && (
            <>
              <p className="research-result-count">
                {contrastMatches.length} contrast definitions · protocol
                metadata, not {contrastMatches.length} bundled maps
              </p>
              <div className="research-contrast-list">
                {contrastMatches.slice(0, limit).map((item, i) => (
                  <article key={item.task + item.id + i}>
                    <span>{item.task}</span>
                    <h3>{item.id}</h3>
                    <p>
                      <b>A</b>
                      {item.positive}
                      <b>B</b>
                      {item.negative}
                    </p>
                    <small>
                      {item.tags.map((t) => t.replaceAll("_", " ")).join(" · ")}
                    </small>
                    <a
                      href="https://github.com/individual-brain-charting/public_analysis_code/blob/2d9a6852bc7e3b164adef28b02b4d38d386c53ac/ibc_data/all_contrasts.tsv"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Definition table
                      <ArrowUpRight size={11} />
                    </a>
                  </article>
                ))}
              </div>
            </>
          )}
          {tab === "hcp" && (
            <>
              <p className="image-note hcp-note">
                These archived group-level HCP reference maps report 486
                participants. Access and reuse follow the collection’s HCP
                terms. They open at NeuroVault; the local viewer uses IBC data
                from a different sample.
              </p>
              <p className="research-result-count">
                {hcpMatches.length} archived map references
              </p>
              <div className="research-contrast-list">
                {hcpMatches.slice(0, limit).map((item) => (
                  <article key={item.id}>
                    <span>
                      {item.statistic} · {item.subjects} participants
                    </span>
                    <h3>
                      {item.name.replace("tfMRI ", "").replace(" zstat1", "")}
                    </h3>
                    {item.contrast && <p>{item.contrast}</p>}
                    <a href={item.source} target="_blank" rel="noreferrer">
                      Open original map
                      <ArrowUpRight size={12} />
                    </a>
                  </article>
                ))}
              </div>
              <a
                className="hcp-collection-link"
                href="https://neurovault.org/collections/457/"
                target="_blank"
                rel="noreferrer"
              >
                Collection methods and data-use terms
                <ArrowUpRight size={13} />
              </a>
            </>
          )}
          {((tab === "protocols" && protocolMatches.length > limit) ||
            (tab === "contrasts" && contrastMatches.length > limit) ||
            (tab === "hcp" && hcpMatches.length > limit)) && (
            <button
              className="show-more-research"
              onClick={() => setLimit((n) => n + 60)}
            >
              Show 60 more
            </button>
          )}
          {((tab === "protocols" && !protocolMatches.length) ||
            (tab === "contrasts" && !contrastMatches.length) ||
            (tab === "hcp" && !hcpMatches.length) ||
            (tab === "datasets" && !datasetMatches.length) ||
            (tab === "modalities" && !modalityMatches.length)) && (
            <p className="no-imaging-results">
              No matches. Try a different search.
            </p>
          )}
        </>
      )}
    </dialog>
  );
}
