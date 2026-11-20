'use client';

import { PROJECTS, type ProjectId } from '@/lib/projects';

interface Props {
  selected: ProjectId | null;
  onSelect: (id: ProjectId) => void;
}

// Keyboard and touch route to the same project panels the 3D objects open.
export function ProjectIndex({ selected, onSelect }: Props) {
  return (
    <nav className="obs-index" aria-label="Projects">
      <ul>
        {PROJECTS.map(p => (
          <li key={p.id}>
            <button
              className="obs-index__item"
              aria-pressed={selected === p.id}
              onClick={() => { onSelect(p.id); }}
            >
              {p.title}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
