import { useFrame } from '@react-three/fiber';
import type { RefObject } from 'react';
import type * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

/**
 * Drives a shader material's `u_time` uniform from the shared frame clock.
 * Under reduced motion the uniform stays frozen at its current value.
 */
export function useTimeUniform(matRef: RefObject<THREE.ShaderMaterial | null>) {
  const still = usePrefersReducedMotion();
  useFrame(({ clock }) => {
    if (still) return;
    if (matRef.current) matRef.current.uniforms.u_time.value = clock.getElapsedTime();
  });
}
