import type { Region } from "./data.ts";
import type { ViewState } from "./viewer";

const medialCortex = new Set([
  "caudalanteriorcingulate",
  "rostralanteriorcingulate",
  "posteriorcingulate",
  "isthmuscingulate",
  "precuneus",
  "cuneus",
  "pericalcarine",
  "lingual",
  "paracentral",
  "medialorbitofrontal",
  "entorhinal",
  "parahippocampal",
]);

export function regionNeedsIsolation(region: Region) {
  return (
    [
      "insula",
      "transversetemporal",
      "choroid-plexus",
      "cerebellar-white-matter",
    ].includes(region.key) || region.key.startsWith("corpus-callosum-")
  );
}

export function regionView(region: Region, defaults: ViewState): ViewState {
  const hiddenGroups = defaults.hiddenGroups.filter(
    (group) => group !== region.group,
  );
  if (
    region.group === "Ventricles" &&
    !hiddenGroups.includes("Deep structures")
  )
    hiddenGroups.push("Deep structures");
  return {
    ...defaults,
    selected: region.id,
    isolated: regionNeedsIsolation(region),
    exploded: 0,
    opacity: region.kind === "cortex" ? 1 : 0.15,
    hemisphere: region.hemisphere === "midline" ? "both" : region.hemisphere,
    hiddenGroups,
    section: "none",
    sectionOffset: 0,
    autoRotate: false,
  };
}

export function regionCamera(region: Region) {
  if (region.hemisphere === "midline") return "default";
  if (medialCortex.has(region.key) || region.group === "Deep structures")
    return region.hemisphere === "left" ? "right" : "left";
  if (region.key === "fusiform") return "inferior";
  return region.hemisphere;
}

export function regionEnabled(region: Region, state: ViewState) {
  if (region.kind === "cortex" && state.opacity === 0) return false;
  return state.isolated
    ? state.selected === region.id
    : !state.hiddenGroups.includes(region.group) &&
        (state.hemisphere === "both" ||
          region.hemisphere === "midline" ||
          region.hemisphere === state.hemisphere);
}
