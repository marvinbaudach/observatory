'use client';

import { useRef } from 'react';
import { Float } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Project, ProjectId } from '@/lib/projects';
import { buildShapeGeometry, SHAPE_NAMES, SMOOTH_SHAPES, type ShapeName } from '@/lib/shapes';

// Procedural surface texture, generated once and shared by all objects. The
// plasma material is almost pure emissive (self-lit), so a flat material reads
// as a solid blob — modulating the glow with smooth value noise gives texture.
let _surfaceTex: THREE.DataTexture | null = null;
export function surfaceTexture(): THREE.DataTexture {
  if (_surfaceTex) return _surfaceTex;
  const S = 256;
  const data = new Uint8Array(S * S * 4);
  const octaves = [ { f: 6, a: 0.55 }, { f: 12, a: 0.3 }, { f: 24, a: 0.15 } ];
  const grids = octaves.map(({ f }) => {
    const g = new Float32Array((f + 1) * (f + 1));
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    return g;
  });
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sample = (g: Float32Array, f: number, u: number, v: number) => {
    const gx = u * f, gy = v * f;
    const x0 = Math.floor(gx) % f, y0 = Math.floor(gy) % f;
    const tx = smooth(gx - Math.floor(gx)), ty = smooth(gy - Math.floor(gy));
    const at = (x: number, y: number) => g[y * (f + 1) + x];
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / S, v = y / S;
      let n = 0;
      for (let o = 0; o < octaves.length; o++) n += octaves[o].a * sample(grids[o], octaves[o].f, u, v);
      // bias into [0.5, 1] so the glow stays bright but varies across the surface
      const c = Math.floor(THREE.MathUtils.clamp(0.5 + n * 0.5, 0, 1) * 255);
      const k = (y * S + x) * 4;
      data[k] = data[k + 1] = data[k + 2] = c; data[k + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return (_surfaceTex = tex);
}

// Second texture: sharp interference ridges. Used as a roughness/emissive map by
// the metallic + glass personalities so light catches along gem-like bands
// instead of the soft value-noise glow of the plasma material.
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
  tex.generateMipmaps = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8;
  tex.repeat.set(2, 2);
  tex.needsUpdate = true;
  return (_gemTex = tex);
}

// Each project object draws a distinct mathematical shape from this pool — a
// liquid-metal blob, spiky supershape, atomic orbitals, a rippled orb — picked
// in ObservatoryScene so the opening scene looks different on every visit while
// each project keeps its identity (colour, info, click target).
export const PROJECT_GEOMS = SHAPE_NAMES;
export type ProjectGeom = ShapeName;

// Material personalities, each with its own texture + light character:
//   mercury — liquid chrome that mirrors the coloured environment
//   glass   — frosted, refractive cut crystal lit from within
//   plasma  — self-lit value-noise glow (the original look)
//   molten  — hot reflective metal with interference banding
export const PROJECT_STYLES = ['mercury', 'glass', 'plasma', 'molten'] as const;
export type ProjectStyle = (typeof PROJECT_STYLES)[number];

function ProjectGeometry({ geo, reduced }: { geo: ProjectGeom; reduced: boolean }) {
  return <primitive object={buildShapeGeometry(geo, reduced)} attach="geometry" />;
}

// Per-style base emissive intensity (what the object glows at when idle) and the
// base intensity of its own light. Selection scales both up; dimming scales down.
const STYLE_TUNING: Record<ProjectStyle, { emissive: number; light: number }> = {
  mercury: { emissive: 0.0, light: 2.0 },
  glass:   { emissive: 0.3, light: 2.6 },
  plasma:  { emissive: 0.9, light: 1.7 },
  molten:  { emissive: 0.7, light: 1.9 },
};

interface Props {
  project: Project;
  selected: ProjectId | null;
  onSelect: (id: ProjectId) => void;
  geom?: ProjectGeom;
  style?: ProjectStyle;
  reduced?: boolean;
}

export function ProjectObject({ project, selected, onSelect, geom, style = 'plasma', reduced = false }: Props) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const matRef   = useRef<THREE.MeshStandardMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const noiseTex = surfaceTexture();
  const gemTex   = gemTexture();

  const shape  = geom ?? SHAPE_NAMES[0];
  const smooth = SMOOTH_SHAPES.has(shape);
  const tuning = STYLE_TUNING[style];

  const isSelected = selected === project.id;
  const isDimmed   = selected !== null && !isSelected;

  useFrame((_, delta) => {
    const k = delta * 3;
    // Selection feedback that works across every material: brighten the object's
    // own light + emissive when picked, dim them when another is picked, and
    // gently swell the mesh. Material-agnostic so chrome and glass respond too.
    const sel = isSelected ? 1 : isDimmed ? 0 : 0.5; // 0 dim · 0.5 idle · 1 selected
    if (matRef.current) {
      const target = tuning.emissive * (isSelected ? 3 : isDimmed ? 0.25 : 1) + (isSelected ? 0.5 : 0);
      matRef.current.emissiveIntensity = THREE.MathUtils.lerp(matRef.current.emissiveIntensity, target, k);
    }
    if (lightRef.current) {
      const target = tuning.light * (isSelected ? 2.2 : isDimmed ? 0.3 : 1);
      lightRef.current.intensity = THREE.MathUtils.lerp(lightRef.current.intensity, target, k);
    }
    if (meshRef.current) {
      const s = 1 + sel * 0.12;
      meshRef.current.scale.lerp(new THREE.Vector3(s, s, s), k);
    }
  });

  return (
    <Float
      speed={project.floatSpeed}
      rotationIntensity={0.5}
      floatIntensity={0.4}
      floatingRange={[-0.12, 0.12]}
    >
      <group position={project.position}>
        <mesh
          ref={meshRef}
          onClick={(e) => { e.stopPropagation(); onSelect(project.id); }}
          onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
          onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        >
          <ProjectGeometry geo={shape} reduced={reduced} />
          <ProjectMaterial
            style={style}
            project={project}
            matRef={matRef}
            noiseTex={noiseTex}
            gemTex={gemTex}
            smooth={smooth}
            base={tuning.emissive}
            reduced={reduced}
          />
        </mesh>

        {/* Every object is its own coloured light source, tuned to its
            personality — so the three objects light each other and the scene
            with three distinct hues. */}
        <pointLight
          ref={lightRef}
          color={project.accentColor}
          intensity={tuning.light}
          distance={9}
          decay={1.4}
        />
      </group>
    </Float>
  );
}

// Renders the material for a given personality. matRef is wired to whichever
// material carries an animatable emissiveIntensity so the selection pulse works.
function ProjectMaterial({
  style, project, matRef, noiseTex, gemTex, smooth, base, reduced,
}: {
  style: ProjectStyle;
  project: Project;
  matRef: React.RefObject<THREE.MeshStandardMaterial | null>;
  noiseTex: THREE.Texture;
  gemTex: THREE.Texture;
  smooth: boolean;
  base: number;
  reduced: boolean;
}) {
  switch (style) {
    // Liquid mercury: near-perfect chrome that mirrors the coloured Environment.
    case 'mercury':
      return (
        <meshStandardMaterial
          ref={matRef}
          color="#eef2ff"
          metalness={1}
          roughness={reduced ? 0.16 : 0.05}
          roughnessMap={gemTex}
          envMapIntensity={2.2}
          emissive={project.accentColor}
          emissiveIntensity={base}
          flatShading={!smooth}
        />
      );

    // Frosted, refractive cut crystal lit from within by its own core light.
    case 'glass':
      if (reduced) {
        return (
          <meshStandardMaterial
            ref={matRef}
            color="#0a0816"
            emissive={project.emissiveColor}
            emissiveIntensity={base + 0.4}
            roughnessMap={gemTex}
            metalness={0.2}
            roughness={0.4}
            transparent
            opacity={0.5}
            flatShading={!smooth}
          />
        );
      }
      return (
        <meshPhysicalMaterial
          // meshPhysicalMaterial extends Standard, so the emissive ref still works.
          ref={matRef}
          color="#ffffff"
          transmission={1}
          transparent
          opacity={1}
          ior={1.5}
          thickness={1.4}
          roughness={0.18}
          roughnessMap={gemTex}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.16}
          attenuationColor={project.emissiveColor}
          attenuationDistance={2.5}
          dispersion={1.6}
          emissive={project.emissiveColor}
          emissiveIntensity={base}
          envMapIntensity={1.4}
          flatShading={!smooth}
          side={THREE.DoubleSide}
        />
      );

    // Hot reflective metal: banded interference + a coloured glow under chrome.
    case 'molten':
      return (
        <meshStandardMaterial
          ref={matRef}
          color="#120a06"
          emissive={project.emissiveColor}
          emissiveIntensity={base}
          emissiveMap={gemTex}
          metalness={0.85}
          roughness={0.32}
          roughnessMap={gemTex}
          envMapIntensity={1.3}
          flatShading={!smooth}
          side={THREE.DoubleSide}
        />
      );

    // Plasma: the original self-lit value-noise glow.
    case 'plasma':
    default:
      return (
        <meshStandardMaterial
          ref={matRef}
          color="#0a0816"
          emissive={project.emissiveColor}
          emissiveIntensity={base}
          emissiveMap={noiseTex}
          metalness={0.6}
          roughness={1}
          roughnessMap={noiseTex}
          bumpMap={noiseTex}
          bumpScale={0.06}
          transparent
          opacity={0.82}
          flatShading={!smooth}
          side={THREE.DoubleSide}
        />
      );
  }
}
