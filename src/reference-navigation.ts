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
