import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  clamp,
  planeAxis,
  planeDimensions,
  pointOnSlice,
  slicePixels,
  worldPoint,
} from "../imaging";
import type { Grid, Plane, Point3, Volume } from "../imaging";

export default function MRISlice({
  plane,
  point,
  onPoint,
  grid,
  scan,
  overlay,
  options,
  crosshairs,
  primary,
  onFocus,
}: {
  plane: Plane;
  point: Point3;
  onPoint: (point: Point3) => void;
  grid: Grid;
  scan: Volume;
  overlay: Volume | null;
  options: Parameters<typeof slicePixels>[5];
  crosshairs: boolean;
  primary: boolean;
  onFocus: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [horizontal, vertical] = planeDimensions[plane];
  const axis = planeAxis[plane];
  useEffect(() => {
    if (!boxRef.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      }),
    );
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.width < 2 || size.height < 2) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(size.width * ratio);
    canvas.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.fillStyle = "#060b12";
    context.fillRect(0, 0, size.width, size.height);
    const slice = slicePixels(plane, point, grid, scan, overlay, options);
    const image = document.createElement("canvas");
    image.width = slice.width;
    image.height = slice.height;
    image
      .getContext("2d")
      ?.putImageData(
        new ImageData(slice.pixels, slice.width, slice.height),
        0,
        0,
      );
    const scale = Math.min(
      size.width / slice.width,
      size.height / slice.height,
    );
    const width = slice.width * scale,
      height = slice.height * scale,
      left = (size.width - width) / 2,
      top = (size.height - height) / 2;
    context.imageSmoothingEnabled = true;
    context.drawImage(image, left, top, width, height);
    if (crosshairs) {
      const background = options.backgroundGrid ?? grid;
      const world = worldPoint(point, grid);
      const x =
          left +
          ((world[horizontal] - background.origin[horizontal]) /
            background.spacing[horizontal] +
            0.5) *
            scale,
        y =
          top +
          (slice.height -
            (world[vertical] - background.origin[vertical]) /
              background.spacing[vertical] -
            0.5) *
            scale;
      context.strokeStyle = "#9dd8d387";
      context.lineWidth = 0.75;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(x - 7, y);
      context.moveTo(x + 7, y);
      context.lineTo(left + width, y);
      context.moveTo(x, top);
      context.lineTo(x, y - 7);
      context.moveTo(x, y + 7);
      context.lineTo(x, top + height);
      context.stroke();
    }
  }, [
    size,
    plane,
    point,
    scan,
    overlay,
    options,
    crosshairs,
    grid,
    horizontal,
    vertical,
  ]);
  function locate(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const background = options.backgroundGrid ?? grid;
    const width = background.shape[horizontal],
      height = background.shape[vertical];
    const scale = Math.min(rect.width / width, rect.height / height);
    const u =
      (event.clientX - rect.left - (rect.width - width * scale) / 2) /
      (width * scale);
    const v =
      (event.clientY - rect.top - (rect.height - height * scale) / 2) /
      (height * scale);
    if (u < 0 || u > 1 || v < 0 || v > 1) return;
    onPoint(pointOnSlice(plane, u, v, point, grid));
  }
  return (
    <section
      className={`scan-plane ${primary ? "primary-plane" : ""}`}
      aria-label={`${plane} scan view`}
    >
      <div className="scan-plane-header">
        <button onClick={onFocus} aria-label={`Make ${plane} the main view`}>
          {plane}
          <ChevronDown size={11} />
        </button>
        <span>{worldPoint(point, grid)[axis]} mm</span>
      </div>
      <div className="slice-canvas-box" ref={boxRef}>
        <canvas
          ref={canvasRef}
          role="img"
          tabIndex={0}
          aria-label={`${plane} MRI slice. Click or drag to move the linked crosshairs; use arrow keys to change this slice.`}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            locate(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons === 1) locate(event);
          }}
          onKeyDown={(event) => {
            if (
              ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                event.key,
              )
            ) {
              event.preventDefault();
              const next = [...point] as Point3;
              next[axis] = clamp(
                next[axis] +
                  (["ArrowUp", "ArrowRight"].includes(event.key) ? 1 : -1),
                0,
                grid.shape[axis] - 1,
              );
              onPoint(next);
            }
          }}
        />
        <span className="slice-direction direction-top">
          {plane === "axial" ? "A" : "S"}
        </span>
        <span className="slice-direction direction-bottom">
          {plane === "axial" ? "P" : "I"}
        </span>
        <span className="slice-direction direction-left">
          {plane === "sagittal" ? "P" : "L"}
        </span>
        <span className="slice-direction direction-right">
          {plane === "sagittal" ? "A" : "R"}
        </span>
      </div>
    </section>
  );
}
