import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Link,
  Search,
  X,
} from "lucide-react";
import { hemisphereLabel, regions } from "../data";
import {
  referenceArticles,
  referenceCheckedOn,
  referenceExplorations,
  referenceSources,
  searchReference,
} from "../reference";
import "./reference.css";

export default function ReferenceLibrary({
  articleId,
  onOpen,
  onRegion,
}: {
  articleId: string | null;
  onOpen: (id: string | null) => void;
  onRegion: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousArticle = useRef(articleId);
  const article = referenceArticles.find((item) => item.id === articleId);
  const articles = searchReference(query);
  const explorations = article ? referenceExplorations(article) : [];
  useEffect(() => {
    contentRef.current?.scrollTo(0, 0);
    if (articleId && !document.activeElement?.closest('[role="tablist"]'))
      contentRef.current?.querySelector<HTMLElement>("h2")?.focus();
    else if (!articleId && previousArticle.current) searchRef.current?.focus();
    previousArticle.current = articleId;
    setMessage("");
  }, [articleId]);
  async function share() {
    try {
      await navigator.clipboard.writeText(location.href);
      setMessage("Reference link copied");
    } catch {
      setMessage("Copy the address bar to share this note");
    }
  }
  if (article)
    return (
      <>
        <div className="reference-actions">
          <button onClick={() => onOpen(null)}>
            <ArrowLeft size={14} /> All reference notes
          </button>
          <button
            onClick={share}
            aria-label="Copy reference link"
            title="Copy reference link"
          >
            <Link size={14} />
          </button>
        </div>
        <div className="reference-content" ref={contentRef}>
          <article aria-label={article.title}>
            <span className="eyebrow">{article.category}</span>
            <h2 tabIndex={-1}>{article.title}</h2>
            <p className="reference-summary">{article.summary}</p>
            {article.comparison && (
              <button
                className="reference-jump"
                onClick={() => {
                  const caption =
                    contentRef.current?.querySelector<HTMLElement>(
                      ".reference-comparison caption",
                    );
                  caption?.focus({ preventScroll: true });
                  caption?.scrollIntoView({ block: "start" });
                }}
              >
                Jump to comparison <ArrowDown size={12} />
              </button>
            )}
            {article.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            <div className="reference-scope">
              <strong>In this atlas</strong>
              <p>{article.scope}</p>
            </div>
            {article.comparison && (
              <table className="reference-comparison">
                <caption tabIndex={-1}>{article.comparison.caption}</caption>
                <thead>
                  <tr>
                    {article.comparison.columns.map((column) => (
                      <th key={column} scope="col">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {article.comparison.rows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>
                        <span>{row.summary}</span>
                        <p>{row.detail}</p>
                        <a
                          href={referenceSources[row.source].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Source for ${row.label}`}
                        >
                          Source <ArrowUpRight size={10} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h3>Explore the related anatomy</h3>
            <p className="reference-caption">
              Open a modeled region in the brain.
            </p>
            <div className="reference-region-links">
              {article.regions.map((id) => {
                const region = regions.find((item) => item.id === id)!;
                return (
                  <button key={id} onClick={() => onRegion(id)}>
                    <span>
                      {region.name}
                      <small>{hemisphereLabel(region.hemisphere)}</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                );
              })}
            </div>
            {explorations.length > 0 && (
              <>
                <h3>Continue exploring</h3>
                <div className="reference-explorations">
                  {explorations.map((item) => (
                    <a
                      key={`${item.kind}-${item.id}`}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                    >
                      <small>{item.label}</small>
                      <strong>
                        {item.title}
                        {item.external ? (
                          <ArrowUpRight size={13} />
                        ) : (
                          <ArrowRight size={13} />
                        )}
                      </strong>
                      <span>{item.note}</span>
                    </a>
                  ))}
                </div>
              </>
            )}
            <h3>Sources & further reading</h3>
            <div className="reference-sources">
              {article.sources.map((id) => {
                const source = referenceSources[id];
                return (
                  <a
                    key={id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <BookOpen size={13} />
                    <span>
                      {source.title}
                      <small>{source.kind}</small>
                    </span>
                    <ArrowUpRight size={12} />
                  </a>
                );
              })}
            </div>
            <p className="reference-caption">
              Checked {referenceCheckedOn}. Original summaries; linked sources
              retain their own rights. This is a curated starting point, not a
              continuously updated literature review.
            </p>
            <h3>Keep reading</h3>
            <div className="reference-related">
              {article.related.map((id) => (
                <button key={id} onClick={() => onOpen(id)}>
                  {referenceArticles.find((item) => item.id === id)!.title}
                  <ArrowRight size={12} />
                </button>
              ))}
            </div>
          </article>
        </div>
        <span className="reference-status" role="status">
          {message}
        </span>
      </>
    );
  return (
    <>
      <div className="search-box">
        <Search size={16} />
        <input
          ref={searchRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Layers, neurons, anatomical terms…"
          aria-label="Search reference notes"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear reference search"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="reference-content" ref={contentRef}>
        <p className="reference-intro">
          From the whole brain to its cells. Short, sourced notes explain the
          terms behind the anatomy and the limits of each view.
        </p>
        {articleId && (
          <p className="reference-intro" role="status">
            That reference note is unavailable. Choose one below.
          </p>
        )}
        <p className="reference-caption" role="status">
          {articles.length} {query ? "matching" : "reference"}{" "}
          {articles.length === 1 ? "note" : "notes"}
        </p>
        {articles.map((item) => (
          <button
            className="reference-card"
            key={item.id}
            onClick={() => onOpen(item.id)}
          >
            <span>{item.category}</span>
            <strong>
              {item.title}
              <ArrowRight size={14} />
            </strong>
            <p>{item.summary}</p>
          </button>
        ))}
        {!articles.length && (
          <p className="reference-intro">
            No matching notes. Try “myelin”, “layers”, or “sagittal”.
          </p>
        )}
      </div>
    </>
  );
}
