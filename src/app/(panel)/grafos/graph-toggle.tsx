'use client';

import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {setGraphEnabled} from './actions';

export function GraphToggle({universeId, enabled}: {universeId: string; enabled: boolean}) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
      <span className="text-sm font-semibold">¿Quieres una página de grafo?</span>
      <span className="relative inline-flex">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setOn(v);
            start(async () => {
              const r = await setGraphEnabled(universeId, v);
              if (!r.ok) setOn(!v);
              router.refresh();
            });
          }}
        />
        <span className="h-6 w-11 rounded-full bg-surface-2 ring-1 ring-line transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--ring)]" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
