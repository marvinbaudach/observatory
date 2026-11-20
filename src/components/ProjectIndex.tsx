'use client';

import { PROJECTS, type ProjectId } from '@/lib/projects';

interface Props {
  selected: ProjectId | null;
  onSelect: (id: ProjectId) => void;
}

// Keyboard and touch route to the same project panels the 3D objects open.
// The buttons open a panel rather than toggle state, so the open project is
// marked with aria-current, not aria-pressed.
export function ProjectIndex({ selected, onSelect }: Props) {
  return (
    <nav className="obs-index" aria-label="Projects">
      <ul>
        {PROJECTS.map(p => (
          <li key={p.id}>
            <button
              className="obs-index__item"
              aria-current={selected === p.id ? 'true' : undefined}
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
