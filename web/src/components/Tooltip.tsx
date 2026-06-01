import { ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A small styled tooltip that renders into a portal with fixed positioning,
 * so it is never clipped by parent `overflow-hidden` containers and always
 * appears centered just above the trigger element.
 */
export function Tooltip({ text, children }: { text: string; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  function show() {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: r.left + r.width / 2, y: r.top });
  }

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      className="inline-flex"
    >
      {children}
      {pos &&
        createPortal(
          <div
            style={{ position: 'fixed', left: pos.x, top: pos.y - 8, transform: 'translate(-50%, -100%)' }}
            className="z-50 max-w-xs whitespace-normal rounded bg-slate-900 px-2 py-1 text-xs font-normal normal-case tracking-normal text-white shadow-lg pointer-events-none dark:bg-slate-700"
          >
            {text}
          </div>,
          document.body,
        )}
    </span>
  );
}
