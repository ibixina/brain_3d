import { BufferGeometry, Float32BufferAttribute } from "three";

export function meshBoundary(geometry: BufferGeometry) {
  const positions = geometry.getAttribute("position");
  const indices = geometry.getIndex()!;
  const vertexCount = positions.count;
  const edges = new Set<number>();
  for (let i = 0; i < indices.count; i += 3) {
    for (let side = 0; side < 3; side++) {
      const a = indices.getX(i + side);
      const b = indices.getX(i + ((side + 1) % 3));
      const key = Math.min(a, b) * vertexCount + Math.max(a, b);
      if (edges.has(key)) edges.delete(key);
      else edges.add(key);
    }
  }
  const vertices = new Float32Array(edges.size * 6);
  let offset = 0;
  for (const key of edges) {
    for (const vertex of [Math.floor(key / vertexCount), key % vertexCount]) {
      vertices[offset++] = positions.getX(vertex);
      vertices[offset++] = positions.getY(vertex);
      vertices[offset++] = positions.getZ(vertex);
    }
  }
  return new BufferGeometry().setAttribute(
    "position",
    new Float32BufferAttribute(vertices, 3),
  );
}
