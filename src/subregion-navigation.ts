import {
  isSubregionKind,
  matchingSubregions,
  subregionForRegion,
  type SubregionKind,
  type SubregionName,
} from "./subregions.ts";
import { thalamicGroupIds } from "./thalamus-guide.ts";

export const subregionViews = {
  default: "Oblique",
  left: "From left",
  right: "From right",
  anterior: "From front · anterior",
  posterior: "From back · posterior",
  superior: "From above · superior",
  inferior: "From below · inferior",
};
export type SubregionView = keyof typeof subregionViews;
export type SubregionRoute = {
  kind: SubregionKind;
  hemisphere: "left" | "right" | "both";
  selected: string | null;
  isolated: boolean;
  exploded: number;
  camera: SubregionView;
  tour: string | null;
};
const fields = ["atlas", "side", "part", "isolate", "explode", "angle", "tour"];

export function defaultSubregionRoute(
  kind: SubregionKind,
  hemisphere: string,
): SubregionRoute {
  return {
    kind,
    hemisphere:
      kind !== "brainstem" && (hemisphere === "left" || hemisphere === "right")
        ? hemisphere
        : "both",
    selected: null,
    isolated: false,
    exploded: 0,
    camera: "default",
    tour: null,
  };
}

export function subregionRouteFromHash(
  hash: string,
  parent: { id: string; hemisphere: string } | undefined,
): SubregionRoute | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const kind = params.get("atlas");
  if (
    !parent || params.has("view") || params.has("reference") ||
    !isSubregionKind(kind) || subregionForRegion(parent.id) !== kind
  )
    return null;
  const route = defaultSubregionRoute(
    kind,
    params.get("side") ?? parent.hemisphere,
  );
  const part = params.get("part");
  route.selected = part && /^[a-z0-9-]{1,80}$/.test(part) ? part : null;
  route.isolated = params.get("isolate") === "1";
  route.exploded = !route.isolated && params.get("explode") === "1" ? 0.3 : 0;
  const angle = params.get("angle");
  if (angle && Object.hasOwn(subregionViews, angle))
    route.camera = angle as SubregionView;
  const tour = params.get("tour");
  if (kind === "thalamus" && tour && thalamicGroupIds.includes(tour))
    route.tour = tour;
  return route;
}

// Actual source IDs are checked only after the requested catalogue loads.
export function resolveSubregionRoute(
  route: SubregionRoute,
  parts: SubregionName[],
): SubregionRoute {
  const selected = matchingSubregions(parts, "", route.hemisphere)
    .find((part) => part.id === route.selected)?.id ?? null;
  return { ...route, selected, isolated: !!selected && route.isolated };
}

export function withSubregionRoute(hash: string, route: SubregionRoute | null) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  for (const field of fields) params.delete(field);
  if (route) {
    params.set("atlas", route.kind);
    params.set("side", route.hemisphere);
    if (route.selected) params.set("part", route.selected);
    if (route.selected && route.isolated) params.set("isolate", "1");
    else if (route.exploded > 0) params.set("explode", "1");
    if (route.camera !== "default") params.set("angle", route.camera);
    if (route.kind === "thalamus" && route.tour && thalamicGroupIds.includes(route.tour))
      params.set("tour", route.tour);
  }
  return params.size ? `#${params}` : "";
}
