'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/projects';

interface Props {
  project: Project | null;
  onClose: () => void;
}

export function InfoPanel({ project, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Keep the last project's content mounted while the panel fades out, so it
  // does not collapse to an empty frame mid-transition.
  const [shown, setShown] = useState<Project | null>(project);
  if (project && project !== shown) setShown(project);
  const open = project !== null;

  // Move focus into the panel when it opens and back to what opened it on close.
  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      if (!panelRef.current?.contains(active) && active instanceof HTMLElement) {
        returnFocus.current = active;
      }
      panelRef.current?.focus({ preventScroll: true });
    } else if (returnFocus.current) {
      returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open, project?.id]);

  return (
    <div
      ref={panelRef}
      className={`info-panel${open ? ' info-panel--visible' : ''}`}
      role="region"
      aria-labelledby="info-panel-title"
      tabIndex={-1}
      inert={!open}
    >
      {shown && (
        <>
          <button className="info-panel__close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M1 1l10 10M11 1L1 11" fill="none" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </button>
          <div className="info-panel__body">
            <h2 id="info-panel-title" className="info-panel__title">{shown.title}</h2>
            <p className="info-panel__desc">{shown.description}</p>
            <ul className="info-panel__tags" aria-label="Technologies">
              {shown.tags.map(t => (
                <li key={t} className="info-panel__tag">{t}</li>
              ))}
            </ul>
            <a
              className="info-panel__link"
              href={shown.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ borderColor: shown.accentColor, color: shown.accentColor }}
            >
              Open live demo<span className="sr-only"> (new tab)</span>
            </a>
          </div>
        </>
      )}
    </div>
  );
}
