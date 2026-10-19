import catalogue from "./learning-paths.json" with { type: "json" };
import atlas from "./atlas-manifest.json" with { type: "json" };
import type { ViewState } from "./viewer";

export type LearningStop = {
  region: string;
  title: string;
  text: string;
  prompt: string;
  source: string;
  note?: string;
  view: {
    camera: string;
    opacity: number;
    hemisphere: string;
    isolate?: boolean;
  };
};
export type LearningPath = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  minutes: number;
  tags: string[];
  limit: string;
  steps: LearningStop[];
};
export type LearningPosition = { path: LearningPath; step: number };
export const learningPaths: LearningPath[] = catalogue.paths;
export const learningSources: Record<
  string,
  { title: string; url: string; kind: string }
> = catalogue.sources;
export const learningCheckDate = catalogue.checkedOn;

export function learningView(
  position: LearningPosition,
  defaults: ViewState,
): ViewState {
  const stop = position.path.steps[position.step];
  const region = atlas.parts.find((part) => part.id === stop.region)!;
  const hiddenGroups = defaults.hiddenGroups.filter(
    (group) => group !== region.group,
  );
  if (region.group === "Ventricles") hiddenGroups.push("Deep structures");
  return {
    ...defaults,
    selected: stop.region,
    isolated: !!stop.view.isolate,
    opacity: stop.view.opacity,
    hemisphere: stop.view.hemisphere,
    hiddenGroups,
  };
}

export function learningFromHash(hash: string): LearningPosition | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (params.has("view")) return null;
  const path = learningPaths.find((item) => item.id === params.get("path"));
  if (!path) return null;
  const number = Number(params.get("step") ?? 1);
  const step =
    Number.isInteger(number) && number >= 1 && number <= path.steps.length
      ? number - 1
      : 0;
  return { path, step };
}
export function learningHash(path: LearningPath, step: number) {
  return `#path=${encodeURIComponent(path.id)}&step=${step + 1}`;
}
export function filterLearningPaths(query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return learningPaths.filter((path) => {
    const text = [
      path.title,
      path.subtitle,
      path.summary,
      ...path.tags,
      ...path.steps.map((step) => step.title),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((term) => text.includes(term));
  });
}
