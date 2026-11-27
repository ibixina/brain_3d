export type RegionDetailRoute = "overview" | "videos";
export type ActivityComparisonState = {
  a: string;
  b: string | null;
  lens: string;
  stage: string;
  measure: string;
};

const activityKey = /^(meta|ibc|pathway):[\w-]+$/;
const activityLenses = new Set(["overlap", "a", "b", "a-only", "b-only", "shared"]);
const activityStages = new Set(["model", "slices", "split"]);
const activityMeasures = new Set(["consistency", "specificity"]);

export function regionDetailFromHash(hash: string): RegionDetailRoute {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("detail") === "videos" ? "videos" : "overview";
}

export function activityComparisonHash(state: ActivityComparisonState) {
  const params = new URLSearchParams({
    view: "activities",
    a: state.a,
    lens: state.lens,
    stage: state.stage,
    measure: state.measure,
  });
  if (state.b) params.set("b", state.b);
  return `#${params.toString()}`;
}

export function activityReturnHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = params.get("return");
  if (!raw) return null;
  const route = new URLSearchParams(raw);
  const a = route.get("a");
  const b = route.get("b");
  if (
    route.get("view") !== "activities" ||
    !a ||
    !activityKey.test(a) ||
    (b !== null && !activityKey.test(b)) ||
    !activityLenses.has(route.get("lens") ?? "") ||
    !activityStages.has(route.get("stage") ?? "") ||
    !activityMeasures.has(route.get("measure") ?? "")
  )
    return null;
  return activityComparisonHash({
    a,
    b,
    lens: route.get("lens")!,
    stage: route.get("stage")!,
    measure: route.get("measure")!,
  });
}

export function regionHash(
  id: string,
  detail: RegionDetailRoute = "overview",
  returnTo?: string,
) {
  const params = new URLSearchParams({ region: id });
  if (detail === "videos") params.set("detail", detail);
  if (returnTo?.startsWith("#view=activities&"))
    params.set("return", returnTo.slice(1));
  return `#${params.toString()}`;
}
