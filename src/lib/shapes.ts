import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Mathematical shapes for the project objects. Each is a parametric surface
// f(u,v) → point with u,v in [0,1]; buildShape tessellates it into a centred,
// unit-scaled mesh with smooth normals. The set deliberately mixes families so
// the three hero objects don't all read as "orbitals": a smooth liquid-metal
// blob, a spiky Gielis supershape, two atomic-orbital harmonics, and a rippled
// orb.
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const PI = Math.PI;

type SurfaceFn = (u: number, v: number, p: THREE.Vector3) => void;

// Gielis superformula radius for one angle — the building block of supershapes.
function superR(m: number, n1: number, n2: number, n3: number, a: number): number {
  const t1 = Math.pow(Math.abs(Math.cos((m * a) / 4)), n2);
  const t2 = Math.pow(Math.abs(Math.sin((m * a) / 4)), n3);
  return Math.pow(t1 + t2, -1 / n1);
}

const SHAPES = {
  // Liquid-metal blob: a sphere with a slow, low-frequency radial wobble. Smooth
  // and rounded so a chrome material pools light like a drop of mercury.
  blob: (u, v, p) => {
    const t = u * PI, ph = v * TAU;
    const r = 1 + 0.16 * Math.sin(3 * ph) * Math.sin(2 * t) + 0.1 * Math.cos(5 * t + ph);
    p.set(r * Math.sin(t) * Math.cos(ph), r * Math.cos(t), r * Math.sin(t) * Math.sin(ph));
  },
  // Gielis 3D supershape: a spherical product of two superformulae — a spiky,
  // gem-like star with sharp ridges that catch dispersion like fire.
  supershape: (u, v, p) => {
    const theta = (u - 0.5) * PI, phi = (v - 0.5) * TAU;
    const r1 = superR(7, 0.2, 1.7, 1.7, theta);
    const r2 = superR(7, 0.2, 1.7, 1.7, phi);
    const ct = Math.cos(theta);
    p.set(r2 * Math.cos(phi) * r1 * ct, r1 * Math.sin(theta), r2 * Math.sin(phi) * r1 * ct);
  },
  // d_x²−y² atomic orbital — the classic four-lobe cloverleaf (r = |Y|, so it
  // pinches to the origin along the nodal planes like a real orbital).
  orbitalD4: (u, v, p) => {
    const t = u * PI, ph = v * TAU;
    const r = Math.abs(Math.sin(t) ** 2 * Math.cos(2 * ph));
    p.set(r * Math.sin(t) * Math.cos(ph), r * Math.cos(t), r * Math.sin(t) * Math.sin(ph));
  },
  // f atomic orbital — a six-petal flower wrapped around the equator.
  orbitalF6: (u, v, p) => {
    const t = u * PI, ph = v * TAU;
    const r = Math.abs(Math.sin(t) ** 3 * Math.cos(3 * ph));
    p.set(r * Math.sin(t) * Math.cos(ph), r * Math.cos(t), r * Math.sin(t) * Math.sin(ph));
  },
  // Gently rippled sphere: a sine interference pattern on the radius reads as a
  // polished, faintly faceted orb that shimmers as it turns.
  wave: (u, v, p) => {
    const t = u * PI, ph = v * TAU;
    const r = 1 + 0.18 * Math.sin(7 * ph) * Math.sin(6 * t);
    p.set(r * Math.sin(t) * Math.cos(ph), r * Math.cos(t), r * Math.sin(t) * Math.sin(ph));
  },
} satisfies Record<string, SurfaceFn>;

export type ShapeName = keyof typeof SHAPES;
export const SHAPE_NAMES = Object.keys(SHAPES) as ShapeName[];

// Everything but the spiky supershape renders best smooth, so light flows over
// the curvature; the supershape wants flat shading for its cut-gem ridges.
export const SMOOTH_SHAPES = new Set<ShapeName>(['blob', 'orbitalD4', 'orbitalF6', 'wave']);

function buildShape(fn: SurfaceFn, seg: number): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  for (let i = 0; i <= seg; i++) {
    for (let j = 0; j <= seg; j++) {
      fn(i / seg, j / seg, p);
      positions.push(p.x, p.y, p.z);
      uvs.push(j / seg, i / seg);
    }
  }
  const w = seg + 1;
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < seg; j++) {
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
  const rad = geo.boundingSphere?.radius ?? 1;
  geo.scale(1.15 / rad, 1.15 / rad, 1.15 / rad); // normalise every shape to ~unit size
  return geo;
}

// Built once per (shape, quality) and shared across all meshes that use it.
const _cache = new Map<string, THREE.BufferGeometry>();
export function buildShapeGeometry(name: ShapeName, reduced: boolean): THREE.BufferGeometry {
  const key = `${name}-${reduced ? 'lo' : 'hi'}`;
  let geo = _cache.get(key);
  if (!geo) {
    geo = buildShape(SHAPES[name], reduced ? 64 : 140);
    _cache.set(key, geo);
  }
  return geo;
}
