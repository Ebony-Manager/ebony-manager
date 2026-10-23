import type * as Three from "three";

import type { BoxState, Scene, SceneGroup, SceneMat } from "@/lib/cotizador/scene";
import type { Wall } from "@/types/cotizador";

/**
 * Motor del visor 3D — three.js puro, sin React. `viewer-3d.tsx` lo crea
 * una vez y le pasa la escena (`buildScene`) cada vez que cambia el ítem.
 *
 * Interacción: arrastrar una pieza la mueve por su pared (cada 5 cm, se
 * pega al piso); pasar la esquina la cambia de pared. Arrastrar una
 * pieza montada (gaveta, tablilla, puerta) mueve su mueble, y si se
 * suelta sobre otro módulo pasa a ese módulo. Arrastrar el fondo gira la
 * vista; la rueda acerca.
 */
export interface ViewerCallbacks {
  onMove: (lineId: string, wall: Wall, along: number, y: number) => void;
  onHost: (lineId: string, hostLineId: string) => void;
}

export interface Viewer {
  setScene: (scene: Scene, paintHex: string) => void;
  resize: () => void;
  dispose: () => void;
}

interface Meta {
  lineId: string;
  kind: "free" | "hosted";
  isModule: boolean;
  locked: boolean;
  wall: Wall;
  along: number;
  y: number;
  w: number;
  h: number;
}

const STAGE = "#efe9df";

export function createViewer(T: typeof Three, canvas: HTMLCanvasElement, cb: ViewerCallbacks): Viewer {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  const scene3 = new T.Scene();
  scene3.background = new T.Color(STAGE);
  const cam = new T.PerspectiveCamera(32, 1, 0.05, 80);
  scene3.add(new T.HemisphereLight(0xffffff, 0xb7a68c, 2.4));
  const sun = new T.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-4, 7, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0015;
  scene3.add(sun);

  const plane = (w: number, h: number, color: string) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ color, roughness: 1 }));
    m.receiveShadow = true;
    return m;
  };
  const wallA = plane(40, 12, "#f3eee6");
  wallA.position.set(0, 6, -0.001);
  const wallB = plane(20, 12, "#ece6db");
  wallB.rotation.y = -Math.PI / 2;
  wallB.position.set(0, 6, 10);
  wallB.visible = false;
  const floor = plane(40, 20, "#e3dacb");
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = 10;
  scene3.add(wallA, wallB, floor);

  const root = new T.Group();
  const anno = new T.Group();
  scene3.add(root, anno);
  const meta = new WeakMap<Three.Object3D, Meta>();

  // Veta de madera dibujada en un canvas: aglomerado claro y chapilla nogal.
  const grain = (base: string) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = base;
      g.fillRect(0, 0, 256, 256);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 90; i++) {
        g.strokeStyle = `rgba(40,22,8,${0.04 + rnd() * 0.12})`;
        g.lineWidth = 0.5 + rnd() * 2;
        const x = rnd() * 256;
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + rnd() * 8 - 4, 90, x + rnd() * 8 - 4, 170, x + rnd() * 6 - 3, 256);
        g.stroke();
      }
    }
    const t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.colorSpace = T.SRGBColorSpace;
    return t;
  };
  const textures = { aglomerado: grain("#c9a878"), chapilla: grain("#8a5a34") };
  const mats = new Map<string, Three.Material>();
  let paint = "#d9d3c7";

  const material = (m: SceneMat): Three.Material => {
    if (m.kind === "finish") {
      const rx = Math.max(1, Math.round(m.w / 0.6));
      const ry = Math.max(1, Math.round(m.h / 1.2));
      const key = ["f", m.finish, m.finish === "pintado" ? paint : "", rx, ry, m.dark ? 1 : 0, m.clear ? 1 : 0].join("|");
      const hit = mats.get(key);
      if (hit) return hit;
      const k = m.dark ? 0.86 : 1;
      let made: Three.MeshStandardMaterial;
      if (m.finish === "pintado") made = new T.MeshStandardMaterial({ color: new T.Color(paint).multiplyScalar(k), roughness: 0.55 });
      else if (m.finish === "blanco") made = new T.MeshStandardMaterial({ color: new T.Color("#f2efe9").multiplyScalar(k), roughness: 0.7 });
      else {
        const tex = textures[m.finish === "chapilla" ? "chapilla" : "aglomerado"].clone();
        tex.needsUpdate = true;
        tex.repeat.set(rx, ry);
        made = new T.MeshStandardMaterial({ map: tex, color: new T.Color(k, k, k), roughness: 0.7 });
      }
      if (m.clear) {
        made.transparent = true;
        made.opacity = 0.5;
      }
      mats.set(key, made);
      return made;
    }
    const key = m.kind === "mirror" || m.kind === "ref" ? `${m.kind}|${m.tone}` : m.kind;
    const hit = mats.get(key);
    if (hit) return hit;
    const made =
      m.kind === "stone"
        ? new T.MeshStandardMaterial({ color: "#bdb6ab", roughness: 0.9 })
        : m.kind === "ref"
          ? new T.MeshStandardMaterial({ color: m.tone === "ac" ? "#f1f1ee" : "#161616", roughness: m.tone === "ac" ? 0.6 : 0.35 })
          : m.kind === "glass"
        ? new T.MeshStandardMaterial({ color: "#bcd6d8", transparent: true, opacity: 0.45, roughness: 0.1 })
        : m.kind === "led"
          ? new T.MeshStandardMaterial({ color: "#ffe6b0", emissive: "#ffd27a", emissiveIntensity: 1 })
          : new T.MeshStandardMaterial({
              color: m.tone === "bronce" ? "#6b5236" : m.tone === "claro" ? "#c9d3d6" : "#3b4043",
              metalness: 0.85,
              roughness: 0.12,
            });
    mats.set(key, made);
    return made;
  };

  // Resaltado de un renglón (dorado) o de lo que quedó sin cotizar (rojizo).
  const withState = (base: Three.Material, state?: BoxState): Three.Material => {
    if (!state) return base;
    const key = `${base.uuid}|${state}`;
    const hit = mats.get(key);
    if (hit) return hit;
    const made = (base as Three.MeshStandardMaterial).clone();
    made.emissive = new T.Color(state === "selected" ? "#c9a84c" : "#b0412b");
    made.emissiveIntensity = state === "selected" ? 0.6 : 0.5;
    mats.set(key, made);
    return made;
  };

  const view = { az: -0.5, el: 0.2, zoom: 1, dist: 6, target: new T.Vector3(0, 1, 0) };
  let corner = { on: false, at: 0 };

  const render = () => {
    const d = view.dist * view.zoom;
    cam.position.set(
      view.target.x + d * Math.sin(view.az) * Math.cos(view.el),
      view.target.y + d * Math.sin(view.el),
      view.target.z + d * Math.cos(view.az) * Math.cos(view.el)
    );
    cam.lookAt(view.target);
    renderer.render(scene3, cam);
  };

  const seat = (g: Three.Object3D, wall: Wall, along: number, y: number) => {
    const m = meta.get(g);
    if (m) Object.assign(m, { wall, along, y });
    if (wall === "B") {
      g.position.set(corner.at, y, along);
      g.rotation.y = -Math.PI / 2;
    } else {
      g.position.set(along, y, 0);
      g.rotation.y = 0;
    }
  };

  const clear = () => {
    root.traverse((o) => {
      if (o instanceof T.Mesh) o.geometry.dispose();
    });
    root.clear();
    anno.traverse((o) => {
      if (o instanceof T.Line) {
        o.geometry.dispose();
        (o.material as Three.Material).dispose();
      } else if (o instanceof T.Sprite) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    anno.clear();
  };

  const build = (sg: SceneGroup, parent: Three.Object3D) => {
    const g = new T.Group();
    meta.set(g, { lineId: sg.lineId, kind: sg.kind, isModule: sg.isModule, locked: !!sg.locked, wall: sg.wall, along: sg.along, y: sg.y, w: sg.w, h: sg.h });
    for (const b of sg.boxes) {
      const mesh = new T.Mesh(new T.BoxGeometry(b.w, b.h, b.d), withState(material(b.mat), b.state));
      mesh.position.set(b.x + b.w / 2, b.y + b.h / 2, b.z + b.d / 2);
      mesh.castShadow = mesh.receiveShadow = true;
      g.add(mesh);
    }
    parent.add(g);
    if (sg.kind === "free") seat(g, sg.wall, sg.along, sg.y);
    for (const child of sg.children) build(child, g);
  };

  const label = (text: string, x: number, y: number, z: number, scale: number) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const g = c.getContext("2d");
    if (g) {
      g.font = "600 34px 'Work Sans', system-ui, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#6b5744";
      g.fillText(text, 128, 34);
    }
    const tex = new T.CanvasTexture(c);
    tex.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false }));
    sp.scale.set(scale * 2, scale * 0.5, 1);
    sp.position.set(x, y, z);
    anno.add(sp);
  };
  const rule = (a: [number, number, number], b: [number, number, number]) =>
    anno.add(
      new T.Line(
        new T.BufferGeometry().setFromPoints([new T.Vector3(...a), new T.Vector3(...b)]),
        new T.LineBasicMaterial({ color: "#8c7a4f" })
      )
    );

  // Encuadre: la distancia de la cámara depende del tamaño del conjunto y
  // de la proporción del lienzo, así que se recalcula también al cambiar
  // el tamaño de la ventana (no solo al cambiar la escena).
  let lastFit = "";
  let fitBox: { size: Three.Vector3; ctr: Three.Vector3; corner: boolean } | null = null;
  const fit = () => {
    if (!fitBox) return;
    const { size, ctr, corner: isCorner } = fitBox;
    view.target.set(ctr.x, (ctr.y + size.y / 2) / 2, ctr.z);
    const fov = (cam.fov * Math.PI) / 180;
    const wide = Math.max(size.x, isCorner ? size.z : 0);
    const need = Math.max(size.y * 1.25, (wide * 1.3) / Math.max(0.5, cam.aspect));
    view.dist = need / (2 * Math.tan(fov / 2)) + Math.max(size.z, isCorner ? size.x * 0.4 : 0);
  };
  const setScene = (s: Scene, paintHex: string) => {
    paint = paintHex;
    corner = { on: s.isCorner, at: s.cornerAt };
    clear();
    wallB.visible = s.isCorner;
    wallB.position.x = s.cornerAt;
    for (const g of s.groups) build(g, root);

    const bb = new T.Box3().setFromObject(root);
    if (bb.isEmpty()) {
      view.target.set(s.isCorner ? s.cornerAt / 2 : 0, 1, 0);
      view.dist = 6;
      render();
      return;
    }
    const size = bb.getSize(new T.Vector3());
    const ctr = bb.getCenter(new T.Vector3());
    const off = Math.max(0.12, size.y * 0.06);
    const zf = bb.max.z + 0.02;
    const xr = s.isCorner ? bb.min.x - off : bb.max.x + off;
    const k = Math.max(0.5, Math.max(size.x, size.y) * 0.16);
    rule([bb.min.x, 0.002, zf + off], [bb.max.x, 0.002, zf + off]);
    label(`${size.x.toFixed(2)} m`, ctr.x, 0.02, zf + off * 2.6, k);
    rule([xr, 0, zf], [xr, bb.max.y, zf]);
    label(`${bb.max.y.toFixed(2)} m`, xr + (s.isCorner ? -1 : 1) * off * 3.6, ctr.y, zf, k);
    if (s.isCorner && size.z > 0.6) label(`${size.z.toFixed(2)} m`, bb.max.x - off, 0.02, ctr.z, k);

    // Solo se reencuadra si cambió el tamaño del conjunto (no al resaltar).
    const key = [size.x, size.y, size.z, ctr.x].map((v) => v.toFixed(2)).join("|");
    if (key !== lastFit) {
      lastFit = key;
      fitBox = { size, ctr, corner: s.isCorner };
      fit();
    }
    render();
  };

  // ── Selección y arrastre ──────────────────────────────────────────────
  const ray = new T.Raycaster();
  const ndc = new T.Vector2();
  const aim = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
  };
  const pick = (test: (m: Meta) => boolean): Three.Object3D | null => {
    const hit = ray.intersectObjects(root.children, true)[0];
    let o: Three.Object3D | null = hit ? hit.object : null;
    while (o && o !== root) {
      const m = meta.get(o);
      if (m && test(m)) return o;
      o = o.parent;
    }
    return null;
  };
  const hitWall = (): { wall: Wall; along: number; y: number } | null => {
    const o = ray.ray.origin;
    const d = ray.ray.direction;
    if (Math.abs(d.z) > 1e-6) {
      const t = -o.z / d.z;
      const x = o.x + d.x * t;
      if (t > 0 && (!corner.on || x <= corner.at)) return { wall: "A", along: x, y: o.y + d.y * t };
    }
    if (corner.on && Math.abs(d.x) > 1e-6) {
      const t = (corner.at - o.x) / d.x;
      if (t > 0) return { wall: "B", along: o.z + d.z * t, y: o.y + d.y * t };
    }
    return null;
  };
  const snap = (v: number) => Math.round(v * 20) / 20;

  type Drag =
    | { orbit: true; x: number; y: number }
    | { orbit: false; g: Three.Object3D; piece: string | null; off: { a: number; y: number }; moved: boolean };
  let drag: Drag | null = null;

  const onDown = (e: PointerEvent) => {
    aim(e);
    let g = pick(() => true);
    let piece: string | null = null;
    const gm = g ? meta.get(g) : undefined;
    if (g && gm && gm.kind === "hosted") {
      piece = gm.lineId;
      g = g.parent;
    }
    const m = g ? meta.get(g) : undefined;
    if (g && m && !m.locked) {
      const h = hitWall();
      drag = {
        orbit: false,
        g,
        piece,
        off: h && h.wall === m.wall ? { a: h.along - m.along, y: h.y - m.y } : { a: m.w / 2, y: m.h / 2 },
        moved: false,
      };
    } else {
      drag = { orbit: true, x: e.clientX, y: e.clientY };
    }
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent) => {
    if (!drag) {
      aim(e);
      canvas.style.cursor = pick((x) => !x.locked) ? "move" : "grab";
      return;
    }
    if (drag.orbit) {
      view.az = Math.max(-1.45, Math.min(1.45, view.az - (e.clientX - drag.x) * 0.008));
      view.el = Math.max(0.02, Math.min(1.2, view.el + (e.clientY - drag.y) * 0.006));
      drag.x = e.clientX;
      drag.y = e.clientY;
      render();
      return;
    }
    const m = meta.get(drag.g);
    aim(e);
    const h = hitWall();
    if (!m || !h) return;
    drag.moved = true;
    let along = Math.max(0, snap(h.along - (h.wall === m.wall ? drag.off.a : m.w / 2)));
    const rawY = h.y - drag.off.y;
    const y = rawY < 0.12 ? 0 : snap(rawY);
    if (corner.on && h.wall === "A") along = Math.min(along, Math.max(0, snap(corner.at - m.w)));
    seat(drag.g, h.wall, along, y);
    render();
  };
  const onUp = (e: PointerEvent) => {
    const d = drag;
    drag = null;
    if (!d || d.orbit || !d.moved) return;
    const m = meta.get(d.g);
    if (!m) return;
    if (d.piece) {
      // ¿Se soltó sobre OTRO módulo? El mueble arrastrado se saca del
      // rayo (capa 1) para ver qué hay debajo.
      d.g.traverse((o) => o.layers.set(1));
      aim(e);
      const other = pick((x) => x.isModule);
      const om = other ? meta.get(other) : undefined;
      if (om) {
        cb.onHost(d.piece, om.lineId);
        return;
      }
    }
    cb.onMove(m.lineId, m.wall, m.along, m.y);
  };
  const onCancel = () => {
    drag = null;
  };
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    view.zoom = Math.max(0.45, Math.min(2.4, view.zoom * (e.deltaY > 0 ? 1.08 : 0.93)));
    render();
  };

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    cam.aspect = w / h;
    cam.updateProjectionMatrix();
    fit();
    render();
  };

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onCancel);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  return {
    setScene,
    resize,
    dispose: () => {
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onCancel);
      canvas.removeEventListener("wheel", onWheel);
      clear();
      mats.forEach((m) => m.dispose());
      textures.aglomerado.dispose();
      textures.chapilla.dispose();
      renderer.dispose();
    },
  };
}
