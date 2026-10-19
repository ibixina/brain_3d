import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Compass,
  Search,
  X,
} from "lucide-react";
import { regions } from "../data";
import {
  filterLearningPaths,
  learningCheckDate,
  learningSources,
  type LearningPath,
  type LearningPosition,
} from "../learning";
import "./learning.css";

export function LearningLibrary({
  onStart,
}: {
  onStart: (path: LearningPath) => void;
}) {
  const [query, setQuery] = useState("");
  const paths = filterLearningPaths(query);
  return (
    <>
      <div className="search-box">
        <Search size={16} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Memory, movement, vision…"
          aria-label="Search learning paths"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Clear path search">
            <X size={13} />
          </button>
        )}
      </div>
      <div className="learning-library">
        <p className="learning-intro">
          Short guided explorations through the anatomy. Each stop highlights a
          real part of the model and explains its place in a wider system.
        </p>
        {paths.map((path) => (
          <button
            className="learning-card"
            key={path.id}
            onClick={() => onStart(path)}
          >
            <span className="learning-card-meta">
              <Compass size={14} /> {path.steps.length} stops · about{" "}
              {path.minutes} min
            </span>
            <strong>{path.title}</strong>
            <span>{path.subtitle}</span>
            <span className="learning-card-action">
              Start exploring <ArrowRight size={14} />
            </span>
          </button>
        ))}
        {!paths.length && (
          <p className="learning-intro">
            No matching paths. Try a system such as language or memory.
          </p>
        )}
        <p className="learning-library-note">
          Learning sequences, rather than measured connections or activity
          animations. Sources checked {learningCheckDate}. Each path identifies
          what its model can and cannot show.
        </p>
      </div>
    </>
  );
}

export function LearningHeader({
  position,
  onChoose,
}: {
  position: LearningPosition;
  onChoose: () => void;
}) {
  return (
    <button
      className="learning-header"
      onClick={onChoose}
      aria-label="Choose another learning path"
    >
      <Compass size={14} /> <span>{position.path.title}</span>
    </button>
  );
}

export function LearningExplanation({
  position,
}: {
  position: LearningPosition;
}) {
  const stop = position.path.steps[position.step];
  const source = learningSources[stop.source];
  return (
    <section
      className="learning-explanation"
      aria-label="Learning path explanation"
    >
      <span className="learning-step-label">
        STOP {position.step + 1} OF {position.path.steps.length}
      </span>
      <h3>{stop.title}</h3>
      <p>{stop.text}</p>
      {stop.note && <p className="learning-view-note">{stop.note}</p>}
      <p className="learning-look">
        <Compass size={14} /> {stop.prompt}
      </p>
      <a href={source.url} target="_blank" rel="noreferrer">
        <BookOpen size={13} /> {source.title} <ArrowUpRight size={12} />
      </a>
      <details>
        <summary>What this path shows</summary>
        <p>{position.path.summary}</p>
        <p>{position.path.limit}</p>
        <span className="learning-step-label">
          {source.kind} · Checked {learningCheckDate}
        </span>
      </details>
    </section>
  );
}

export function LearningNavigation({
  position,
  onStep,
  onFinish,
}: {
  position: LearningPosition;
  onStep: (step: number) => void;
  onFinish: () => void;
}) {
  const { path, step } = position;
  const last = step === path.steps.length - 1;
  const nextRegion = regions.find(
    (region) => region.id === path.steps[step + 1]?.region,
  );
  return (
    <nav className="learning-navigation" aria-label="Learning path steps">
      <button
        disabled={step === 0}
        onClick={() => onStep(step - 1)}
        aria-label="Previous learning stop"
      >
        <ArrowLeft size={14} /> Previous
      </button>
      <span aria-live="polite">
        {step + 1} / {path.steps.length}
      </span>
      <button
        onClick={() => (last ? onFinish() : onStep(step + 1))}
        aria-label={
          last ? "Finish learning path" : `Next stop: ${nextRegion?.name}`
        }
      >
        {last ? "Finish" : "Next"} <ArrowRight size={14} />
      </button>
    </nav>
  );
}
