import type { Region } from "./data.ts";
import type { ViewState } from "./viewer";

export function referenceOrigin(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  if (!params.has("region") && !params.has("path") && !params.has("view"))
    return null;
  const id = params.get("from");
  return id && /^[a-z][a-z0-9-]{0,79}$/.test(id) ? id : null;
}

export function withReferenceOrigin(hash: string, origin: string | null) {
  if (!hash) return "";
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  params.delete("from");
  if (origin) params.set("from", origin);
  return `#${params}`;
}

export function referenceRegionView(
  region: Region,
  defaults: ViewState,
): ViewState {
  const hiddenGroups = defaults.hiddenGroups.filter(
    (group) => group !== region.group,
  );
  if (region.group === "Ventricles") hiddenGroups.push("Deep structures");
  return {
    ...defaults,
    selected: region.id,
    opacity: region.kind === "cortex" ? 1 : 0.15,
    hiddenGroups,
  };
}
