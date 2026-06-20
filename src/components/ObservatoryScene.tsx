'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerformanceMonitor, Sparkles, Environment, Lightformer, MeshTransmissionMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { PROJECTS, type ProjectId, type Project } from '@/lib/projects';
import { CameraRig }      from './CameraRig';
import { ProjectObject, PROJECT_GEOMS, PROJECT_STYLES } from './ProjectObject';
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
  // DataTexture defaults to NearestFilter with no mipmaps; on a torus knot whose
  // UVs wrap many times that high-frequency interference pattern aliases into
  // harsh ribbed/moiré bands as the surface curves away. Trilinear filtering +
  // mipmaps + anisotropy resolve it smoothly at distance and grazing angles.
  tex.generateMipmaps = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return (_gemTex = tex);
}

// ---------------------------------------------------------------------------
// Mathematical parametric surfaces. Each is a function f(u,v) → point with u,v
// in [0,1]; buildSurface tessellates it into a centred, unit-scaled mesh with
// smooth normals so light glides cleanly across the curvature and the glass
// material throws real reflections + dispersion instead of flat facets.
// ---------------------------------------------------------------------------
type SurfaceFn = (u: number, v: number, target: THREE.Vector3) => void;

const TAU = Math.PI * 2;

// Gielis superformula radius for one angle — the building block of supershapes.
function superR(m: number, n1: number, n2: number, n3: number, a: number): number {
  const t1 = Math.pow(Math.abs(Math.cos((m * a) / 4)), n2);
  const t2 = Math.pow(Math.abs(Math.sin((m * a) / 4)), n3);
  return Math.pow(t1 + t2, -1 / n1);
}

const SURFACES: Record<string, SurfaceFn> = {
  // Spherical harmonic "flower ball": radius modulated by even powers of the
  // angular harmonics → soft knobbly petals that bulge and catch highlights.
  harmonic: (u, v, p) => {
    const theta = u * Math.PI, phi = v * TAU;
    const r =
      Math.pow(Math.sin(6 * phi), 2) + Math.pow(Math.cos(3 * phi), 2) +
      Math.pow(Math.sin(5 * theta), 2) + Math.pow(Math.cos(4 * theta), 2);
    p.set(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.sin(phi),
    );
  },
  // Gielis 3D supershape: a spherical product of two superformulae. Spiky,
  // gem-like star with sharp ridges that the dispersion lights up like fire.
  supershape: (u, v, p) => {
    const theta = (u - 0.5) * Math.PI, phi = (v - 0.5) * TAU;
    const r1 = superR(7, 0.2, 1.7, 1.7, theta);
    const r2 = superR(7, 0.2, 1.7, 1.7, phi);
    const ct = Math.cos(theta);
    p.set(
      r2 * Math.cos(phi) * r1 * ct,
      r1 * Math.sin(theta),
      r2 * Math.sin(phi) * r1 * ct,
    );
  },
  // Figure-8 immersion of the Klein bottle — a one-sided surface whose looping
  // tube reflects the scene back through itself.
  klein: (u, v, p) => {
    const U = u * TAU, V = v * TAU;
    const t = 2 + Math.cos(U / 2) * Math.sin(V) - Math.sin(U / 2) * Math.sin(2 * V);
    p.set(
      t * Math.cos(U),
      t * Math.sin(U),
      Math.sin(U / 2) * Math.sin(V) + Math.cos(U / 2) * Math.sin(2 * V),
    );
  },
  // Gently rippled sphere: a sine interference pattern on the radius. The slow
  // waves read as a polished, faintly faceted orb that shimmers as it turns.
  wave: (u, v, p) => {
    const theta = u * Math.PI, phi = v * TAU;
    const r = 1 + 0.18 * Math.sin(7 * phi) * Math.sin(6 * theta);
    p.set(
      r * Math.sin(theta) * Math.cos(phi),
      r * Math.cos(theta),
      r * Math.sin(theta) * Math.sin(phi),
    );
  },
  // Glass flower blossom: a star-shaped dish pinched into petals that the
  // transmission material reads as curved, refractive glass with each petal
  // throwing its own chromatic edge — the centrepiece shape echoing the pmndrs
  // glass-flower demo.
  flower: (u, v, p) => {
    const t = u * Math.PI, ph = v * TAU;
    const petals = 6;
    const petal = 0.5 + 0.5 * Math.cos(petals * ph);
    const dish = Math.sin(t);
    const r = 0.15 + dish * (0.85 + 0.35 * petal * petal);
    const cup = 0.35 * Math.cos(t);
    p.set(
      r * Math.sin(t) * Math.cos(ph),
      r * Math.cos(t) - cup,
      r * Math.sin(t) * Math.sin(ph),
    );
  },
};

function buildSurface(fn: SurfaceFn, segU: number, segV: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= segU; i++) {
    for (let j = 0; j <= segV; j++) {
      fn(i / segU, j / segV, p);
      positions.push(p.x, p.y, p.z);
      uvs.push(i / segU, j / segV);
    }
  }
  const w = segV + 1;
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * w + j, b = a + w;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  geo.setIndex(indices);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.center();
  geo.computeBoundingSphere();
  const r = geo.boundingSphere?.radius ?? 1;
  geo.scale(1.1 / r, 1.1 / r, 1.1 / r); // normalise every surface to ~unit size
  return geo;
}

// Built once per (surface, quality) and shared across all meshes that use it.
const _surfaceCache = new Map<string, THREE.BufferGeometry>();
function mathGeometry(name: keyof typeof SURFACES, reduced: boolean): THREE.BufferGeometry {
  const key = `${name}-${reduced ? 'lo' : 'hi'}`;
  let geo = _surfaceCache.get(key);
  if (!geo) {
    const seg = reduced ? 48 : 110;
    geo = buildSurface(SURFACES[name], seg, seg);
    _surfaceCache.set(key, geo);
  }
  return geo;
}

// A wide repertoire of shapes — the slider now reveals genuine variety instead
// of cycling the same three project geometries: polyhedra, primitives, and a
// set of mathematical parametric surfaces.
const EXTRA_MAX = 24;
const EXTRA_GEOMS = [
  'torusKnot', 'icosahedron', 'octahedron',
  'dodecahedron', 'tetrahedron', 'torus', 'cone', 'capsule',
  'harmonic', 'supershape', 'klein', 'wave', 'flower',
] as const;
type ExtraGeom = (typeof EXTRA_GEOMS)[number];

// The math surfaces ship with smooth vertex normals; they render best without
// flat shading so light flows over the curvature for clean reflections.
const SMOOTH_GEOMS = new Set<ExtraGeom>(['harmonic', 'supershape', 'klein', 'wave', 'flower']);

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
    case 'harmonic':
    case 'supershape':
    case 'klein':
    case 'wave':
    case 'flower':
      return <primitive object={mathGeometry(geo, reduced)} attach="geometry" />;
  }
}

function ExtraMaterial({ style, color, lum, reduced, smooth = false }: { style: ExtraStyle; color: string; lum: number; reduced: boolean; smooth?: boolean }) {
  const gem = gemTexture();

  // Every object is a frosted cut crystal; the style only varies how much inner
  // glow it carries and how much rainbow fire the facets throw.
  const emissiveIntensity =
    style === 'neon'    ? 1.3 * lum :   // a glowing core inside the glass
    style === 'diamond' ? 0          :  // clearest — pure refraction, no glow
    style === 'crystal' ? 0.45 * lum :
                          0.6 * lum;     // facet
  const dispersion = style === 'diamond' ? 3 : 1.2;

  // Mobile: the transmission pass is too heavy, so phones get a cheap translucent
  // flat-shaded stand-in instead of real frosted glass.
  if (reduced) {
    return (
      <meshStandardMaterial
        color="#070611"
        emissive={color}
        emissiveIntensity={(emissiveIntensity || 0.5) * 0.9}
        roughnessMap={gem}
        metalness={0.2}
        roughness={0.45}
        transparent
        opacity={0.45}
        flatShading={!smooth}
      />
    );
  }

  // Desktop: real frosted, cut crystal. transmission + high roughness blurs
  // whatever is behind the facets; flatShading gives the sharp cut-gem silhouette;
  // the object colour tints the transmitted light via attenuation.
  return (
    <meshPhysicalMaterial
      color="#ffffff"
      transmission={1}
      transparent
      opacity={1}
      ior={1.6}
      thickness={1.4}
      roughness={0.5}
      roughnessMap={gem}
      metalness={0}
      clearcoat={1}
      clearcoatRoughness={0.18}
      attenuationColor={color}
      attenuationDistance={3.5}
      dispersion={dispersion}
      specularIntensity={1}
      emissive={color}
      emissiveIntensity={emissiveIntensity}
      flatShading={!smooth}
      // Draw inner/back faces too — otherwise the near, viewer-facing half is
      // pure see-through glass with nothing rendered behind it, so you look
      // straight through it to the lit far half and it appears to vanish.
      side={THREE.DoubleSide}
    />
  );
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

// Per-load distinct shapes AND material personalities for the three project
// objects, so the opening scene looks different on every visit while each
// project keeps its identity, colour and click target. Shape and style are
// shuffled independently, so a project might be a chrome cloverleaf one visit
// and a glass supershape the next. Re-rolled on each module load (client-only).
const PROJECT_GEO_DECK   = shuffled(PROJECT_GEOMS);
const PROJECT_STYLE_DECK = shuffled(PROJECT_STYLES);

// The always-on hero centrepiece — its placement is shared so the scattered
// crystals can be kept clear of it.
const HERO_POS: [number, number, number] = [0, 0, 1];
const HERO_SCALE = 2.0;

// Persist the revealed-object count across visits.
const OBJECTS_KEY = 'observatory:objects';

const dist3 = (a: readonly number[], b: readonly number[]) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Collision-aware layout, generated once at module load. Every crystal is
// re-rolled until it clears the hero, all three project objects and all
// previously placed crystals, so nothing intersects anything else.
const EXTRA_POOL = (() => {
  const placed: { pos: readonly [number, number, number]; radius: number }[] = [
    { pos: HERO_POS, radius: HERO_SCALE * 0.95 },
    ...PROJECTS.map(p => ({ pos: p.position, radius: 1.3 })),
  ];
  return Array.from({ length: EXTRA_MAX }, (_, i) => {
    const scale = 0.5 + Math.random() * 0.8;
    const radius = scale * 1.3 + 0.4; // approx bounding sphere + clearance margin
    let pos: [number, number, number] = [0, 0, 0];
    for (let tries = 0; tries < 80; tries++) {
      const r = 6 + Math.random() * 9;
      const a = Math.random() * Math.PI * 2;
      pos = [Math.cos(a) * r, (Math.random() * 2 - 1) * 5, Math.sin(a) * r];
      if (placed.every(o => dist3(pos, o.pos) > radius + o.radius)) break;
    }
    placed.push({ pos, radius });
    return {
      pos,
      scale,
      rot: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
      speed: 0.8 + Math.random() * 1.2,
      geo: GEO_DECK[i],
      style: STYLE_DECK[i],
      color: EXTRA_COLORS[Math.floor(Math.random() * EXTRA_COLORS.length)],
      lum: 0.7 + Math.random() * 0.9, // per-object luminance multiplier (0.7–1.6×)
    };
  });
})();

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
            <ExtraMaterial style={d.style} color={d.color} lum={d.lum} reduced={reduced} smooth={SMOOTH_GEOMS.has(d.geo)} />
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

// Always-on centrepiece: a large frosted-glass torus knot with a magenta core
// light glowing through its facets. Independent of the Objects slider — it is
// the hero of the scene and is present from the very first frame.
function HeroCrystal({ reduced }: { reduced: boolean }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.12;
  });
  return (
    <group position={HERO_POS}>
      <Float speed={1} rotationIntensity={0.35} floatIntensity={0.4} floatingRange={[-0.18, 0.18]}>
        <group ref={spin}>
          <mesh scale={HERO_SCALE}>
            <torusKnotGeometry args={[0.6, 0.22, reduced ? 128 : 240, reduced ? 16 : 32]} />
            <ExtraMaterial style="diamond" color="#e8ecff" lum={1} reduced={reduced} />
          </mesh>
        </group>
      </Float>
      {/* Magenta core glowing through the glass + a warm rim highlight. */}
      <pointLight color="#ff2da0" intensity={reduced ? 2.5 : 5} distance={15} decay={1.3} />
      <pointLight position={[2, 0.6, 1]} color="#fff0f6" intensity={2} distance={11} decay={1.6} />
    </group>
  );
}

// A separate cluster of pure transmission-glass flower blossoms, rendered with
// drei's MeshTransmissionMaterial à la the pmndrs glass-flower demo. Unlike the
// frosted crystal field (which uses meshPhysicalMaterial.transmission), these
// shoot a real FBO of the scene behind them and refract it through the thick
// volume — giving genuine chromatic aberration at the petal edges, iridescence
// across the surface and a wavy distortion as they turn. They are independent
// of the Objects slider and present from the first frame so the glass effect is
// always on show. Hand-placed clear of the hero and the project objects.
const GLASS_FLOWERS: { pos: [number, number, number]; scale: number; rot: [number, number, number]; tint: string }[] = [
  { pos: [-7.5, 2.2, -3],   scale: 1.5, rot: [0.3, 0.6, 0.2], tint: '#ffd9b0' },
  { pos: [ 6.8, -1.6, 4.5], scale: 1.2, rot: [-0.4, 1.1, 0],  tint: '#cfe0ff' },
  { pos: [-4, -2.8, 6],     scale: 1.35, rot: [0.5, -0.5, 0.3], tint: '#ffc6e6' },
];

function GlassBloom({ reduced }: { reduced: boolean }) {
  const spin = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.05;
  });
  return (
    <group ref={spin}>
      {GLASS_FLOWERS.map((f, i) => (
        <Float key={i} speed={0.8} rotationIntensity={0.4} floatIntensity={0.5} floatingRange={[-0.2, 0.2]}>
          <mesh position={f.pos} rotation={f.rot} scale={f.scale}>
            <primitive object={mathGeometry('flower', reduced)} attach="geometry" />
            {reduced ? (
              <meshPhysicalMaterial
                color="#ffffff"
                transmission={1}
                transparent
                opacity={0.6}
                roughness={0.25}
                ior={1.5}
                thickness={0.5}
                clearcoat={1}
                attenuationColor={f.tint}
                attenuationDistance={4}
                side={THREE.DoubleSide}
              />
            ) : (
              <MeshTransmissionMaterial
                background={undefined}
                samples={8}
                resolution={512}
                transmission={1}
                roughness={0.05}
                thickness={0.2}
                backside
                backsideThickness={1}
                ior={1.5}
                chromaticAberration={0.5}
                anisotropicBlur={0.1}
                distortion={0.3}
                distortionScale={0.3}
                temporalDistortion={0.1}
                clearcoat={1}
                clearcoatRoughness={0.05}
                attenuationColor={f.tint}
                attenuationDistance={5}
                iridescence={1}
                iridescenceIOR={1}
                iridescenceThicknessRange={[0, 1400]}
                envMapIntensity={0.5}
                side={THREE.DoubleSide}
              />
            )}
          </mesh>
        </Float>
      ))}
    </group>
  );
}


// Lives inside the Canvas: useFrame ticks once per rendered frame, so counting
// ticks over a 250ms window gives the real render FPS. Throttled to ~4 updates/s
// so the React tree isn't re-rendered every frame.
function FpsMeter({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef(0);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    frames.current++;
    elapsed.current += delta;
    if (elapsed.current >= 0.25) {
      onFps(frames.current / elapsed.current);
      frames.current = 0;
      elapsed.current = 0;
    }
  });
  return null;
}

// Guess whether the device is genuinely weak — NOT just whether the window is
// small and NOT merely whether a touchscreen exists. A narrow window on a
// powerful desktop, or a touchscreen laptop with a trackpad, should still get
// full quality. So the only thing that flags a device as low-power is being
// touch-PRIMARY with no fine pointer available at all (a real phone/tablet):
//   • pointer:coarse        → the primary pointer is a finger/stylus
//   • !any-pointer:fine     → there is no mouse/trackpad anywhere on the device
// hardwareConcurrency / deviceMemory were dropped: they are privacy-capped and
// give false positives on capable 4-core desktops. PerformanceMonitor trims DPR
// live afterwards, so a wrong guess self-corrects toward the real frame budget.
function detectLowPower(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const hasFinePointer = matchMedia('(any-pointer: fine)').matches;
  return coarse && !hasFinePointer;
}

export default function ObservatoryScene() {
  const [selected, setSelected] = useState<ProjectId | null>(null);
  const [fps, setFps] = useState(0);

  // Low-power devices are fill-rate bound: MSAA + a bloom composite at full
  // retina DPR is what makes the scene feel slow. Detect once from hardware
  // signals (lazy init avoids an extra render) and start conservative;
  // PerformanceMonitor then trims DPR live.
  const [isMobile] = useState(detectLowPower);

  // Cap how many extra objects phones can summon — fewer meshes, lights and
  // sparkles — while desktops get the full dozen.
  const extraMax = isMobile ? 6 : EXTRA_MAX;

  // Seed the scene with 3 figures by default — EXTRA_POOL is re-rolled on every
  // load, so these are 3 fresh random figures each visit. A persisted count (set
  // by moving the slider) takes precedence. Client-only (next/dynamic ssr:false),
  // so reading storage in the lazy initializer is safe — no server render to mismatch.
  const START_OBJECTS = Math.min(3, extraMax);
  const [extra, setExtra] = useState(() => {
    if (typeof window === 'undefined') return START_OBJECTS;
    const n = parseInt(window.localStorage.getItem(OBJECTS_KEY) ?? '', 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 0), extraMax) : START_OBJECTS;
  });

  const [dpr, setDpr] = useState(isMobile ? 1 : 1.5);

  const selectedProject: Project | null =
    selected ? PROJECTS.find(p => p.id === selected) ?? null : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); };
  }, []);

  // Writes happen only on real user changes; the value is restored in the
  // useState initializer above.
  const changeExtra = (v: number) => {
    setExtra(v);
    window.localStorage.setItem(OBJECTS_KEY, String(v));
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100svh' }}>
      <Canvas
        // Match the CameraRig intro start pose so the very first frame is
        // already far out — otherwise the default camera paints one frame in
        // the middle of the objects before the fly-in takes over.
        camera={{ position: [11, 20, 58], fov: 55 }}
        dpr={dpr}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          // MSAA is expensive alongside the bloom pass; on mobile the bloom blur
          // already softens edges, so drop it there.
          antialias: !isMobile,
        }}
        style={{ background: '#04030f' }}
        onClick={() => { setSelected(null); }}
      >
        {/* Auto-adaptive quality: scale DPR by the live performance factor so a
            struggling device backs off and a fast one climbs toward native. */}
        <PerformanceMonitor
          onChange={({ factor }) =>
            { setDpr(Math.round((0.75 + (isMobile ? 0.75 : 1.25) * factor) * 10) / 10); }
          }
        />
        <FpsMeter onFps={setFps} />
        <ambientLight intensity={0.12} />
        <OrbitLight color="#fff4e6" />
        {/* cool + warm rim fills for coloured edge highlights */}
        <pointLight position={[-12, -4, -8]} intensity={1.1} decay={0} color="#5e7cff" />
        <pointLight position={[2, 9, 7]} intensity={0.7} decay={0} color="#ff7a3c" />

        {/* Coloured reflection environment — the liquid-mercury chrome and the
            glass objects mirror these light blobs, so they read as polished
            metal/crystal instead of black voids. Baked once (frames={1}); it
            only feeds reflections, the visible background stays the deep navy. */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="circle" color="#ff2da0" intensity={3}   scale={6} position={[6, 3, 5]} />
          <Lightformer form="circle" color="#19b6ff" intensity={2.6} scale={6} position={[-6, -1, 4]} />
          <Lightformer form="rect"   color="#ff7a3c" intensity={2}   scale={[10, 2, 1]} position={[0, 7, -4]} />
          <Lightformer form="circle" color="#e8ecff" intensity={1.8} scale={4} position={[0, -6, -6]} />
        </Environment>

        <CameraRig selected={selected} />

        <HeroCrystal reduced={isMobile} />
        <GlassBloom reduced={isMobile} />

        {PROJECTS.map((p, i) => (
          <ProjectObject
            key={p.id}
            project={p}
            geom={PROJECT_GEO_DECK[i]}
            style={PROJECT_STYLE_DECK[i]}
            selected={selected}
            onSelect={setSelected}
            reduced={isMobile}
          />
        ))}

        <ExtraField count={extra} reduced={isMobile} />

        <Nebula />
        <Particles reduced={isMobile} />
        <PostProcessing glow={1.5} />
      </Canvas>

      {/* Atmospheric vignette + grain over the scene */}
      <div className="obs-vignette" />

      {/* Wordmark (top-left) */}
      <div className="obs-wordmark">
        <div className="obs-wordmark__title">Observatory</div>
        <div className="obs-wordmark__rule" />
        <div className="obs-wordmark__coord">{PROJECTS.length + 1 + extra} Objects Catalogued</div>
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
          <span className="obs-panel__label">Objects</span>
          <input
            className="obs-range"
            type="range"
            min={0} max={extraMax} step={1} value={extra}
            onChange={(e) => { changeExtra(parseInt(e.target.value, 10)); }}
            aria-label="Objects"
          />
          <span className="obs-panel__val">{extra}</span>
        </div>
        <div className="obs-panel__row">
          <span className="obs-panel__label">FPS</span>
          <span className="obs-panel__val obs-panel__val--wide">{fps ? Math.round(fps) : '—'}</span>
        </div>
      </div>

      <InfoPanel project={selectedProject} onClose={() => { setSelected(null); }} />
    </div>
  );
}
