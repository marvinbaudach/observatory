'use client';

import { useRef } from 'react';
import * as THREE from 'three';
import { useTimeUniform } from '@/lib/useTimeUniform';

const VERT = `
varying vec3 v_pos;
void main() {
  v_pos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
uniform float u_time;
varying vec3 v_pos;

// 3D value noise — sampling directly on the sphere direction avoids the
// atan() seam and the pole pinch that a 2D (azimuth, latitude) mapping causes.
vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dot(hash3(i + vec3(0,0,0)), f - vec3(0,0,0)),
                     dot(hash3(i + vec3(1,0,0)), f - vec3(1,0,0)), u.x),
                 mix(dot(hash3(i + vec3(0,1,0)), f - vec3(0,1,0)),
                     dot(hash3(i + vec3(1,1,0)), f - vec3(1,1,0)), u.x), u.y),
             mix(mix(dot(hash3(i + vec3(0,0,1)), f - vec3(0,0,1)),
                     dot(hash3(i + vec3(1,0,1)), f - vec3(1,0,1)), u.x),
                 mix(dot(hash3(i + vec3(0,1,1)), f - vec3(0,1,1)),
                     dot(hash3(i + vec3(1,1,1)), f - vec3(1,1,1)), u.x), u.y), u.z);
}
float fbm(vec3 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 1.9; a *= 0.5; }
  return v;
}

void main() {
  vec3 d = normalize(v_pos) * 2.5;
  float t = u_time * 0.012;

  // Domain-warped 3D fbm — seamless across the whole sphere
  vec3 q = vec3(fbm(d + t), fbm(d + vec3(5.2, 1.3, 2.7) - t), fbm(d + vec3(1.7, 9.2, 4.1)));
  float f = fbm(d + 1.8 * q + t * 0.5) * 0.5 + 0.5;

  // Very dark palette: deep blue → violet → faint magenta wisps
  vec3 col = vec3(0.012, 0.008, 0.045) * f;
  col += vec3(0.045, 0.012, 0.075) * smoothstep(0.45, 0.85, f);
  col += vec3(0.06, 0.025, 0.045) * smoothstep(0.65, 0.95, f) * 0.6;

  gl_FragColor = vec4(col, 1.0);
}
`;

export function Nebula() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  useTimeUniform(matRef);

  return (
    <mesh scale={[120, 120, 120]}>
      <sphereGeometry args={[1, 48, 32]} />
      <shaderMaterial
        ref={matRef}
        side={THREE.BackSide}
        depthWrite={false}
        uniforms={{ u_time: { value: 0 } }}
        vertexShader={VERT}
        fragmentShader={FRAG}
      />
    </mesh>
  );
}
