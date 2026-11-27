export type RegionDetailRoute = "overview" | "videos";

export function regionDetailFromHash(hash: string): RegionDetailRoute {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get("detail") === "videos" ? "videos" : "overview";
}

export function regionHash(id: string, detail: RegionDetailRoute = "overview") {
  const params = new URLSearchParams({ region: id });
  if (detail === "videos") params.set("detail", detail);
  return `#${params.toString()}`;
}
