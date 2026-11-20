'use client';

import { useEffect, useRef, useState } from 'react';
import type { Project } from '@/lib/projects';

interface Props {
  project: Project | null;
  onClose: () => void;
  /** Move keyboard focus into the panel when it opens. Off when the opener
   *  (the project index) is a control the user is stepping through. */
  moveFocus: boolean;
}

export function InfoPanel({ project, onClose, moveFocus }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  // Keep the last project's content mounted while the panel fades out, so it
  // does not collapse to an empty frame mid-transition.
  const [shown, setShown] = useState<Project | null>(project);
  if (project && project !== shown) setShown(project);
  const open = project !== null;

  // Latest value for the effect below, which must not re-run when it changes.
  const moveFocusRef = useRef(moveFocus);
  useEffect(() => { moveFocusRef.current = moveFocus; }, [moveFocus]);

  // Move focus to the scrolling body when the panel opens (so arrow/Page keys
  // scroll it) and back to what opened it on close. A selection made from the
  // project index leaves focus where it is; the body is still one Tab away.
  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      if (!panelRef.current?.contains(active) && active instanceof HTMLElement) {
        returnFocus.current = active;
      }
      if (moveFocusRef.current) bodyRef.current?.focus({ preventScroll: true });
    } else if (returnFocus.current) {
      // Only take focus back when it was lost with the panel (or never left
      // it); if the user has since put it somewhere else, leave it there.
      const active = document.activeElement;
      const lost = !active || active === document.body || panelRef.current?.contains(active);
      if (lost) returnFocus.current.focus({ preventScroll: true });
      returnFocus.current = null;
    }
  }, [open, project?.id]);

  // A selection from the project index keeps focus on the index button, so
  // screen readers get no cue that a panel opened: announce it politely. When
  // focus moves into the panel its labelled region is read instead.
  const announcement = project && !moveFocus ? `${project.title} details opened` : '';

  return (
    <>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</div>
      <div
        ref={panelRef}
        className={`info-panel${open ? ' info-panel--visible' : ''}`}
        inert={!open}
      >
        {shown && (
          <>
            {/* Title and close button sit outside the scroller, so the button
                never covers the scrollbar or the text scrolling under it. */}
            <div className="info-panel__head">
              <h2 id="info-panel-title" className="info-panel__title">{shown.title}</h2>
              <button className="info-panel__close" onClick={onClose} aria-label="Close">
                <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                  <path d="M1 1l10 10M11 1L1 11" fill="none" stroke="currentColor" strokeWidth="1.2" />
                </svg>
              </button>
            </div>
            <div
              ref={bodyRef}
              className="info-panel__body"
              role="region"
              aria-labelledby="info-panel-title"
              tabIndex={0}
            >
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
    </>
  );
}
