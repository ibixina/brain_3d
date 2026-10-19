import { matchingSubregions, type SubregionName } from "./subregions.ts";
import type { SubregionView } from "./subregion-navigation.ts";

export const thalamicGroupIds = [
  "anterior", "lateral", "ventral", "intralaminar", "medial", "posterior", "reticular",
];
export type ThalamicGroup = {
  id: string;
  name: string;
  lead: string;
  camera: string;
  text: string;
};
export type ThalamicGuide = {
  checkedOn: string;
  source: string;
  sourceTitle: string;
  note: string;
  groups: ThalamicGroup[];
  labels: Record<string, string>;
};

export function thalamicGroupSelection(
  parts: SubregionName[],
  group: ThalamicGroup,
  hemisphere: string,
  preferred: string | null = null,
) {
  const scoped = matchingSubregions(parts, "", hemisphere)
    .filter((part) => part.group === group.name);
  return {
    selected: (scoped.find((part) => part.id === preferred) ??
      scoped.find((part) => part.key === group.lead) ?? scoped[0])?.id ?? null,
    hiddenGroups: [...new Set(parts.map((part) => part.group))]
      .filter((name) => name !== group.name),
  };
}

export function thalamicGroupCamera(group: ThalamicGroup, hemisphere: string): SubregionView {
  if (group.camera === "lateral" || group.camera === "medial") {
    if (hemisphere === "both") return "default";
    const fromRight = (hemisphere === "right") === (group.camera === "lateral");
    return fromRight ? "right" : "left";
  }
  return group.camera as SubregionView;
}
