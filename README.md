# Observatory

![Observatory scene](docs/image.png)

**Live demo → [marvinbaudach.github.io/observatory](https://marvinbaudach.github.io/observatory/)**

An interactive 3D scene built with React Three Fiber. Three glowing geometric objects float in space — each represents a portfolio project. Click an object to fly the camera in and read more; drag to orbit freely.

## Interaction

| Input | Effect |
|---|---|
| Click object | Camera flies in, project info slides in |
| Drag | Orbit the scene |
| Escape / click background | Return to overview |

## Features

- Three geometries: TorusKnot (Solari Board), Icosahedron (Fluid), Octahedron (Observatory)
- Smooth camera transitions via `CameraControls.setLookAt()`
- Per-object emissive intensity animated with `useFrame` lerp
- Bloom postprocessing with `mipmapBlur` — no over-glow artifacts
- Ambient space dust: custom `Points` shader + `Stars` from Drei
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
│   ├── ObservatoryScene.tsx    # Canvas root, state, InfoPanel
│   ├── CameraRig.tsx           # CameraControls + fly-to logic
│   ├── ProjectObject.tsx       # Float + mesh + animated emissive
│   ├── Particles.tsx           # Stars + custom dust Points
│   ├── PostProcessing.tsx      # EffectComposer, Bloom, Vignette
│   └── InfoPanel.tsx           # 2D CSS overlay
└── lib/
    └── projects.ts             # project data (title, geometry, position, links)
```
