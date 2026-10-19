import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowDown,
  ArrowUp,
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
import {
  captureReadingPosition,
  ReferenceReadingMemory,
  restoreReadingOffset,
} from "../reference-reading";
import "./reference.css";

const readingMemory = new ReferenceReadingMemory();
function readingElements(content: HTMLElement) {
  return [...content.querySelectorAll<HTMLElement>("[data-reading-id]")];
}
function readingAnchors(content: HTMLElement) {
  const top = content.getBoundingClientRect().top;
  return readingElements(content).map((element) => ({
    id: element.dataset.readingId!,
    top: element.getBoundingClientRect().top - top + content.scrollTop,
  }));
}

export default function ReferenceLibrary({
  articleId,
  onOpen,
  onRegion,
}: {
  articleId: string | null;
  onOpen: (id: string | null) => void;
  onRegion: (id: string) => void;
}) {
  const [query, setQuery] = useState(() => readingMemory.query);
  const [message, setMessage] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousArticle = useRef(articleId);
  const scrollFrame = useRef(0);
  const persistTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const article = referenceArticles.find((item) => item.id === articleId);
  const articles = searchReference(query);
  const explorations = article ? referenceExplorations(article) : [];
  const readingId = article?.id ?? "library";
  function savePosition() {
    const content = contentRef.current;
    if (!content) return;
    const focused =
      document.activeElement instanceof HTMLElement &&
      content.contains(document.activeElement)
        ? (document.activeElement.closest<HTMLElement>("[data-reading-id]")
            ?.dataset.readingId ?? null)
        : null;
    readingMemory.set(
      readingId,
      captureReadingPosition(
        content.scrollTop,
        readingAnchors(content),
        focused,
      ),
    );
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => readingMemory.persist(), 180);
  }
  function queuePosition() {
    if (scrollFrame.current) return;
    scrollFrame.current = requestAnimationFrame(() => {
      scrollFrame.current = 0;
      savePosition();
    });
  }
  function changeQuery(value: string) {
    const nextQuery = value.slice(0, 160);
    setQuery(nextQuery);
    readingMemory.query = nextQuery;
    readingMemory.set("library", captureReadingPosition(0, []));
    contentRef.current?.scrollTo(0, 0);
    readingMemory.persist();
  }
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const saved = readingMemory.get(readingId);
    content.scrollTop = saved
      ? restoreReadingOffset(
          saved,
          readingAnchors(content),
          content.scrollHeight - content.clientHeight,
        )
      : 0;
    const canFocus = !document.activeElement?.closest('[role="tablist"]');
    if (canFocus && (article || previousArticle.current)) {
      const elements = readingElements(content);
      const focused = elements.find(
        (element) => element.dataset.readingId === saved?.focusId,
      );
      const bounds = content.getBoundingClientRect();
      const focusedBounds = focused?.getBoundingClientRect();
      const target =
        focused &&
        focusedBounds &&
        focusedBounds.bottom > bounds.top &&
        focusedBounds.top < bounds.bottom
          ? focused
          : (elements.find(
              (element) => element.dataset.readingId === saved?.anchorId,
            ) ??
            (article
              ? content.querySelector<HTMLElement>("h2")
              : searchRef.current));
      target?.focus({ preventScroll: true });
    }
    previousArticle.current = articleId;
    setMessage(saved && saved.scrollTop > 0 ? "Reading position restored" : "");
    return () => {
      cancelAnimationFrame(scrollFrame.current);
      scrollFrame.current = 0;
      clearTimeout(persistTimer.current);
      readingMemory.persist();
    };
  }, [articleId]);
  useEffect(() => {
    const persist = () => readingMemory.persist();
    window.addEventListener("pagehide", persist);
    return () => window.removeEventListener("pagehide", persist);
  }, []);
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
          <div>
            <button
              onClick={() => {
                contentRef.current?.scrollTo(0, 0);
                contentRef.current
                  ?.querySelector<HTMLElement>("h2")
                  ?.focus({ preventScroll: true });
                setMessage("");
                savePosition();
              }}
              aria-label="Read note from start"
              title="Read note from start"
            >
              <ArrowUp size={14} />
            </button>
            <button
              onClick={share}
              aria-label="Copy reference link"
              title="Copy reference link"
            >
              <Link size={14} />
            </button>
          </div>
        </div>
        <div
          className="reference-content"
          ref={contentRef}
          onScroll={queuePosition}
          onClickCapture={savePosition}
        >
          <article aria-label={article.title}>
            <span className="eyebrow">{article.category}</span>
            <h2 tabIndex={-1} data-reading-id="title">
              {article.title}
            </h2>
            <p
              className="reference-summary"
              tabIndex={-1}
              data-reading-id="summary"
            >
              {article.summary}
            </p>
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
            {article.paragraphs.map((paragraph, index) => (
              <p
                key={paragraph}
                tabIndex={-1}
                data-reading-id={`paragraph-${index}`}
              >
                {paragraph}
              </p>
            ))}
            <div className="reference-scope">
              <strong>In this atlas</strong>
              <p tabIndex={-1} data-reading-id="scope">
                {article.scope}
              </p>
            </div>
            {article.comparison && (
              <table className="reference-comparison">
                <caption tabIndex={-1} data-reading-id="comparison">
                  {article.comparison.caption}
                </caption>
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
                  {article.comparison.rows.map((row, index) => (
                    <tr
                      key={row.label}
                      tabIndex={-1}
                      data-reading-id={`row-${index}`}
                    >
                      <th scope="row">{row.label}</th>
                      <td>
                        <span>{row.summary}</span>
                        <p>{row.detail}</p>
                        <a
                          href={referenceSources[row.source].url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Source for ${row.label}`}
                          data-reading-id={`row-source-${index}`}
                        >
                          Source <ArrowUpRight size={10} />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <h3 tabIndex={-1} data-reading-id="anatomy">
              Explore the related anatomy
            </h3>
            <p className="reference-caption">
              Open a modeled region in the brain.
            </p>
            <div className="reference-region-links">
              {article.regions.map((id) => {
                const region = regions.find((item) => item.id === id)!;
                return (
                  <button
                    key={id}
                    data-reading-id={`region-${id}`}
                    onClick={() => onRegion(id)}
                  >
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
                <h3 tabIndex={-1} data-reading-id="explorations">
                  Continue exploring
                </h3>
                <div className="reference-explorations">
                  {explorations.map((item) => (
                    <a
                      key={`${item.kind}-${item.id}`}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noreferrer" : undefined}
                      data-reading-id={`explore-${item.kind}-${item.id}`}
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
            <h3 tabIndex={-1} data-reading-id="sources">
              Sources & further reading
            </h3>
            <div className="reference-sources">
              {article.sources.map((id) => {
                const source = referenceSources[id];
                return (
                  <a
                    key={id}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    data-reading-id={`source-${id}`}
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
            <h3 tabIndex={-1} data-reading-id="related">
              Keep reading
            </h3>
            <div className="reference-related">
              {article.related.map((id) => (
                <button
                  key={id}
                  data-reading-id={`related-${id}`}
                  onClick={() => onOpen(id)}
                >
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
          maxLength={160}
          onChange={(event) => changeQuery(event.target.value)}
          placeholder="Layers, neurons, anatomical terms…"
          aria-label="Search reference notes"
        />
        {query && (
          <button
            onClick={() => changeQuery("")}
            aria-label="Clear reference search"
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div
        className="reference-content"
        ref={contentRef}
        onScroll={queuePosition}
        onClickCapture={savePosition}
      >
        <p
          className="reference-intro"
          tabIndex={-1}
          data-reading-id="library-intro"
        >
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
            data-reading-id={`note-${item.id}`}
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
