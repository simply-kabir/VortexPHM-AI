"use client";

/**
 * Interactive procedural-quality 3D engine built from the processed GLB (public/models/engine.glb).
 * Interactions: click a station, orbit + idle auto-rotate, risk tint (+ wireframe overlay on hot stations),
 * live updates from `stationRisk` (replay sync), exploded view.
 * Fallback: 2D schematic when WebGL is unavailable.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { Environment, Html, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { STATIONS, type GroupName, type Station } from "@/lib/stations";
import type { StationRisk } from "@/lib/risk";
import EngineSchematic2D from "./EngineSchematic2D";

const MODEL_URL = "/models/engine.glb";
const EXPLODE_K = 0.6;          // fraction of the centre-to-centre distance added when exploded
const BASE = new THREE.Color("#aab2bf");
const WARN = new THREE.Color("#EAB308");
const CRIT = new THREE.Color("#EF4444");
const BRAND = new THREE.Color("#F97316");
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export interface EngineViewerProps {
  stationRisk: StationRisk;
  selected: Station | null;
  onSelect: (s: Station | null) => void;
  exploded: boolean;
  autoRotate: boolean;
  className?: string;
}

interface Built {
  root: THREE.Group;
  groups: Record<GroupName, THREE.Group>;
  centerX: Record<GroupName, number>;
  topY: Record<GroupName, number>;
  mats: Record<GroupName, THREE.MeshStandardMaterial>;
  wires: Record<GroupName, THREE.MeshBasicMaterial>;
  wireMeshes: Record<GroupName, THREE.Mesh[]>;
  midX: number;
}

function build(src: THREE.Object3D): Built {
  const scene = src.clone(true);
  scene.updateMatrixWorld(true);
  const names: GroupName[] = [...STATIONS.map((s) => s.id), "shaft"];
  const root = new THREE.Group();
  const groups = {} as Record<GroupName, THREE.Group>;
  const mats = {} as Record<GroupName, THREE.MeshStandardMaterial>;
  const wires = {} as Record<GroupName, THREE.MeshBasicMaterial>;
  const wireMeshes = {} as Record<GroupName, THREE.Mesh[]>;
  for (const n of names) {
    const g = new THREE.Group(); g.name = n; groups[n] = g; root.add(g);
    mats[n] = new THREE.MeshStandardMaterial({ color: BASE, metalness: 0.85, roughness: 0.38, envMapIntensity: 1.1 });
    wires[n] = new THREE.MeshBasicMaterial({ color: CRIT, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
    wireMeshes[n] = [];
  }
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh); });
  for (const m of meshes) {
    const raw = (m.userData?.station ?? m.parent?.userData?.station ?? m.name.split("__")[0]) as string;
    const st = (names.includes(raw as GroupName) ? raw : "shaft") as GroupName;
    groups[st].attach(m);                       // root is still identity here, so world transforms are preserved
    m.userData.station = st;
    m.material = mats[st];
    const wire = new THREE.Mesh(m.geometry, wires[st]);
    wire.raycast = () => {};                    // overlay must not steal clicks
    wire.visible = false;
    m.add(wire);
    wireMeshes[st].push(wire);
  }
  root.updateMatrixWorld(true);
  const centerX = {} as Record<GroupName, number>;
  const topY = {} as Record<GroupName, number>;
  for (const n of names) {
    const b = new THREE.Box3().setFromObject(groups[n]);
    centerX[n] = (b.min.x + b.max.x) / 2;
    topY[n] = b.max.y;
  }
  const all = new THREE.Box3().setFromObject(root);
  const size = all.getSize(new THREE.Vector3());
  const c = all.getCenter(new THREE.Vector3());
  const s = 10 / Math.max(size.x, size.y, size.z);   // longest side -> 10 scene units
  root.scale.setScalar(s);
  root.position.copy(c).multiplyScalar(-s);
  return { root, groups, centerX, topY, mats, wires, wireMeshes, midX: c.x };
}

function EngineModel({ stationRisk, selected, onSelect, exploded, reduced }: Omit<EngineViewerProps, "autoRotate" | "className"> & { reduced: boolean }) {
  const gltf = useGLTF(MODEL_URL, false);        // meshopt-compressed, no Draco/CDN needed
  const built = useMemo(() => build(gltf.scene), [gltf.scene]);
  const disp = useRef<Record<string, { risk: number; dim: number; sel: number }>>({});
  const [hover, setHover] = useState<Station | null>(null);
  const lambda = reduced ? 1000 : 6;

  useEffect(() => () => { // dispose our own materials/overlays on unmount
    Object.values(built.mats).forEach((m) => m.dispose());
    Object.values(built.wires).forEach((m) => m.dispose());
  }, [built]);

  useFrame((_, dt) => {
    const k = Math.min(dt, 0.05);
    for (const s of STATIONS) {
      const d = (disp.current[s.id] ??= { risk: 0, dim: 1, sel: 0 });
      d.risk = THREE.MathUtils.damp(d.risk, stationRisk[s.id] ?? 0, lambda, k);
      d.dim = THREE.MathUtils.damp(d.dim, selected && selected !== s.id ? 0.5 : 1, lambda, k);
      d.sel = THREE.MathUtils.damp(d.sel, selected === s.id ? 1 : 0, lambda, k);
      const m = built.mats[s.id];
      const toWarn = smooth(0.15, 0.55, d.risk);
      const toCrit = smooth(0.55, 1.0, d.risk);
      m.color.copy(BASE).lerp(WARN, toWarn * 0.85).lerp(CRIT, toCrit).multiplyScalar(d.dim);
      m.emissive.copy(CRIT).multiplyScalar(0.25 * toCrit).add(BRAND.clone().multiplyScalar(0.22 * d.sel));
      const w = built.wires[s.id];
      w.opacity = smooth(0.45, 0.9, d.risk) * 0.5;
      const on = w.opacity > 0.01;
      for (const mesh of built.wireMeshes[s.id]) mesh.visible = on;
      // exploded view: slide stations apart along the engine axis
      const off = exploded ? (built.centerX[s.id] - built.midX) * EXPLODE_K : 0;
      const g = built.groups[s.id];
      g.position.x = THREE.MathUtils.damp(g.position.x, off, lambda, k);
    }
    // the shaft keeps its place so the stations visibly separate along it
    built.mats.shaft.color.copy(BASE).multiplyScalar(selected ? 0.55 : 0.9);
  });

  const stationOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    const id = e.object.userData?.station as GroupName | undefined;
    return id && id !== "shaft" ? (id as Station) : null;
  };

  return (
    <primitive
      object={built.root}
      onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); const s = stationOf(e); onSelect(s && s === selected ? null : s); }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); const s = stationOf(e); setHover(s); document.body.style.cursor = s ? "pointer" : "auto"; }}
      onPointerOut={() => { setHover(null); document.body.style.cursor = "auto"; }}
    >
      {STATIONS.map((s) => {
        const show = exploded || hover === s.id || selected === s.id;
        const r = Math.round((stationRisk[s.id] ?? 0) * 100);
        return (
          <primitive key={s.id} object={built.groups[s.id]}>
            <Html position={[built.centerX[s.id], built.topY[s.id] + 0.04, 0]} center distanceFactor={14} zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
              <div className={`whitespace-nowrap rounded-chip border border-line bg-canvas/80 px-2 py-1 text-center backdrop-blur transition-opacity duration-base ${show ? "opacity-100" : "opacity-0"}`}>
                <div className="text-xs font-semibold text-fg">{s.label}</div>
                <div className="num text-[10px] text-fg-2">{r}% risk</div>
              </div>
            </Html>
          </primitive>
        );
      })}
    </primitive>
  );
}

function hasWebGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
}

export default function EngineViewer3D(props: EngineViewerProps) {
  const { stationRisk, selected, onSelect, exploded, autoRotate, className } = props;
  const wrap = useRef<HTMLDivElement>(null);
  const [gl, setGl] = useState<boolean | null>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setGl(hasWebGL());
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  if (gl === false) {
    return <div ref={wrap} className={className}><EngineSchematic2D stationRisk={stationRisk} selected={selected} onSelect={onSelect} /></div>;
  }

  return (
    <div ref={wrap} className={className}>
      {gl && (
        <Canvas
          dpr={[1, 1.5]}
          frameloop={visible ? "always" : "never"}
          camera={{ position: [8.5, 3.6, 12.5], fov: 32, near: 0.1, far: 100 }}
          gl={{ antialias: true, alpha: true }}
          onPointerMissed={() => onSelect(null)}
        >
          <hemisphereLight args={["#cbd5e1", "#1e293b", 0.55]} />
          <directionalLight position={[6, 8, 6]} intensity={1.6} />
          <directionalLight position={[-8, 3, -6]} intensity={0.7} color="#93c5fd" />
          {/* in-scene environment: no HDR downloads, works offline */}
          <Environment resolution={128}>
            <Lightformer form="rect" intensity={2.2} position={[0, 6, 4]} scale={[12, 3, 1]} />
            <Lightformer form="rect" intensity={1.2} position={[-8, 1, -2]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} color="#93c5fd" />
            <Lightformer form="rect" intensity={0.8} position={[8, 0, 3]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} color="#fdba74" />
          </Environment>
          <Suspense fallback={null}>
            <EngineModel stationRisk={stationRisk} selected={selected} onSelect={onSelect} exploded={exploded} reduced={reduced} />
          </Suspense>
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={8}
            maxDistance={26}
            maxPolarAngle={Math.PI * 0.62}
            minPolarAngle={Math.PI * 0.22}
            autoRotate={autoRotate && !interacting && !reduced}
            autoRotateSpeed={0.7}
            onStart={() => { setInteracting(true); if (idle.current) clearTimeout(idle.current); }}
            onEnd={() => { if (idle.current) clearTimeout(idle.current); idle.current = setTimeout(() => setInteracting(false), 4000); }}
          />
        </Canvas>
      )}
    </div>
  );
}

useGLTF.preload(MODEL_URL, false);
