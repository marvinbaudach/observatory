'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import type { ProjectId } from '@/lib/projects';
import { PROJECTS } from '@/lib/projects';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';
import { useMediaQuery } from '@/lib/useMediaQuery';

const OVERVIEW_HEIGHT = 1.5;
const OVERVIEW_MIN_DISTANCE = 12;
const OVERVIEW_HALF_WIDTH = 5.4;   // all three projects (x = ±4, radius ~1.3) stay inside the frame
const FOCUS_MIN_DISTANCE = 3.5;
const FOCUS_HALF_WIDTH = 1.9;      // a selected object (radius ~1.5) fits the frame width
const OVERVIEW_TARGET: [number, number, number] = [0, 0, 0];
const MAX_DISTANCE_FLOOR = 22;
const MAX_DISTANCE_MARGIN = 4;
// The info panel becomes a bottom sheet at this width (see globals.css) and
// covers up to SHEET_MAX_FRACTION of the viewport height (max-height: 60svh).
const SHEET_QUERY = '(max-width: 600px)';
const SHEET_MAX_FRACTION = 0.6;

// Distance at which a given half-width of the scene fills the horizontal field
// of view. Wide screens keep the fixed minimum; a portrait phone backs off.
function fitDistance(fovDeg: number, aspect: number, halfWidth: number, minDistance: number): number {
  const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  return Math.max(minDistance, halfWidth / (halfH * aspect));
}

// Camera pose that frames a project head-on. With the bottom sheet open, look
// at a point below the object so it sits centred in the strip above the sheet.
function focusPose(
  position: [number, number, number],
  distance: number,
  fovDeg: number,
  sheet: boolean,
): [number, number, number, number, number, number] {
  const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2);
  // The free strip's centre lies SHEET_MAX_FRACTION / 2 of the viewport height
  // above the screen centre; the viewport is 2 * distance * halfH tall in world units.
  const lift = sheet ? SHEET_MAX_FRACTION * distance * halfH : 0;
  const [x, y, z] = position;
  return [x, y - lift, z + distance, x, y - lift, z];
}

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
  const reducedMotion = usePrefersReducedMotion();
  const sheet = useMediaQuery(SHEET_QUERY);
  // Reduced motion starts at the overview pose; no fly-in.
  const [startsWithIntro] = useState(!reducedMotion);
  const [introActive, setIntroActive] = useState(startsWithIntro);
  const introT = useRef(0);

  // Under reduced motion the canvas renders on demand; every pose change below
  // asks for the frame that shows it.
  const invalidate = useThree(s => s.invalidate);
  const fov = useThree(s => (s.camera as THREE.PerspectiveCamera).fov);
  // Guard the first render, before the canvas has been measured (0 / 0).
  const aspect = useThree(s => (s.size.height > 0 ? s.size.width / s.size.height : 1));
  const overviewDistance = fitDistance(fov, aspect, OVERVIEW_HALF_WIDTH, OVERVIEW_MIN_DISTANCE);
  const focusDistance = fitDistance(fov, aspect, FOCUS_HALF_WIDTH, FOCUS_MIN_DISTANCE);
  // Latest values for effects that must not re-run when they change.
  const overviewDistanceRef = useRef(overviewDistance);
  const prevOverviewDistance = useRef(overviewDistance);
  const focusDistanceRef = useRef(focusDistance);
  const fovRef = useRef(fov);
  const sheetRef = useRef(sheet);
  const selectedRef = useRef(selected);
  const introActiveRef = useRef(introActive);
  useLayoutEffect(() => {
    overviewDistanceRef.current = overviewDistance;
    focusDistanceRef.current = focusDistance;
    fovRef.current = fov;
    sheetRef.current = sheet;
    selectedRef.current = selected;
    introActiveRef.current = introActive;
  }, [overviewDistance, focusDistance, fov, sheet, selected, introActive]);

  // Place the camera at the start pose synchronously before the first paint —
  // useEffect runs after paint, which let one frame render at the overview pose.
  useLayoutEffect(() => {
    const pose = startsWithIntro ? INTRO_FROM.position : [0, OVERVIEW_HEIGHT, overviewDistanceRef.current];
    void controlsRef.current?.setLookAt(pose[0], pose[1], pose[2], ...INTRO_FROM.target, false);
  }, [startsWithIntro]);

  // Drive the intro with our own eased tween for full control over the curve.
  useFrame((_, delta) => {
    if (!introActive) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    // Reduced motion switched on mid-intro: jump straight to the end pose.
    introT.current = reducedMotion ? 1 : Math.min(introT.current + delta / INTRO_DURATION, 1);
    const e = easeInOutCubic(introT.current);
    const px = THREE.MathUtils.lerp(INTRO_FROM.position[0], 0, e);
    const py = THREE.MathUtils.lerp(INTRO_FROM.position[1], OVERVIEW_HEIGHT, e);
    const pz = THREE.MathUtils.lerp(INTRO_FROM.position[2], overviewDistanceRef.current, e);
    void ctrl.setLookAt(px, py, pz, ...OVERVIEW_TARGET, false);

    if (introT.current >= 1) setIntroActive(false);
  });

  // After the intro, hand control to the selection-driven camera moves. Runs on
  // selection changes only; resize and the reduced-motion setting are handled
  // elsewhere so they never fly the camera back or discard the user's orbit.
  useEffect(() => {
    if (introActive) return;
    const ctrl = controlsRef.current;
    if (!ctrl) return;

    const animate = !reducedMotion;
    if (selected) {
      const p = PROJECTS.find(pr => pr.id === selected);
      if (p) {
        void ctrl.setLookAt(...focusPose(p.position, focusDistanceRef.current, fovRef.current, sheetRef.current), animate);
      }
    } else {
      void ctrl.setLookAt(0, OVERVIEW_HEIGHT, overviewDistanceRef.current, ...OVERVIEW_TARGET, animate);
    }
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reducedMotion only picks animate; toggling it must not move the camera
  }, [selected, introActive, invalidate]);

  // Canvas aspect changed (resize, rotation): refit without resetting the orbit.
  // Overview keeps the user's angle and zoom, scaled by the change in fit
  // distance; a selected object is re-framed in place (no animation, so a
  // window-edge drag does not start a fly per frame). Crossing the bottom-sheet
  // breakpoint changes the framing even when the distance stays the same, so
  // it re-frames too (as a jump, like any other resize).
  useEffect(() => {
    const prevOverview = prevOverviewDistance.current;
    prevOverviewDistance.current = overviewDistance;
    const ctrl = controlsRef.current;
    if (!ctrl || introActiveRef.current) return;

    const current = selectedRef.current;
    if (current) {
      const p = PROJECTS.find(pr => pr.id === current);
      if (p) {
        void ctrl.setLookAt(...focusPose(p.position, focusDistance, fovRef.current, sheet), false);
      }
    } else if (prevOverview !== overviewDistance) {
      void ctrl.dollyTo(ctrl.distance * (overviewDistance / prevOverview), false);
    }
    invalidate();
  }, [focusDistance, overviewDistance, sheet, invalidate]);

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      enabled={selected === null && !introActive}
      minDistance={3}
      maxDistance={Math.max(MAX_DISTANCE_FLOOR, overviewDistance + MAX_DISTANCE_MARGIN)}
      dampingFactor={0.06}
    />
  );
}
