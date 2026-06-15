'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, PerformanceMonitor } from '@react-three/drei';
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

// Extra large reflective objects, same look as the three project objects
// (textured emissive + metallic + flat-shaded), scattered around. The count is
// adjustable; a fixed pool keeps positions stable as the slider reveals more.
const EXTRA_MAX = 12;
const EXTRA_GEOMS = ['torusKnot', 'icosahedron', 'octahedron'] as const;
const EXTRA_COLORS = ['#c87800', '#c03000', '#2040e0', '#7a3cff', '#2ad6a0'];

// Random layout generated once at module load (keeps render pure & stable).
const EXTRA_POOL = Array.from({ length: EXTRA_MAX }, (_, i) => {
  const r = 6 + Math.random() * 10;
  const a = Math.random() * Math.PI * 2;
  return {
    pos: [Math.cos(a) * r, (Math.random() * 2 - 1) * 5, Math.sin(a) * r] as [number, number, number],
    scale: 0.5 + Math.random() * 0.7,
    rot: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
    speed: 0.8 + Math.random() * 1.2,
    geo: EXTRA_GEOMS[i % EXTRA_GEOMS.length],
    color: EXTRA_COLORS[i % EXTRA_COLORS.length],
  };
});

function ExtraField({ count }: { count: number }) {
  const tex = surfaceTexture();
  return (
    <>
      {EXTRA_POOL.slice(0, count).map((d, i) => (
        <Float key={i} speed={d.speed} rotationIntensity={0.5} floatIntensity={0.4} floatingRange={[-0.15, 0.15]}>
          <mesh position={d.pos} rotation={d.rot} scale={d.scale}>
            {d.geo === 'torusKnot'   && <torusKnotGeometry   args={[0.6, 0.22, 128, 16]} />}
            {d.geo === 'icosahedron' && <icosahedronGeometry args={[1, 4]} />}
            {d.geo === 'octahedron'  && <octahedronGeometry  args={[1, 0]} />}
            <meshStandardMaterial
              color="#0a0816"
              emissive={d.color}
              emissiveIntensity={0.9}
              emissiveMap={tex}
              metalness={0.6}
              roughness={1}
              roughnessMap={tex}
              bumpMap={tex}
              bumpScale={0.06}
              flatShading
            />
          </mesh>
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

        <ExtraField count={extra} />

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
            min={0} max={EXTRA_MAX} step={1} value={extra}
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
