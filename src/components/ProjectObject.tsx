'use client';

import { useRef } from 'react';
import { Float } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Project, ProjectId } from '@/lib/projects';

// Procedural surface texture, generated once and shared by all objects. The
// objects are almost pure emissive (self-lit), so a flat material reads as a
// solid blob — modulating the glow with smooth value noise gives them texture.
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

interface Props {
  project: Project;
  selected: ProjectId | null;
  onSelect: (id: ProjectId) => void;
}

export function ProjectObject({ project, selected, onSelect }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef  = useRef<THREE.MeshStandardMaterial>(null);
  const tex = surfaceTexture();

  const isSelected = selected === project.id;
  const isDimmed   = selected !== null && !isSelected;

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;
    const targetIntensity = isSelected ? 2.8 : isDimmed ? 0.2 : 0.9;
    matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
      matRef.current.emissiveIntensity, targetIntensity, delta * 3
    );
  });

  return (
    <Float
      speed={project.floatSpeed}
      rotationIntensity={0.5}
      floatIntensity={0.4}
      floatingRange={[-0.12, 0.12]}
    >
      <mesh
        ref={meshRef}
        position={project.position}
        onClick={(e) => { e.stopPropagation(); onSelect(project.id); }}
        onPointerOver={() => { document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
      >
        {project.geometry === 'torusKnot'   && <torusKnotGeometry   args={[0.6, 0.22, 200, 16]} />}
        {project.geometry === 'icosahedron' && <icosahedronGeometry args={[1, 4]} />}
        {project.geometry === 'octahedron'  && <octahedronGeometry  args={[1, 0]} />}
        <meshStandardMaterial
          ref={matRef}
          color="#0a0816"
          emissive={project.emissiveColor}
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
  );
}
