'use client';

import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { PROJECTS, type ProjectId, type Project } from '@/lib/projects';
import { CameraRig }      from './CameraRig';
import { ProjectObject }  from './ProjectObject';
import { Particles }      from './Particles';
import { Nebula }         from './Nebula';
import { Constellation }  from './Constellation';
import { PostProcessing } from './PostProcessing';
import { InfoPanel }      from './InfoPanel';

export default function ObservatoryScene() {
  const [selected, setSelected] = useState<ProjectId | null>(null);

  const selectedProject: Project | null =
    selected ? PROJECTS.find(p => p.id === selected) ?? null : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100svh' }}>
      <Canvas
        camera={{ position: [0, 1.5, 12], fov: 55 }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          antialias: true,
        }}
        style={{ background: '#04030f' }}
        onClick={() => setSelected(null)}
      >
        <ambientLight intensity={0.08} />
        <pointLight position={[10, 10, 10]} intensity={0.4} />

        <CameraRig selected={selected} />

        {PROJECTS.map(p => (
          <ProjectObject
            key={p.id}
            project={p}
            selected={selected}
            onSelect={setSelected}
          />
        ))}

        <Nebula />
        <Constellation />
        <Particles />
        <PostProcessing />
      </Canvas>

      {/* Atmospheric vignette + grain over the scene */}
      <div className="obs-vignette" />

      {/* Wordmark (top-left) */}
      <div className="obs-wordmark">
        <div className="obs-wordmark__title">Observatory</div>
        <div className="obs-wordmark__rule" />
        <div className="obs-wordmark__coord">α 14ʰ29ᵐ · δ +44°02′ · mag 2.1</div>
        <div className="obs-wordmark__sub">React Three Fiber · Three.js · WebGL</div>
      </div>

      {/* Hint */}
      {!selected && (
        <div className="obs-hint">Klicke ein Objekt · Orbit mit Drag</div>
      )}

      <InfoPanel project={selectedProject} onClose={() => setSelected(null)} />
    </div>
  );
}
