'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import type {LinkTarget} from '@/lib/data/content-context';

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '');

/** Buscador de artículos para insertar enlaces internos. */
export function LinkPicker({
  targets,
  onPick,
  onClose,
}: {
  targets: LinkTarget[];
  onPick: (t: LinkTarget) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  const results = useMemo(() => {
    const nq = norm(q);
    return targets.filter((t) => !nq || norm(t.title).includes(nq) || norm(t.category).includes(nq)).slice(0, 30);
  }, [q, targets]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-start bg-black/40 px-4 pt-[12vh]" onMouseDown={onClose}>
      <div className="card w-full max-w-lg overflow-hidden" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Enlazar artículo">
        <input
          ref={input}
          className="w-full border-b border-line bg-transparent px-4 py-3 text-sm outline-none"
          placeholder="Buscar artículo para enlazar…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((i) => Math.min(results.length - 1, i + 1));
            else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
            else if (e.key === 'Enter' && results[active]) onPick(results[active]);
            else if (e.key === 'Escape') onClose();
            else return;
            e.preventDefault();
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-1" role="listbox">
          {results.map((t, i) => (
            <li
              key={t.id}
              role="option"
              aria-selected={i === active}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2 text-sm ${i === active ? 'bg-accent/15' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(t);
              }}
            >
              <span className="truncate">
                {t.title}
                {t.status !== 'publicado' ? <span className="ml-2 text-xs text-warn">({t.status})</span> : null}
              </span>
              <span className="shrink-0 text-xs text-muted">
                {t.universe} · {t.category || 'raíz'}
              </span>
            </li>
          ))}
          {!results.length ? <li className="px-4 py-3 text-sm text-muted">Sin resultados.</li> : null}
        </ul>
      </div>
    </div>
  );
}
