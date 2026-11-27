export type RegionDetailRoute = "overview" | "videos";
export type ActivityComparisonState = {
  a: string;
  b: string | null;
  lens: string;
  stage: string;
  measure: string;
  region?: string | null;
  point?: [number, number, number] | null;
};

const activityKey = /^(meta|ibc|pathway):[\w-]+$/;
const activityLenses = new Set([
  "overlap",
  "a",
  "b",
  "a-only",
  "b-only",
  "shared",
]);
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
    b: state.b ?? "",
    lens: state.lens,
    stage: state.stage,
    measure: state.measure,
  });
  if (state.region) params.set("region", state.region);
  if (state.point) params.set("point", state.point.join(","));
  return `#${params.toString()}`;
}

export function activityReturnHash(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const raw = params.get("return");
  if (!raw) return null;
  const route = new URLSearchParams(raw);
  const a = route.get("a");
  const rawB = route.get("b");
  const b = rawB || null;
  const region = route.get("region");
  const rawPoint = route.get("point");
  const point = rawPoint?.match(/^\d+,\d+,\d+$/)
    ? rawPoint.split(",").map(Number)
    : null;
  const invalidPoint =
    rawPoint !== null &&
    (!point ||
      point.some(
        (coordinate) => !Number.isSafeInteger(coordinate) || coordinate < 0,
      ));
  if (
    route.get("view") !== "activities" ||
    !a ||
    !activityKey.test(a) ||
    (rawB !== null && rawB !== "" && !activityKey.test(rawB)) ||
    !activityLenses.has(route.get("lens") ?? "") ||
    !activityStages.has(route.get("stage") ?? "") ||
    !activityMeasures.has(route.get("measure") ?? "") ||
    (region !== null && !/^[\w-]+$/.test(region)) ||
    invalidPoint
  )
    return null;
  return activityComparisonHash({
    a,
    b,
    lens: route.get("lens")!,
    stage: route.get("stage")!,
    measure: route.get("measure")!,
    region,
    point: point ? (point as [number, number, number]) : null,
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
