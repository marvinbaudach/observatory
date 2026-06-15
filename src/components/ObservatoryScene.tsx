'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerformanceMonitor, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { PROJECTS, type ProjectId, type Project } from '@/lib/projects';
import { CameraRig }      from './CameraRig';
import { ProjectObject, surfaceTexture } from './ProjectObject';
import { Particles }      from './Particles';
import { Nebula }         from './Nebula';
import { PostProcessing } from './PostProcessing';
import { InfoPanel }      from './InfoPanel';

// Orbiting key light — decay=0 so it actually reaches the objects (a default
// point light falls off as 1/d² and was effectively invisible at this scale).
// Its motion sweeps specular highlights across the textured, metallic facets.
function OrbitLight({ color }: { color: string }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.4;
    ref.current.position.set(Math.cos(t) * 9, Math.sin(t * 0.7) * 6 + 2, Math.sin(t) * 9);
  });
  return <pointLight ref={ref} intensity={2.6} decay={0} color={color} />;
}

// Second procedural texture: sharp interference ridges, used by the "crystal"
// material style so polished objects catch light along gem-like facets instead
// of the soft value-noise glow the project objects use.
let _gemTex: THREE.DataTexture | null = null;
function gemTexture(): THREE.DataTexture {
  if (_gemTex) return _gemTex;
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      const r = Math.abs(Math.sin((u * 8 + v * 5) * Math.PI)) *
                Math.abs(Math.sin((u * 4 - v * 9) * Math.PI));
      const c = Math.floor(THREE.MathUtils.clamp(0.35 + r * 0.85, 0, 1) * 255);
      const k = (y * S + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = c; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.needsUpdate = true;
  return (_gemTex = tex);
}

// A wide repertoire of shapes — the slider now reveals genuine variety instead
// of cycling the same three project geometries.
const EXTRA_MAX = 12;
const EXTRA_GEOMS = [
  'torusKnot', 'icosahedron', 'octahedron',
  'dodecahedron', 'tetrahedron', 'torus', 'cone', 'capsule',
] as const;
type ExtraGeom = (typeof EXTRA_GEOMS)[number];

// Material personalities, picked per object: faceted-metallic (the legacy
// look), polished crystal (glossy clearcoat + gem texture), pure neon glow, and
// a transparent refractive diamond (glass transmission + dispersion).
const EXTRA_STYLES = ['facet', 'crystal', 'neon', 'diamond'] as const;
type ExtraStyle = (typeof EXTRA_STYLES)[number];

// Richer, more saturated palette — hot pinks, electric blues, acid greens.
const EXTRA_COLORS = [
  '#ff7a00', '#ff2d6e', '#7a3cff', '#2ad6a0',
  '#19b6ff', '#ffd23c', '#ff4fd8', '#3cff8a',
];

function ExtraGeometry({ geo, reduced }: { geo: ExtraGeom; reduced: boolean }) {
  switch (geo) {
    case 'torusKnot':    return <torusKnotGeometry   args={[0.55, 0.2, reduced ? 96 : 160, reduced ? 12 : 24]} />;
    case 'icosahedron':  return <icosahedronGeometry args={[1, 1]} />;
    case 'octahedron':   return <octahedronGeometry  args={[1, 0]} />;
    case 'dodecahedron': return <dodecahedronGeometry args={[1, 0]} />;
    case 'tetrahedron':  return <tetrahedronGeometry args={[1.15, 0]} />;
    case 'torus':        return <torusGeometry       args={[0.7, 0.27, reduced ? 16 : 24, reduced ? 48 : 90]} />;
    case 'cone':         return <coneGeometry        args={[0.8, 1.7, 6]} />;
    case 'capsule':      return <capsuleGeometry     args={[0.45, 0.9, reduced ? 4 : 8, reduced ? 10 : 18]} />;
  }
}

function ExtraMaterial({ style, color, lum, reduced }: { style: ExtraStyle; color: string; lum: number; reduced: boolean }) {
  const surf = surfaceTexture();
  const gem  = gemTexture();
  switch (style) {
    case 'crystal':
      // Polished gemstone. On mobile drop to a plain standard material — the
      // physical clearcoat/reflectivity pass is one of the heaviest costs.
      return reduced ? (
        <meshStandardMaterial
          color="#05040d"
          emissive={color}
          emissiveIntensity={0.9 * lum}
          emissiveMap={gem}
          metalness={0.8}
          roughness={0.18}
          roughnessMap={gem}
        />
      ) : (
        <meshPhysicalMaterial
          color="#05040d"
          emissive={color}
          emissiveIntensity={0.7 * lum}
          emissiveMap={gem}
          metalness={0.9}
          roughness={0.12}
          roughnessMap={gem}
          clearcoat={1}
          clearcoatRoughness={0.1}
          reflectivity={1}
        />
      );
    case 'diamond':
      // Transparent refractive gem. Real transmission + diamond IOR + dispersion
      // bends the nebula and the coloured object lights through the facets for
      // rainbow "fire". The whole effect needs a per-frame transmission render
      // pass, so on mobile we swap in a cheap translucent stand-in instead.
      return reduced ? (
        <meshStandardMaterial
          color="#aab4d4"
          metalness={0}
          roughness={0.05}
          transparent
          opacity={0.35}
        />
      ) : (
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={1}
          transparent
          opacity={1}
          ior={1.5}
          thickness={0.8}
          roughness={0.22}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.06}
          attenuationColor={color}
          attenuationDistance={6}
          dispersion={2}
          specularIntensity={1}
        />
      );
    case 'neon':
      // Almost pure light — pops hardest through the bloom pass.
      return (
        <meshStandardMaterial
          color="#03030a"
          emissive={color}
          emissiveIntensity={1.8 * lum}
          metalness={0.1}
          roughness={0.5}
        />
      );
    default:
      // Faceted metallic — the original textured, flat-shaded blob look.
      return (
        <meshStandardMaterial
          color="#0a0816"
          emissive={color}
          emissiveIntensity={0.9 * lum}
          emissiveMap={surf}
          metalness={0.6}
          roughness={1}
          roughnessMap={surf}
          bumpMap={surf}
          bumpScale={0.06}
          flatShading
        />
      );
  }
}

// Fisher–Yates shuffle (pure, returns a new array).
function shuffled<T>(src: readonly T[]): T[] {
  const a = src.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Even-but-random decks: fill each slot by cycling through every shape/style so
// all appear roughly equally often, then shuffle the order. This keeps the mix
// random from the very first revealed object without any one form dominating.
const GEO_DECK   = shuffled(Array.from({ length: EXTRA_MAX }, (_, i) => EXTRA_GEOMS[i % EXTRA_GEOMS.length]));
const STYLE_DECK = shuffled(Array.from({ length: EXTRA_MAX }, (_, i) => EXTRA_STYLES[i % EXTRA_STYLES.length]));

// Random layout generated once at module load (keeps render pure & stable).
const EXTRA_POOL = Array.from({ length: EXTRA_MAX }, (_, i) => {
  const r = 6 + Math.random() * 10;
  const a = Math.random() * Math.PI * 2;
  return {
    pos: [Math.cos(a) * r, (Math.random() * 2 - 1) * 5, Math.sin(a) * r] as [number, number, number],
    scale: 0.5 + Math.random() * 0.8,
    rot: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
    speed: 0.8 + Math.random() * 1.2,
    geo: GEO_DECK[i],
    style: STYLE_DECK[i],
    color: EXTRA_COLORS[Math.floor(Math.random() * EXTRA_COLORS.length)],
    lum: 0.7 + Math.random() * 0.9, // per-object luminance multiplier (0.7–1.6×)
  };
});

// Magenta key light that orbits the extra field and brightens as more objects
// are revealed — adding objects literally adds light to the scene.
function ExtraLight({ count }: { count: number }) {
  const ref = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.6;
    ref.current.position.set(Math.sin(t) * 7, Math.cos(t * 1.3) * 5, Math.cos(t) * 7);
  });
  return <pointLight ref={ref} decay={0} intensity={Math.min(count, EXTRA_MAX) * 0.18} color="#ff4fd8" />;
}

function ExtraField({ count, reduced }: { count: number; reduced: boolean }) {
  if (count <= 0) return null;
  return (
    <>
      <ExtraLight count={count} />
      <Sparkles
        count={Math.min(count, EXTRA_MAX) * (reduced ? 4 : 9)}
        scale={[26, 13, 26]}
        size={3}
        speed={0.3}
        opacity={0.5}
        color="#bcd2ff"
      />
      {EXTRA_POOL.slice(0, count).map((d, i) => (
        <Float key={i} speed={d.speed} rotationIntensity={0.5} floatIntensity={0.4} floatingRange={[-0.15, 0.15]}>
          <mesh position={d.pos} rotation={d.rot} scale={d.scale}>
            <ExtraGeometry geo={d.geo} reduced={reduced} />
            <ExtraMaterial style={d.style} color={d.color} lum={d.lum} reduced={reduced} />
          </mesh>
          {/* Each object is its own coloured light source: a local point light
              tinted like the object so it actually illuminates neighbours and
              throws coloured specular reflections across the metallic facets.
              distance/decay keep it local so distant objects stay unaffected.
              Skipped on mobile — a dozen dynamic point lights is the single
              heaviest fragment-shader cost, so phones rely on the glow alone. */}
          {!reduced && (
            <pointLight
              position={d.pos}
              color={d.color}
              intensity={(d.style === 'neon' ? 4 : 2.2) * d.lum}
              distance={9}
              decay={1.4}
            />
          )}
        </Float>
      ))}
    </>
  );
}


export default function ObservatoryScene() {
  const [selected, setSelected] = useState<ProjectId | null>(null);
  const [glow, setGlow] = useState(1.5);
  const [extra, setExtra] = useState(0);

  // Mobile GPUs are fill-rate bound: MSAA + a bloom composite at full retina DPR
  // is what makes the scene feel slow. Detect once (lazy init avoids an extra
  // render) and start conservative; PerformanceMonitor then trims DPR live.
  const [isMobile] = useState(
    () => typeof window !== 'undefined' &&
      matchMedia('(max-width: 768px), (pointer: coarse)').matches,
  );
  const [dpr, setDpr] = useState(isMobile ? 1 : 1.5);

  // Cap how many extra objects phones can summon — fewer meshes, lights and
  // sparkles — while desktops get the full dozen.
  const extraMax = isMobile ? 6 : EXTRA_MAX;

  const selectedProject: Project | null =
    selected ? PROJECTS.find(p => p.id === selected) ?? null : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100svh' }}>
      <Canvas
        camera={{ position: [0, 1.5, 12], fov: 55 }}
        dpr={dpr}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          // MSAA is expensive alongside the bloom pass; on mobile the bloom blur
          // already softens edges, so drop it there.
          antialias: !isMobile,
        }}
        style={{ background: '#04030f' }}
        onClick={() => setSelected(null)}
      >
        {/* Auto-adaptive quality: scale DPR by the live performance factor so a
            struggling device backs off and a fast one climbs toward native. */}
        <PerformanceMonitor
          onChange={({ factor }) =>
            setDpr(Math.round((0.75 + (isMobile ? 0.75 : 1.25) * factor) * 10) / 10)
          }
        />
        <ambientLight intensity={0.12} />
        <OrbitLight color="#fff4e6" />
        {/* cool + warm rim fills for coloured edge highlights */}
        <pointLight position={[-12, -4, -8]} intensity={1.1} decay={0} color="#5e7cff" />
        <pointLight position={[2, 9, 7]} intensity={0.7} decay={0} color="#ff7a3c" />

        <CameraRig selected={selected} />

        {PROJECTS.map(p => (
          <ProjectObject
            key={p.id}
            project={p}
            selected={selected}
            onSelect={setSelected}
          />
        ))}

        <ExtraField count={extra} reduced={isMobile} />

        <Nebula />
        <Particles reduced={isMobile} />
        <PostProcessing glow={glow} />
      </Canvas>

      {/* Atmospheric vignette + grain over the scene */}
      <div className="obs-vignette" />

      {/* Wordmark (top-left) */}
      <div className="obs-wordmark">
        <div className="obs-wordmark__title">Observatory</div>
        <div className="obs-wordmark__rule" />
        <div className="obs-wordmark__coord">{PROJECTS.length + extra} Objects Catalogued</div>
        <div className="obs-wordmark__sub">React Three Fiber · Three.js · WebGL</div>
      </div>

      {/* Hint */}
      {!selected && (
        <div className="obs-hint">Klicke ein Objekt · Orbit mit Drag</div>
      )}

      {/* Display settings (recruiters can retint the scene live) */}
      <div className="obs-panel">
        <div className="obs-panel__title">Display</div>
        <div className="obs-panel__row">
          <span className="obs-panel__label">Glow</span>
          <input
            className="obs-range"
            type="range"
            min={0} max={1.5} step={0.05} value={glow}
            onChange={(e) => setGlow(parseFloat(e.target.value))}
            aria-label="Glow"
          />
          <span className="obs-panel__val">{glow.toFixed(2)}</span>
        </div>
        <div className="obs-panel__row">
          <span className="obs-panel__label">Objects</span>
          <input
            className="obs-range"
            type="range"
            min={0} max={extraMax} step={1} value={extra}
            onChange={(e) => setExtra(parseInt(e.target.value, 10))}
            aria-label="Objects"
          />
          <span className="obs-panel__val">{extra}</span>
        </div>
      </div>

      <InfoPanel project={selectedProject} onClose={() => setSelected(null)} />
    </div>
  );
}
