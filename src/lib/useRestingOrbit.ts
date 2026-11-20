import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/** Writes the orbit position for phase `t` (radians) into `out`. */
export type OrbitPose = (t: number, out: THREE.Vector3) => void;

/**
 * Moves an object along `pose` at `speed` phase per second. Reduced motion
 * snaps it to the t = 0 pose and holds it there; once motion is allowed again
 * the orbit resumes from that pose, because the phase is accumulated here
 * rather than read off the global clock.
 */
export function useRestingOrbit(
  ref: RefObject<THREE.Object3D | null>,
  speed: number,
  pose: OrbitPose,
) {
  const still = usePrefersReducedMotion();
  const phase = useRef(0);
  const invalidate = useThree(s => s.invalidate);

  // Mount and every change of the setting restart from the rest pose.
  useLayoutEffect(() => {
    phase.current = 0;
    if (ref.current) pose(0, ref.current.position);
  }, [still, ref, pose]);
  // The frozen canvas only renders on demand; ask for the frame with the snap.
  useEffect(() => { invalidate(); }, [still, invalidate]);

  useFrame((_, delta) => {
    if (still || !ref.current) return;
    phase.current += delta * speed;
    pose(phase.current, ref.current.position);
  });
}
