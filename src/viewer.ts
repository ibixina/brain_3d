import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { regions, type Region } from "./data";
import { assetUrl } from "./asset-url.ts";
import { meshBoundary } from "./mesh-boundary.ts";
import { perspectiveFraming, sphereFocusDistance } from "./viewer-framing.ts";

export type ViewState = {
  selected: string | null;
  isolated: boolean;
  exploded: number;
  explodeMode: string;
  opacity: number;
  hemisphere: string;
  hiddenGroups: string[];
  labels: boolean;
  autoRotate: boolean;
  colorMode: string;
  section: string;
  sectionOffset: number;
};
export type ViewerRegion = Omit<Region, "detail"> & {
  detail?: Region["detail"];
};
export type ViewerDataset = {
  regions: ViewerRegion[];
  compressedUrl: string;
  rawUrl: string;
  fitOnLoad?: boolean;
  explodeFromCenter?: boolean;
  label?: string;
};
const defaultDataset: ViewerDataset = {
  regions,
  compressedUrl: "/models/atlas.mesh",
  rawUrl: "/models/atlas.bin",
};
type AtlasMesh = THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
type Callbacks = {
  select: (id: string) => void;
  hover: (id: string | null, x: number, y: number) => void;
  ready: () => void;
  error: (message: string) => void;
  stats: (fps: number, triangles: number) => void;
  detail: (id: string, status: "loading" | "ready" | "error") => void;
  label: (points: { id: string; x: number; y: number }[]) => void;
};
const initial: ViewState = {
  selected: null,
  isolated: false,
  exploded: 0,
  explodeMode: "lobes",
  opacity: 1,
  hemisphere: "both",
  hiddenGroups: ["Ventricles", "White matter"],
  labels: false,
  autoRotate: false,
  colorMode: "tissue",
  section: "none",
  sectionOffset: 0,
};
const labelKeys = [
  "lh-rostralmiddlefrontal",
  "lh-superiorparietal",
  "lh-superiortemporal",
  "lh-lateraloccipital",
  "aseg-8",
  "aseg-16",
];
const lobeCenters = new Map<string, THREE.Vector3>();
for (const region of regions.filter((part) => part.kind === "cortex")) {
  const key = `${region.group}-${region.hemisphere}`;
  if (lobeCenters.has(key)) continue;
  const peers = regions.filter(
    (part) =>
      part.group === region.group && part.hemisphere === region.hemisphere,
  );
  const center = peers
    .reduce(
      (sum, part) =>
        sum.add(
          new THREE.Vector3(...(part.center as [number, number, number])),
        ),
      new THREE.Vector3(),
    )
    .divideScalar(peers.length);
  lobeCenters.set(key, center);
}
export class AtlasViewer {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.5, 2500);
  private controls: OrbitControls;
  private meshes = new Map<string, AtlasMesh>();
  private root = new THREE.Group();
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private framesLeft = 0;
  private disposed = false;
  private active = true;
  private state: ViewState = { ...initial };
  private detailed = new Map<string, THREE.BufferGeometry>();
  private base = new Map<string, THREE.BufferGeometry>();
  private pendingDetails = new Set<string>();
  private lastTriangles = -1;
  private loadController = new AbortController();
  private down = { x: 0, y: 0 };
  private cameraGoal: {
    position: THREE.Vector3;
    target: THREE.Vector3;
  } | null = null;
  private lastFrame = 0;
  private statsTime = 0;
  private statsFrames = 0;
  private hovered: string | null = null;
  private hoverOutline = this.createOutline("#ffe0a0");
  private selectionOutline = this.createOutline("#b6fff3");
  private framing = 1;
  constructor(
    private element: HTMLElement,
    private callbacks: Callbacks,
    private dataset: ViewerDataset = defaultDataset,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x101715, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.localClippingEnabled = true;
    this.renderer.domElement.setAttribute(
      "aria-label",
      dataset.label ??
        "Interactive 3D brain. Drag to rotate, scroll to zoom, right-drag to pan. Select a region in the structure list for keyboard access.",
    );
    this.renderer.domElement.setAttribute("role", "img");
    element.appendChild(this.renderer.domElement);
    this.camera.position.set(-282, 108, -179);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 5, 10);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = dataset.fitOnLoad ? 0.5 : 18;
    if (dataset.fitOnLoad) this.camera.near = 0.05;
    this.controls.maxDistance = 850;
    this.controls.autoRotateSpeed = 0.5;
    this.controls.addEventListener("change", this.invalidate);
    this.controls.addEventListener("start", this.stopFlight);
    this.scene.add(this.root);
    this.root.add(this.hoverOutline, this.selectionOutline);
    this.scene.add(new THREE.HemisphereLight(0xf3f3de, 0x384b43, 1.7));
    const key = new THREE.DirectionalLight(0xfff7e7, 2.5);
    key.position.set(-160, 220, -150);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xc2e6d9, 0.8);
    fill.position.set(180, 40, 60);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe6dfed, 1.2);
    rim.position.set(40, 140, 200);
    this.scene.add(rim);
    this.resizeObserver = new ResizeObserver(this.resize);
    this.resizeObserver.observe(element);
    this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.pointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.addEventListener("pointermove", this.pointerMove);
    this.renderer.domElement.addEventListener(
      "pointerleave",
      this.pointerLeave,
    );
    this.renderer.domElement.addEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    document.addEventListener("visibilitychange", this.visibilityChanged);
    void this.load();
  }
  private load = async () => {
    try {
      const compressed = "DecompressionStream" in window;
      const response = await fetch(
        assetUrl(compressed ? this.dataset.compressedUrl : this.dataset.rawUrl),
        { signal: this.loadController.signal },
      );
      if (!response.ok) throw new Error("The atlas could not be loaded.");
      const buffer =
        compressed && response.body
          ? await new Response(
              response.body.pipeThrough(new DecompressionStream("gzip")),
            ).arrayBuffer()
          : await response.arrayBuffer();
      if (this.disposed) return;
      for (const region of this.dataset.regions) {
        const geometry = this.geometry(
          buffer,
          region.offset,
          region.vertices,
          region.triangles,
          region.color,
        );
        const material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          vertexColors: true,
          roughness: 0.72,
          metalness: 0.04,
          side: THREE.DoubleSide,
        });
        material.forceSinglePass = true;
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.region = region;
        mesh.userData.explode = new THREE.Vector3();
        this.meshes.set(region.id, mesh);
        this.base.set(region.id, geometry);
        this.root.add(mesh);
      }
      this.update(this.state);
      if (this.dataset.fitOnLoad) this.view("default");
      this.callbacks.ready();
    } catch (error) {
      if (!this.disposed)
        this.callbacks.error(
          error instanceof Error
            ? error.message
            : "Unable to load the brain model.",
        );
    }
  };
  private geometry(
    buffer: ArrayBuffer,
    offset: number,
    vertices: number,
    triangles: number,
    color: string,
  ) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(buffer, offset, vertices * 3),
        3,
      ),
    );
    geometry.setAttribute(
      "normal",
      new THREE.BufferAttribute(
        new Float32Array(buffer, offset + vertices * 12, vertices * 3),
        3,
      ),
    );
    const shade = new Float32Array(buffer, offset + vertices * 24, vertices);
    geometry.userData.shade = shade;
    geometry.setIndex(
      new THREE.BufferAttribute(
        new Uint32Array(buffer, offset + vertices * 28, triangles * 3),
        1,
      ),
    );
    this.recolor(geometry, color);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return geometry;
  }
  private recolor(geometry: THREE.BufferGeometry, color: string) {
    const shade = geometry.userData.shade as Float32Array;
    const rgb = new THREE.Color(color);
    const attribute = geometry.getAttribute("color");
    const values = attribute
      ? attribute.array
      : new Float32Array(shade.length * 3);
    for (let i = 0; i < shade.length; i++) {
      values[i * 3] = rgb.r * shade[i];
      values[i * 3 + 1] = rgb.g * shade[i];
      values[i * 3 + 2] = rgb.b * shade[i];
    }
    if (attribute) attribute.needsUpdate = true;
    else geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    geometry.userData.color = color;
  }
  update(state: ViewState) {
    const previous = this.state;
    this.state = { ...state };
    this.controls.autoRotate = state.autoRotate && !this.hovered;
    for (const [id, mesh] of this.meshes) {
      const region = mesh.userData.region as ViewerRegion;
      const selected = id === state.selected;
      mesh.visible = state.isolated
        ? selected
        : !state.hiddenGroups.includes(region.group) &&
          (state.hemisphere === "both" ||
            region.hemisphere === "midline" ||
            region.hemisphere === state.hemisphere);
      const cortex = region.kind === "cortex";
      if (cortex && state.opacity === 0) mesh.visible = false;
      mesh.material.opacity = cortex ? state.opacity : 1;
      const transparent = mesh.material.opacity < 1;
      if (mesh.material.transparent !== transparent) {
        mesh.material.transparent = transparent;
        mesh.material.needsUpdate = true;
      }
      mesh.material.depthWrite = mesh.material.opacity > 0.45;
      mesh.renderOrder = cortex && state.opacity < 1 ? 1 : 0;
      const plane =
        state.section === "none"
          ? []
          : [
              new THREE.Plane(
                new THREE.Vector3(
                  ...((state.section === "sagittal"
                    ? [1, 0, 0]
                    : state.section === "axial"
                      ? [0, 1, 0]
                      : [0, 0, 1]) as [number, number, number]),
                ),
                state.sectionOffset,
              ),
            ];
      mesh.material.clippingPlanes = plane;
      const center =
        cortex && state.explodeMode === "lobes"
          ? lobeCenters.get(`${region.group}-${region.hemisphere}`)!
          : new THREE.Vector3(...(region.center as [number, number, number]));
      const direction = center.clone().sub(new THREE.Vector3(0, 0, 15));
      direction.x +=
        region.hemisphere === "left"
          ? -35
          : region.hemisphere === "right"
            ? 35
            : 0;
      if (direction.length() < 1) direction.set(0, -1, 0);
      if (this.dataset.explodeFromCenter) {
        direction.copy(center).sub(new THREE.Vector3(0, 5, 10));
        direction.multiplyScalar(state.exploded * 3);
      } else direction.normalize().multiplyScalar(state.exploded * 90);
      mesh.userData.explode = state.isolated ? new THREE.Vector3() : direction;
      if ((!state.isolated || !selected) && mesh.geometry !== this.base.get(id))
        mesh.geometry = this.base.get(id)!;
      this.applyAppearance(mesh);
    }
    if (this.hovered && !this.meshes.get(this.hovered)?.visible)
      this.pointerLeave();
    if (state.isolated && state.selected) {
      if (!previous.isolated || previous.selected !== state.selected)
        this.focus(state.selected);
      void this.loadDetail(state.selected);
    } else if (
      previous.isolated ||
      (previous.exploded === 0) !== (state.exploded === 0)
    ) {
      this.view("default");
    }
    this.invalidate();
  }
  private async loadDetail(id: string) {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    const region = mesh.userData.region as ViewerRegion;
    if (!region.detail) {
      this.callbacks.detail(id, "ready");
      return;
    }
    if (this.pendingDetails.has(id)) return;
    if (!this.detailed.has(id)) {
      this.pendingDetails.add(id);
      this.callbacks.detail(id, "loading");
      try {
        const response = await fetch(assetUrl(region.detail.url), {
          signal: this.loadController.signal,
        });
        if (!response.ok) throw new Error("Detail mesh unavailable");
        const buffer = await response.arrayBuffer();
        if (this.disposed) return;
        this.detailed.set(
          id,
          this.geometry(
            buffer,
            0,
            region.detail.vertices,
            region.detail.triangles,
            region.color,
          ),
        );
        // Limit retained detail geometry when visiting many regions.
        if (this.detailed.size > 6) {
          const oldest = [...this.detailed.keys()].find(
            (key) => key !== id && key !== this.state.selected,
          );
          if (oldest) {
            this.detailed.get(oldest)?.dispose();
            this.detailed.delete(oldest);
          }
        }
      } catch {
        if (this.state.isolated && this.state.selected === id)
          this.callbacks.detail(id, "error");
        return;
      } finally {
        this.pendingDetails.delete(id);
      }
    }
    if (this.state.isolated && this.state.selected === id) {
      mesh.geometry = this.detailed.get(id)!;
      this.applyAppearance(mesh);
      this.callbacks.detail(id, "ready");
      this.invalidate();
    }
  }
  private surfaceColor(region: ViewerRegion) {
    if (this.state.selected === region.id) return "#40b8b0";
    if (this.hovered === region.id) return "#e3a637";
    if (this.state.colorMode !== "tissue") return region.color;
    if (region.group === "Ventricles") return "#85bfd3";
    return region.kind === "cortex" ? "#c6ada2" : "#b9ada0";
  }
  private applyAppearance(mesh: AtlasMesh) {
    const region = mesh.userData.region as ViewerRegion;
    const selected = this.state.selected === region.id;
    const hovered = this.hovered === region.id;
    const color = this.surfaceColor(region);
    if (mesh.geometry.userData.color !== color)
      this.recolor(mesh.geometry, color);
    mesh.material.emissive.set(
      selected ? "#3ca99d" : hovered ? "#b97e25" : "#000000",
    );
    mesh.material.emissiveIntensity = selected || hovered ? 0.22 : 0;
    mesh.material.polygonOffset = selected || hovered;
    mesh.material.polygonOffsetFactor = 1;
    mesh.material.polygonOffsetUnits = 1;
  }
  private createOutline(color: string) {
    const outline = new THREE.LineSegments(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
      }),
    );
    outline.visible = false;
    outline.renderOrder = 2;
    return outline;
  }
  private syncOutline(
    outline: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>,
    id: string | null,
  ) {
    const mesh = id ? this.meshes.get(id) : null;
    outline.visible = !!mesh?.visible && mesh.userData.region.kind === "cortex";
    if (!outline.visible || !mesh) return;
    if (outline.userData.source !== mesh.geometry) {
      outline.geometry.dispose();
      outline.geometry = meshBoundary(mesh.geometry);
      outline.userData.source = mesh.geometry;
    }
    outline.position.copy(mesh.position);
    outline.material.clippingPlanes = mesh.material.clippingPlanes;
    outline.material.opacity = mesh.material.opacity;
  }
  focus(id: string) {
    const mesh = this.meshes.get(id);
    if (!mesh) return;
    const sphere = mesh.geometry.boundingSphere!;
    const target = sphere.center.clone();
    const distance = this.focusDistance(sphere.radius);
    const dir = new THREE.Vector3()
      .subVectors(this.camera.position, this.controls.target)
      .normalize();
    this.cameraGoal = {
      target,
      position: target.clone().addScaledVector(dir, distance),
    };
    this.invalidate();
  }
  fit(direction?: THREE.Vector3) {
    const bounds = new THREE.Box3();
    for (const mesh of this.meshes.values()) {
      if (!mesh.visible) continue;
      bounds.union(
        mesh.geometry.boundingBox!.clone().translate(mesh.userData.explode),
      );
    }
    if (bounds.isEmpty()) return;
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const dir =
      direction ??
      this.camera.position.clone().sub(this.controls.target).normalize();
    this.cameraGoal = {
      target: sphere.center,
      position: sphere.center
        .clone()
        .addScaledVector(dir, this.focusDistance(sphere.radius)),
    };
    this.invalidate();
  }
  view(name: string) {
    this.pointerLeave();
    const positions: Record<string, number[]> = {
      default: [-282, 108, -179],
      left: [-360, 15, 15],
      right: [360, 15, 15],
      anterior: [0, 10, -370],
      posterior: [0, 10, 390],
      superior: [0, 380, 10],
      inferior: [0, -360, 10],
    };
    const coords = positions[name] || positions.default;
    const target = new THREE.Vector3(0, 5, 10);
    if (this.dataset.fitOnLoad) {
      this.fit(
        new THREE.Vector3(...(coords as [number, number, number]))
          .sub(target)
          .normalize(),
      );
      return;
    }
    const position = new THREE.Vector3(...(coords as [number, number, number]))
      .sub(target)
      .multiplyScalar(this.framing * (1 + this.state.exploded * 0.7))
      .add(target);
    const regionMesh =
      this.state.isolated && this.state.selected
        ? this.meshes.get(this.state.selected)
        : null;
    if (regionMesh) {
      const sphere = regionMesh.geometry.boundingSphere!;
      const direction = position.clone().sub(target).normalize();
      target.copy(sphere.center);
      position
        .copy(target)
        .addScaledVector(
          direction,
          this.focusDistance(sphere.radius),
        );
    }
    this.cameraGoal = { position, target };
    this.invalidate();
  }
  private focusDistance(radius: number) {
    return sphereFocusDistance(
      radius,
      this.framing,
      this.dataset.fitOnLoad ? 1 : 35,
    );
  }
  zoom(amount: number) {
    this.stopFlight();
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(amount)
      .add(this.controls.target);
    this.invalidate();
  }
  reset() {
    this.controls.target.set(0, 5, 10);
    this.view("default");
  }
  screenshot() {
    this.renderer.render(this.scene, this.camera);
    const a = document.createElement("a");
    a.download = "cerebra-atlas.png";
    a.href = this.renderer.domElement.toDataURL("image/png");
    a.click();
  }
  private stopFlight = () => {
    this.cameraGoal = null;
    this.pointerLeave();
    this.invalidate();
  };
  private contextLost = (event: Event) => {
    event.preventDefault();
    this.callbacks.error(
      "The graphics context was interrupted. Reload the atlas to restore the model.",
    );
  };
  private visibilityChanged = () => {
    if (!document.hidden) this.invalidate();
  };
  private resize = () => {
    this.pointerLeave();
    const { width, height } = this.element.getBoundingClientRect();
    if (!width || !height) return;
    this.camera.aspect = width / height;
    const framing = perspectiveFraming(this.camera.aspect, this.camera.fov);
    this.controls.maxDistance = Math.min(2100, 850 * framing);
    this.camera.position
      .sub(this.controls.target)
      .multiplyScalar(framing / this.framing)
      .add(this.controls.target);
    if (this.cameraGoal) {
      this.cameraGoal.position
        .sub(this.cameraGoal.target)
        .multiplyScalar(framing / this.framing)
        .add(this.cameraGoal.target);
    }
    this.framing = framing;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.invalidate();
  };
  private hit(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(
      [...this.meshes.values()].filter(
        (m) => m.visible && m.material.opacity > 0.15,
      ),
    );
    return hits.find(
      (hit) =>
        !(hit.object as AtlasMesh).material.clippingPlanes?.some(
          (p) => p.distanceToPoint(hit.point) < 0,
        ),
    );
  }
  private pointerDown = (event: PointerEvent) => {
    this.pointerLeave();
    this.down = { x: event.clientX, y: event.clientY };
  };
  private pointerUp = (event: PointerEvent) => {
    if (
      event.button !== 0 ||
      Math.hypot(event.clientX - this.down.x, event.clientY - this.down.y) > 5
    )
      return;
    const hit = this.hit(event);
    if (hit)
      this.callbacks.select((hit.object.userData.region as ViewerRegion).id);
  };
  private pointerMove = (event: PointerEvent) => {
    if (event.buttons || event.pointerType === "touch") return;
    const hit = this.hit(event);
    const id = hit ? (hit.object.userData.region as ViewerRegion).id : null;
    if (id !== this.hovered) {
      const previous = this.hovered ? this.meshes.get(this.hovered) : null;
      this.hovered = id;
      this.controls.autoRotate = this.state.autoRotate && !id;
      if (previous) this.applyAppearance(previous);
      if (id) this.applyAppearance(this.meshes.get(id)!);
      this.invalidate();
    }
    this.renderer.domElement.style.cursor = id ? "pointer" : "grab";
    this.callbacks.hover(id, event.clientX, event.clientY);
  };
  private pointerLeave = () => {
    const mesh = this.hovered ? this.meshes.get(this.hovered) : null;
    if (!this.hovered) return;
    this.hovered = null;
    if (mesh) this.applyAppearance(mesh);
    this.controls.autoRotate = this.state.autoRotate;
    this.renderer.domElement.style.cursor = "grab";
    this.callbacks.hover(null, 0, 0);
    this.invalidate();
  };
  setActive(active: boolean) {
    this.active = active;
    if (active) this.invalidate();
    else {
      this.pointerLeave();
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
  }
  private invalidate = () => {
    if (this.disposed) return;
    this.framesLeft = 35;
    if (!this.frame && !document.hidden && this.active) {
      this.statsTime = performance.now();
      this.statsFrames = 0;
      this.frame = requestAnimationFrame(this.render);
    }
  };
  private render = (time: number) => {
    this.frame = -1;
    if (this.disposed || document.hidden || !this.active) {
      this.frame = 0;
      return;
    }
    const dt = Math.min((time - this.lastFrame) / 1000, 0.05);
    this.lastFrame = time;
    let moving = false;
    if (this.cameraGoal) {
      const t = 1 - Math.exp(-dt * 7);
      const current = new THREE.Spherical().setFromVector3(
        this.camera.position.clone().sub(this.controls.target),
      );
      const goal = new THREE.Spherical().setFromVector3(
        this.cameraGoal.position.clone().sub(this.cameraGoal.target),
      );
      const angle =
        THREE.MathUtils.euclideanModulo(
          goal.theta - current.theta + Math.PI,
          Math.PI * 2,
        ) - Math.PI;
      current.theta += angle * t;
      current.phi = THREE.MathUtils.lerp(current.phi, goal.phi, t);
      current.radius = THREE.MathUtils.lerp(current.radius, goal.radius, t);
      current.makeSafe();
      this.controls.target.lerp(this.cameraGoal.target, t);
      this.camera.position
        .copy(this.controls.target)
        .add(new THREE.Vector3().setFromSpherical(current));
      if (this.camera.position.distanceTo(this.cameraGoal.position) < 0.03) {
        this.cameraGoal = null;
      } else moving = true;
    }
    for (const mesh of this.meshes.values()) {
      const goal = mesh.userData.explode as THREE.Vector3;
      if (mesh.position.distanceToSquared(goal) > 0.001) {
        mesh.position.lerp(goal, 1 - Math.exp(-dt * 8));
        moving = true;
      }
    }
    this.controls.update();
    this.syncOutline(
      this.hoverOutline,
      this.hovered === this.state.selected ? null : this.hovered,
    );
    this.syncOutline(this.selectionOutline, this.state.selected);
    this.renderer.render(this.scene, this.camera);
    if (this.state.labels) {
      const right =
        this.state.hemisphere === "right" ||
        (this.state.hemisphere === "both" &&
          this.camera.position.x > this.controls.target.x);
      const keys = right
        ? labelKeys.map((id) =>
            id === "aseg-8" ? "aseg-47" : id.replace("lh-", "rh-"),
          )
        : labelKeys;
      const pts = keys
        .map((id) => {
          const mesh = this.meshes.get(id);
          if (!mesh?.visible) return null;
          const position = new THREE.Vector3(
            ...((mesh.userData.region as ViewerRegion).center as [
              number,
              number,
              number,
            ]),
          )
            .add(mesh.position)
            .project(this.camera);
          if (position.z > 1) return null;
          return {
            id,
            x:
              this.element.offsetLeft +
              ((position.x + 1) * this.element.clientWidth) / 2,
            y:
              this.element.offsetTop +
              ((1 - position.y) * this.element.clientHeight) / 2,
          };
        })
        .filter((x): x is { id: string; x: number; y: number } => !!x);
      this.callbacks.label(pts);
    }
    this.statsFrames++;
    if (
      !this.statsTime ||
      time - this.statsTime > 1000 ||
      this.lastTriangles !== this.renderer.info.render.triangles
    ) {
      this.lastTriangles = this.renderer.info.render.triangles;
      this.callbacks.stats(
        Math.min(
          60,
          Math.round((this.statsFrames * 1000) / (time - this.statsTime)),
        ),
        this.renderer.info.render.triangles,
      );
      this.statsTime = time;
      this.statsFrames = 0;
    }
    this.frame =
      moving || this.state.autoRotate || --this.framesLeft > 0
        ? requestAnimationFrame(this.render)
        : 0;
  };
  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    this.loadController.abort();
    this.resizeObserver.disconnect();
    this.controls.dispose();
    document.removeEventListener("visibilitychange", this.visibilityChanged);
    this.renderer.domElement.removeEventListener(
      "pointerdown",
      this.pointerDown,
    );
    this.renderer.domElement.removeEventListener("pointerup", this.pointerUp);
    this.renderer.domElement.removeEventListener(
      "pointermove",
      this.pointerMove,
    );
    this.renderer.domElement.removeEventListener(
      "pointerleave",
      this.pointerLeave,
    );
    this.renderer.domElement.removeEventListener(
      "webglcontextlost",
      this.contextLost,
    );
    for (const mesh of this.meshes.values()) mesh.material.dispose();
    for (const g of this.base.values()) g.dispose();
    for (const g of this.detailed.values()) g.dispose();
    for (const outline of [this.hoverOutline, this.selectionOutline]) {
      outline.geometry.dispose();
      outline.material.dispose();
    }
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
