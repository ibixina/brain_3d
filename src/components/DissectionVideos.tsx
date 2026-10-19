import { useState } from "react";
import { ArrowUpRight, Clock3, Film, Play, Search, X } from "lucide-react";
import type { Region } from "../data";
import {
  dissectionVideos,
  filterVideos,
  regionVideoNote,
  relevanceLabel,
  videoProviders,
  videoTopics,
  videosForRegion,
  type DissectionVideo,
  type VideoMatch,
} from "../videos";

function VideoCard({
  video,
  relevance,
  compact = false,
}: {
  video: DissectionVideo;
  relevance?: VideoMatch["relevance"];
  compact?: boolean;
}) {
  const provider = videoProviders[video.provider];
  const Heading = compact ? "h4" : "h3";
  return (
    <article className={`film-card ${compact ? "compact" : ""}`}>
      <div className="film-card-top">
        <span className="film-provider">{provider.name}</span>
        {video.minutes && (
          <span className="film-duration">
            <Clock3 size={10} />~{video.minutes} min
          </span>
        )}
      </div>
      <a
        className="film-title"
        href={video.url}
        target="_blank"
        rel="noreferrer"
      >
        <span className="film-play">
          <Play size={12} />
        </span>
        <Heading>{video.title}</Heading>
        <ArrowUpRight size={13} />
      </a>
      <div className="film-badges">
        {relevance && (
          <span className={`relevance-${relevance}`}>
            {relevanceLabel[relevance]}
          </span>
        )}
        <span>{video.format}</span>
      </div>
      <p>{video.description}</p>
      <div className="film-actions">
        <a
          href={video.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Watch ${video.title} — ${provider.name} on YouTube`}
        >
          Watch on YouTube <ArrowUpRight size={11} />
        </a>
        <a
          href={provider.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${provider.name} publisher catalogue`}
        >
          Source <ArrowUpRight size={10} />
        </a>
      </div>
    </article>
  );
}

export function RegionVideos({
  region,
  openLibrary,
}: {
  region: Region;
  openLibrary: () => void;
}) {
  const matches = videosForRegion(region);
  return (
    <section
      className="region-videos"
      aria-label={`Dissection videos for ${region.name}`}
    >
      <div className="film-section-heading">
        <Film size={15} />
        <h3>FROM MODEL TO SPECIMEN</h3>
      </div>
      <p className="film-context">{regionVideoNote(region)}</p>
      <div className="film-match-key">
        <span>Structure focus</span> names the structure;{" "}
        <span>System focus</span> covers its system;{" "}
        <span>Broader context</span> gives surrounding anatomy.
      </div>
      <div className="region-film-list">
        {matches.map(({ video, relevance }) => (
          <VideoCard
            key={video.id}
            video={video}
            relevance={relevance}
            compact
          />
        ))}
      </div>
      <button className="film-library-link" onClick={openLibrary}>
        Browse all {dissectionVideos.length} teaching films{" "}
        <ArrowUpRight size={13} />
      </button>
      <p className="film-check-note">
        Human specimens, sometimes alongside models, diagrams, and clinical
        examples. Links open at the beginning; no region timestamps are assumed.
      </p>
    </section>
  );
}

export function VideoLibrary() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [provider, setProvider] = useState("all");
  const matches = filterVideos({ query, topic, provider });
  return (
    <div className="video-library">
      <h2>
        From model
        <br />
        to real anatomy.
      </h2>
      <p className="dialog-intro">
        Explore {dissectionVideos.length} teaching films from the University of
        Utah and UBC. Lessons use human brain specimens and may also include
        sections, models, diagrams, or clinical demonstrations.
      </p>
      <div className="film-library-controls">
        <div className="film-search">
          <Search size={15} />
          <input
            aria-label="Search dissection videos"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anatomy or a lesson…"
          />
          {query && (
            <button
              aria-label="Clear video search"
              onClick={() => setQuery("")}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <select
          aria-label="Filter videos by topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
        >
          <option value="all">All anatomy</option>
          {videoTopics.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          aria-label="Filter videos by institution"
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="all">Both institutions</option>
          {Object.entries(videoProviders).map(([key, value]) => (
            <option key={key} value={key}>
              {value.name}
            </option>
          ))}
        </select>
      </div>
      <div className="film-results-count" role="status">
        {matches.length} {matches.length === 1 ? "film" : "films"}
      </div>
      <div className="film-catalogue-grid">
        {matches.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
      {!matches.length && (
        <div className="film-empty">
          <Film size={25} />
          <strong>No matching films.</strong>
          <p>
            Try a broader structure, clear the search, or change the filters.
          </p>
          <button
            onClick={() => {
              setQuery("");
              setTopic("all");
              setProvider("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="film-library-sources">
        <h3>THE TEACHING COLLECTIONS</h3>
        {Object.entries(videoProviders).map(([key, source]) => (
          <a key={key} href={source.sourceUrl} target="_blank" rel="noreferrer">
            <span>
              <strong>{source.name}</strong>
              <small>
                {source.collection} · {source.presenter}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </a>
        ))}
      </div>
      <p className="film-check-note">
        Institutional catalogue links and YouTube titles/channel metadata
        checked October 18, 2026. Full playback and timestamps have not been
        audited. Region matches are curated; specimen laterality and atlas
        boundaries may differ. Videos stay on their publishers’ channels.
      </p>
    </div>
  );
}
