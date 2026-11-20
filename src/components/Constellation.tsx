'use client';

import { useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Line2 } from 'three-stdlib';
import { PROJECTS } from '@/lib/projects';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const PAIRS: [number, number][] = [[0, 1], [1, 2], [2, 0]];

function ConstellationLine({ from, to, phase }: {
  from: [number, number, number];
  to:   [number, number, number];
  phase: number;
}) {
  const ref = useRef<Line2>(null);
  const still = usePrefersReducedMotion();

  // Under reduced motion the pulse is frozen at its current opacity.
  useFrame(({ clock }) => {
    if (still || !ref.current) return;
    const t = clock.getElapsedTime();
    ref.current.material.opacity = 0.1 + 0.07 * Math.sin(t * 0.6 + phase);
  });

  return (
    <Line
      ref={ref}
      points={[from, to]}
      color="#5070ff"
      lineWidth={1}
      transparent
      opacity={0.12}
      dashed
      dashSize={0.18}
      gapSize={0.12}
    />
  );
}

export function Constellation() {
  return (
    <>
      {PAIRS.map(([a, b], i) => (
        <ConstellationLine
          key={i}
          from={PROJECTS[a].position}
          to={PROJECTS[b].position}
          phase={i * 2.1}
        />
      ))}
    </>
  );
}
