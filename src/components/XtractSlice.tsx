import { useEffect, useRef, useState } from "react";
import { planeAxis, planeDimensions, worldPoint, type Grid, type Plane, type Point3 } from "../imaging";
import { moveProbabilityPoint, probabilityPointAt } from "../probability-slices";
import { xtractMapSlice } from "../tractography";

export default function XtractSlice({
  plane,
  point,
  onPoint,
  grid,
  values,
  minimumPercent,
  scale,
}: {
  plane: Plane;
  point: Point3;
  onPoint: (next: Point3) => void;
  grid: Grid;
  values: Uint16Array;
  minimumPercent: number;
  scale: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [horizontal, vertical] = planeDimensions[plane];
  const axis = planeAxis[plane];
  const orientation = plane === "sagittal"
    ? "P ← · A → · S ↑ · I ↓"
    : plane === "coronal"
      ? "L ← · R → · S ↑ · I ↓"
      : "L ← · R → · A ↑ · P ↓";

  useEffect(() => {
    if (!box.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      }),
    );
    observer.observe(box.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const target = canvas.current;
    if (!target || size.width < 2 || size.height < 2) return;
    const context = target.getContext("2d");
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    target.width = Math.round(size.width * ratio);
    target.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#07101a";
    context.fillRect(0, 0, size.width, size.height);

    const slice = xtractMapSlice(plane, point, grid, values, minimumPercent, scale);
    const image = document.createElement("canvas");
    image.width = slice.width;
    image.height = slice.height;
    image.getContext("2d")?.putImageData(
      new ImageData(slice.pixels, slice.width, slice.height),
      0,
      0,
    );
    const fit = Math.min(size.width / slice.width, size.height / slice.height);
    const width = slice.width * fit;
    const height = slice.height * fit;
    const left = (size.width - width) / 2;
    const top = (size.height - height) / 2;
    context.imageSmoothingEnabled = false;
    context.drawImage(image, left, top, width, height);

    const x = left + ((point[horizontal] + 0.5) / grid.shape[horizontal]) * width;
    const y = top + ((grid.shape[vertical] - point[vertical] - 0.5) / grid.shape[vertical]) * height;
    context.strokeStyle = "#d7e9e7b5";
    context.lineWidth = 0.8;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(x - 5, y);
    context.moveTo(x + 5, y);
    context.lineTo(left + width, y);
    context.moveTo(x, top);
    context.lineTo(x, y - 5);
    context.moveTo(x, y + 5);
    context.lineTo(x, top + height);
    context.stroke();
  }, [size, plane, point, grid, values, minimumPercent, scale, horizontal, vertical]);

  const position = worldPoint(point, grid)[axis];
  return (
    <section className="xtract-plane" aria-label={`${plane} pathway probability map`}>
      <header>
        <strong>{plane}</strong>
        <span className="xtract-directions" aria-label={`${orientation} orientation`}>{orientation}</span>
        <span>{position} mm</span>
      </header>
      <div className="xtract-plane-canvas" ref={box}>
        <canvas
          ref={canvas}
          role="img"
          tabIndex={0}
          aria-label={`${plane} Xtract population pathway map. Click or drag to move linked MNI coordinates; use arrow keys to sample.`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            locate(event, point, plane, grid, onPoint, horizontal, vertical);
          }}
          onPointerMove={(event) => {
            if (event.buttons) locate(event, point, plane, grid, onPoint, horizontal, vertical);
          }}
          onKeyDown={(event) => {
            const next = moveProbabilityPoint(point, plane, event.key, grid.shape);
            if (next) {
              event.preventDefault();
              onPoint(next);
            }
          }}
        />
      </div>
    </section>
  );
}

function locate(
  event: React.PointerEvent<HTMLCanvasElement>,
  point: Point3,
  plane: Plane,
  grid: Grid,
  onPoint: (next: Point3) => void,
  horizontal: number,
  vertical: number,
) {
  const rect = event.currentTarget.getBoundingClientRect();
  const fit = Math.min(rect.width / grid.shape[horizontal], rect.height / grid.shape[vertical]);
  const width = grid.shape[horizontal] * fit;
  const height = grid.shape[vertical] * fit;
  const u = (event.clientX - rect.left - (rect.width - width) / 2) / width;
  const v = (event.clientY - rect.top - (rect.height - height) / 2) / height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return;
  onPoint(probabilityPointAt(point, plane, u, v, grid.shape));
}
