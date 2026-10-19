import type { Region } from "./data.ts";

export const regionReferenceTopics = [
  {
    id: "brainstem-organization",
    title: "Brainstem levels and landmarks",
    keys: ["brainstem"],
  },
  {
    id: "cranial-nerves",
    title: "The twelve cranial nerves",
    keys: ["brainstem"],
  },
  {
    id: "cerebellum-organization",
    title: "Cerebellar lobes and connections",
    keys: ["cerebellar-cortex", "cerebellar-white-matter"],
  },
  {
    id: "cerebellar-circuit",
    title: "Inside the cerebellar circuit",
    keys: ["cerebellar-cortex", "cerebellar-white-matter"],
  },
];

export function referenceTopicsForRegion(region: Pick<Region, "key">) {
  return regionReferenceTopics.filter((topic) =>
    topic.keys.includes(region.key),
  );
}
