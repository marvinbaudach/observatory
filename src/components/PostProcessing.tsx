'use client';

import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';

interface Props { glow?: number; }

export function PostProcessing({ glow = 0.5 }: Props) {
  return (
    <EffectComposer>
      <Bloom
        intensity={glow}
        luminanceThreshold={0.82}
        luminanceSmoothing={0.025}
        mipmapBlur
      />
      <Vignette eskil={false} offset={0.12} darkness={0.65} />
    </EffectComposer>
  );
}
