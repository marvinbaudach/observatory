'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ProjectId } from '@/lib/projects';
import { PROJECTS } from '@/lib/projects';

const OVERVIEW = {
  position: [0, 1.5, 12] as [number, number, number],
  target:   [0, 0,    0] as [number, number, number],
};

// Cinematic fly-in start pose: far, high and offset for an arc-like approach.
const INTRO_FROM = {
  position: [11, 20, 58] as [number, number, number],
  target:   [0, 0, 0] as [number, number, number],
};
const INTRO_DURATION = 3.0; // seconds

// Accelerate out of the start, then decelerate smoothly into the target — no
// asymptotic crawl and no snap at the end (which the damped controls produced).
const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

interface Props { selected: ProjectId | null; }

export function CameraRig({ selected }: Props) {
  const controlsRef = useRef<CameraControls>(null);
  const [introActive, setIntroActive] = useState(true);
  const introT = useRef(0);

  // Place the camera at the start pose immediately (before the first frame).
  useEffect(() => {
    controlsRef.current?.setLookAt(...INTRO_FROM.position, ...INTRO_FROM.target, false);
  }, []);

  // Drive the intro with our own eased tween for full control over the curve.
  useFrame((_, delta) => {
    if (!introActive) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    introT.current = Math.min(introT.current + delta / INTRO_DURATION, 1);
    const e = easeInOutCubic(introT.current);
    const px = THREE.MathUtils.lerp(INTRO_FROM.position[0], OVERVIEW.position[0], e);
    const py = THREE.MathUtils.lerp(INTRO_FROM.position[1], OVERVIEW.position[1], e);
    const pz = THREE.MathUtils.lerp(INTRO_FROM.position[2], OVERVIEW.position[2], e);
    ctrl.setLookAt(px, py, pz, OVERVIEW.target[0], OVERVIEW.target[1], OVERVIEW.target[2], false);

    if (introT.current >= 1) setIntroActive(false);
  });

  // After the intro, hand control to the selection-driven camera moves.
  useEffect(() => {
    if (introActive) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    if (selected) {
      const p = PROJECTS.find(pr => pr.id === selected)!;
      ctrl.setLookAt(
        p.position[0], p.position[1], p.position[2] + 3.5,
        p.position[0], p.position[1], p.position[2],
        true
      );
    } else {
      ctrl.setLookAt(...OVERVIEW.position, ...OVERVIEW.target, true);
    }
  }, [selected, introActive]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={selected === null && !introActive}
      minDistance={3}
      maxDistance={22}
      dampingFactor={0.06}
    />
  );
}
