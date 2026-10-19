import { useLayoutEffect, useRef } from "react";
import { hemisphereLabel, infoFor, type Region } from "../data";

export default function RegionCallout({
  region,
  x,
  y,
  selected,
}: {
  region: Region;
  x: number;
  y: number;
  selected: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.min(320, window.innerWidth - 24);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const height = element.getBoundingClientRect().height;
    const below = y + 24;
    const top = below + height <= window.innerHeight - 12
      ? below
      : y - height - 24;
    element.style.top = `${Math.max(12, Math.min(top, window.innerHeight - height - 12))}px`;
  }, [x, y, region.id]);
  return (
    <div className={`region-callout ${selected ? "is-selected" : ""}`}>
      <span className="hover-target" style={{ left: x, top: y }} />
      <div
        className="hover-tooltip"
        ref={ref}
        role="tooltip"
        style={{
          left: Math.max(12, x + width + 24 <= window.innerWidth - 12
            ? x + 24
            : x - width - 24),
          top: y + 24,
          width,
        }}
      >
        <span className="hover-eyebrow">Under your pointer</span>
        <strong>{region.name}</strong>
        <span className="hover-location">
          {hemisphereLabel(region.hemisphere)} · {region.group}
        </span>
        <p>{infoFor(region).summary.split(/(?<=\.)\s/)[0]}</p>
        <span className="hover-action">
          {selected
            ? "You’re reading about this part"
            : "Click this part to read its details"}
        </span>
      </div>
    </div>
  );
}
