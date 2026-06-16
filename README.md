# Observatory

![Observatory scene](docs/image.png)

**Live demo → [marvinbaudach.github.io/observatory](https://marvinbaudach.github.io/observatory/)**

An interactive 3D scene built with React Three Fiber. Glowing objects drift through a nebula — three of them are portfolio projects you can click to fly the camera in and read more. A frosted-glass hero crystal anchors the scene, and an *Objects* slider summons a field of extra figures, from polyhedra to mathematical parametric surfaces (spherical harmonics, a Gielis supershape, a Klein bottle). Drag to orbit freely.

## Interaction

| Input | Effect |
|---|---|
| Click object | Camera flies in, project info slides in |
| Drag | Orbit the scene |
| *Objects* slider | Summon more figures into the field (count is remembered) |
| Escape / click background | Return to overview |

## Features

- Wide shape repertoire — polyhedra, primitives, and parametric **math surfaces** (spherical harmonic, Gielis supershape, Klein bottle, rippled sphere) tessellated with smooth vertex normals
- Frosted cut-glass crystals: `meshPhysicalMaterial` transmission + dispersion, rendered **double-sided** so the viewer-facing half reads as solid glass
- Always-on hero crystal with a magenta core glowing through the glass
- *Objects* slider reveals a **collision-free field** of extra figures; the count persists in `localStorage`
- Smooth camera transitions via `CameraControls.setLookAt()`
- Per-object emissive intensity animated with `useFrame` lerp
- Bloom postprocessing with `mipmapBlur` — no over-glow artifacts
- Adaptive DPR via `PerformanceMonitor` with a lighter mobile path (fewer lights, no transmission pass)
- Ambient space dust + nebula backdrop: custom `Points` shaders + `Stars` from Drei
- 2D info panel (CSS overlay, outside the WebGL pipeline — never blurred by DoF)
- ACES Filmic tonemapping

## Tech

| | |
|---|---|
| Renderer | React Three Fiber + Three.js |
| Helpers | @react-three/drei (CameraControls, Float, Stars) |
| Postprocessing | @react-three/postprocessing (Bloom, Vignette) |
| Framework | Next.js (App Router, static export) |
| Language | TypeScript |
| Hosting | GitHub Pages via GitHub Actions |

## Local Development

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000).

## Build & Export

```bash
npm run build                    # local build
GITHUB_PAGES=true npm run build  # static export for GitHub Pages (output: out/)
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                # dynamic import with ssr: false
│   ├── layout.tsx              # metadata
│   └── globals.css             # reset + info panel CSS
├── components/
│   ├── ObservatoryScene.tsx    # Canvas root, hero crystal, extra field, math surfaces, state
│   ├── CameraRig.tsx           # CameraControls + fly-to logic
│   ├── ProjectObject.tsx       # Float + mesh + animated emissive
│   ├── Particles.tsx           # Stars + custom dust Points
│   ├── Nebula.tsx              # volumetric nebula backdrop
│   ├── PostProcessing.tsx      # EffectComposer, Bloom, Vignette
│   └── InfoPanel.tsx           # 2D CSS overlay
└── lib/
    └── projects.ts             # project data (title, geometry, position, links)
```
