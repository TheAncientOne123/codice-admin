'use client';

import {useMemo, useState, useTransition} from 'react';
import TimelineBoard from '@/components/timeline/timeline-board';
import type {TimelineEntry, TimelineLane} from '@/components/timeline/types';
import {saveTimeline, type EntryRow, type LaneRow} from './actions';

const KINDS = [
  {id: 'escritura', label: 'Escritura (barra)'},
  {id: 'publicacion', label: 'Publicación (hito)'},
  {id: 'proyecto', label: 'Proyecto futuro (discontinuo)'},
] as const;

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'entrada';

export function TimelineEditor({
  initialLanes,
  initialEntries,
  universes,
}: {
  initialLanes: LaneRow[];
  initialEntries: EntryRow[];
  universes: {id: string; label: string; route_base: string}[];
}) {
  const [lanes, setLanes] = useState(initialLanes);
  const [entries, setEntries] = useState(initialEntries);
  const [open, setOpen] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const [pending, start] = useTransition();

  const touch = () => {
    setDirty(true);
    setMsg(null);
  };
  const setLane = (i: number, p: Partial<LaneRow>) => {
    setLanes(lanes.map((l, k) => (k === i ? {...l, ...p} : l)));
    touch();
  };
  const setEntry = (id: string, p: Partial<EntryRow>) => {
    setEntries(entries.map((e) => (e.id === id ? {...e, ...p} : e)));
    touch();
  };
  const addEntry = (laneId: string) => {
    const id = `${laneId}-${Date.now().toString(36)}`;
    setEntries([...entries, {id, lane_id: laneId, kind: 'escritura', title: 'Nueva entrada', start_date: String(new Date().getFullYear()), end_date: null, ongoing: true, approx: true, description: null, href: null, cover: null}]);
    setOpen(id);
    touch();
  };

  // Datos con la forma que usa el tablero de El Códice.
  const board = useMemo(() => {
    const ls: TimelineLane[] = lanes.map((l) => ({id: l.id, label: l.label, color: l.color, href: l.href ?? undefined}));
    const es: TimelineEntry[] = entries
      .filter((e) => /^\d{4}(-\d{2}(-\d{2})?)?$/.test(e.start_date))
      .map((e) => ({
        id: e.id,
        lane: e.lane_id,
        kind: e.kind,
        title: e.title,
        start: e.start_date,
        end: e.kind === 'publicacion' ? undefined : e.ongoing ? null : e.end_date ?? undefined,
        approx: e.approx,
        description: e.description ?? undefined,
        href: e.href ?? undefined,
        cover: e.cover ?? undefined,
      }));
    return {ls, es};
  }, [lanes, entries]);

  return (
    <div className="space-y-6">
      <div className="card ifm-shim p-4">
        <p className="label mb-3">Vista previa</p>
        <TimelineBoard key={`${lanes.length}-${entries.length}`} lanes={board.ls} entries={board.es} />
      </div>

      <div className="flex items-center justify-end gap-3">
        {msg ? <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</span> : null}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await saveTimeline(lanes, entries);
              setMsg(r.ok ? {ok: true, text: 'Timeline guardada.'} : {ok: false, text: r.error});
              if (r.ok) setDirty(false);
            })
          }
        >
          Guardar timeline
        </button>
      </div>

      {lanes.map((lane, i) => (
        <section key={lane.id} className="card p-5" style={{borderTop: `3px solid ${lane.color}`}}>
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <input type="color" aria-label="Color del carril" value={lane.color} onChange={(e) => setLane(i, {color: e.target.value})} className="h-9 w-11 cursor-pointer rounded border border-line bg-transparent" />
            <div className="min-w-48 flex-1">
              <label className="label">Carril</label>
              <input className="input" value={lane.label} onChange={(e) => setLane(i, {label: e.target.value})} />
            </div>
            <div>
              <label className="label">Universo</label>
              <select
                className="input"
                value={lane.universe_id ?? ''}
                onChange={(e) => {
                  const u = universes.find((x) => x.id === e.target.value);
                  setLane(i, {universe_id: u?.id ?? null, href: u ? `/${u.route_base}` : lane.href});
                }}
              >
                <option value="">—</option>
                {universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-1">
              <button type="button" className="btn btn-ghost px-2" disabled={i === 0} onClick={() => { const l = [...lanes]; [l[i - 1], l[i]] = [l[i], l[i - 1]]; setLanes(l); touch(); }} aria-label="Subir carril">↑</button>
              <button type="button" className="btn btn-ghost px-2" disabled={i === lanes.length - 1} onClick={() => { const l = [...lanes]; [l[i + 1], l[i]] = [l[i], l[i + 1]]; setLanes(l); touch(); }} aria-label="Bajar carril">↓</button>
              <button
                type="button"
                className="btn btn-ghost px-2 text-danger"
                aria-label="Eliminar carril"
                onClick={() => {
                  if (!confirm(`¿Eliminar el carril «${lane.label}» y sus entradas?`)) return;
                  setLanes(lanes.filter((_, k) => k !== i));
                  setEntries(entries.filter((e) => e.lane_id !== lane.id));
                  touch();
                }}
              >
                ✕
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {entries
              .filter((e) => e.lane_id === lane.id)
              .map((e) => (
                <li key={e.id} className="rounded-lg border border-line">
                  <button type="button" className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                    <span className="font-semibold">{e.title}</span>
                    <span className="text-xs text-muted">
                      {KINDS.find((k) => k.id === e.kind)?.label.split(' ')[0]} · {e.approx ? 'c. ' : ''}
                      {e.start_date}
                      {e.kind !== 'publicacion' ? ` → ${e.ongoing ? 'en curso' : e.end_date ?? '?'}` : ''}
                    </span>
                  </button>
                  {open === e.id ? (
                    <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className="label">Título</label>
                        <input className="input" value={e.title} onChange={(ev) => setEntry(e.id, {title: ev.target.value})} />
                      </div>
                      <div>
                        <label className="label">Tipo</label>
                        <select className="input" value={e.kind} onChange={(ev) => setEntry(e.id, {kind: ev.target.value as EntryRow['kind']})}>
                          {KINDS.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 self-end pb-2 text-sm">
                        <input type="checkbox" className="accent-[var(--accent)]" checked={e.approx} onChange={(ev) => setEntry(e.id, {approx: ev.target.checked})} />
                        Fecha aproximada
                      </label>
                      <div>
                        <label className="label">{e.kind === 'publicacion' ? 'Fecha' : 'Inicio'} (AAAA, AAAA-MM o AAAA-MM-DD)</label>
                        <input className="input font-mono" value={e.start_date} onChange={(ev) => setEntry(e.id, {start_date: ev.target.value.trim()})} />
                      </div>
                      {e.kind !== 'publicacion' ? (
                        <div>
                          <label className="label">Fin</label>
                          <div className="flex items-center gap-2">
                            <input className="input font-mono" disabled={e.ongoing} value={e.end_date ?? ''} onChange={(ev) => setEntry(e.id, {end_date: ev.target.value.trim() || null})} />
                            <label className="flex shrink-0 items-center gap-1.5 text-sm">
                              <input type="checkbox" className="accent-[var(--accent)]" checked={e.ongoing} onChange={(ev) => setEntry(e.id, {ongoing: ev.target.checked})} />
                              En curso
                            </label>
                          </div>
                        </div>
                      ) : null}
                      <div className="sm:col-span-2">
                        <label className="label">Descripción</label>
                        <textarea className="input" rows={2} value={e.description ?? ''} onChange={(ev) => setEntry(e.id, {description: ev.target.value || null})} />
                      </div>
                      <div>
                        <label className="label">Enlace (ficha o tienda)</label>
                        <input className="input font-mono text-xs" value={e.href ?? ''} onChange={(ev) => setEntry(e.id, {href: ev.target.value || null})} />
                      </div>
                      <div>
                        <label className="label">Portada (URL)</label>
                        <input className="input font-mono text-xs" value={e.cover ?? ''} onChange={(ev) => setEntry(e.id, {cover: ev.target.value || null})} />
                      </div>
                      <div className="sm:col-span-2 flex justify-end">
                        <button type="button" className="btn btn-danger" onClick={() => { setEntries(entries.filter((x) => x.id !== e.id)); touch(); }}>
                          Eliminar entrada
                        </button>
                      </div>
                    </div>
                  ) : null}
                </li>
              ))}
          </ul>
          <button type="button" className="btn mt-3" onClick={() => addEntry(lane.id)}>
            + Entrada
          </button>
        </section>
      ))}

      <button
        type="button"
        className="btn"
        onClick={() => {
          const label = 'Nuevo carril';
          setLanes([...lanes, {id: `${slugify(label)}-${Date.now().toString(36)}`, label, color: '#94a3b8', href: null, universe_id: null}]);
          touch();
        }}
      >
        + Carril
      </button>
    </div>
  );
}
