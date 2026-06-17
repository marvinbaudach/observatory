'use client';

import { EffectComposer, Bloom, Vignette, SMAA } from '@react-three/postprocessing';

interface Props { glow?: number; }

export function PostProcessing({ glow = 0.5 }: Props) {
  // multisampling antialiases the geometry pass inside the composer's own render
  // target (the canvas-level `antialias` flag does not apply once we render
  // through EffectComposer). SMAA then cleans the final composited image —
  // including the refraction/transmission silhouettes and bloom-bled edges that
  // MSAA can't reach — so distant crystals keep crisp edges instead of going soft.
  return (
    <EffectComposer multisampling={8}>
      <Bloom
        intensity={glow}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.025}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.12} darkness={0.65} />
      <SMAA />
    </EffectComposer>
  );
}
