'use client';

import {useActionState, useState, useTransition} from 'react';
import type {Category, Universe} from '@/lib/content/types';
import {createUniverse, moveUniverse, saveCategory, updateUniverse, type Result} from './actions';

const VIS_LABEL = {
  publico: 'Público: visible y navegable',
  proximamente: 'Próximamente: tarjeta visible pero deshabilitada',
  oculto: 'Oculto: no se publica en absoluto',
} as const;

function Feedback({r}: {r: Result | null}) {
  if (!r) return null;
  return <p className={`text-sm ${r.ok ? 'text-ok' : 'text-danger'}`}>{r.ok ? r.message : r.error}</p>;
}

export function UniverseCard({
  universe: u,
  categories,
  published,
  first,
  last,
}: {
  universe: Universe;
  categories: (Category & {published: number})[];
  published: number;
  first: boolean;
  last: boolean;
}) {
  const [res, setRes] = useState<Result | null>(null);
  const [pending, start] = useTransition();

  return (
    <section className="card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{u.label}</h2>
          <p className="font-mono text-xs text-muted">
            /{u.route_base} · {published} artículos publicados
          </p>
        </div>
        <div className="flex gap-1">
          <button type="button" className="btn btn-ghost px-2" disabled={first || pending} onClick={() => start(async () => void (await moveUniverse(u.id, -1)))} aria-label="Subir">
            ↑
          </button>
          <button type="button" className="btn btn-ghost px-2" disabled={last || pending} onClick={() => start(async () => void (await moveUniverse(u.id, 1)))} aria-label="Bajar">
            ↓
          </button>
        </div>
      </div>

      <form
        action={(fd) => start(async () => setRes(await updateUniverse(u.id, fd)))}
        className="grid gap-4 md:grid-cols-[1fr_200px]"
      >
        <div className="space-y-3">
          <div>
            <label className="label">Nombre</label>
            <input name="label" className="input" defaultValue={u.label} required />
          </div>
          <div>
            <label className="label">Descripción (tarjeta del selector)</label>
            <textarea name="description" className="input" rows={2} defaultValue={u.description ?? ''} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Portada (URL)</label>
              <input name="cover_image" className="input" defaultValue={u.cover_image ?? ''} />
            </div>
            <div>
              <label className="label">Tema visual</label>
              <select name="theme_id" className="input" defaultValue={u.theme_id ?? ''}>
                <option value="">Por defecto (claro/oscuro)</option>
                <option value="orbe">Orbe</option>
                <option value="meridian">Meridian</option>
                <option value="tumulo">Túmulo</option>
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="label">Visibilidad</legend>
            <div className="space-y-1">
              {(Object.keys(VIS_LABEL) as (keyof typeof VIS_LABEL)[]).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="visibility" value={v} defaultChecked={u.visibility === v} className="accent-[var(--accent)]" />
                  {VIS_LABEL[v]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              Guardar universo
            </button>
            <Feedback r={res} />
          </div>
        </div>
        {u.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={u.cover_image} alt="" className="h-48 w-full rounded-lg object-cover md:h-full" />
        ) : (
          <div className="grid h-48 place-items-center rounded-lg border border-dashed border-line text-xs text-muted">Sin portada</div>
        )}
      </form>

      <details className="mt-5 border-t border-line pt-4">
        <summary className="cursor-pointer text-sm font-semibold">Categorías ({categories.length})</summary>
        <ul className="mt-3 space-y-2">
          {categories.map((c) => (
            <li key={c.id}>
              <form action={(fd) => start(async () => setRes(await saveCategory(u.id, fd)))} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={c.id} />
                <span className="w-40 font-mono text-xs text-muted">{c.slug}/</span>
                <input name="label" className="input max-w-xs" defaultValue={c.label} />
                <span className="text-xs text-muted">{c.published} publicados</span>
                <button type="submit" className="btn btn-ghost text-xs">
                  Guardar
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={(fd) => start(async () => setRes(await saveCategory(u.id, fd)))} className="mt-3 flex flex-wrap items-center gap-2">
          <input name="slug" className="input w-40 font-mono text-xs" placeholder="carpeta" required />
          <input name="label" className="input max-w-xs" placeholder="Nombre visible" required />
          <button type="submit" className="btn">
            + Categoría
          </button>
        </form>
      </details>
    </section>
  );
}

export function NewUniverseForm() {
  const [state, action, pending] = useActionState<Result | null, FormData>(createUniverse, null);
  return (
    <details className="card p-5">
      <summary className="cursor-pointer font-semibold">+ Nuevo universo</summary>
      <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px_auto] sm:items-end">
        <div>
          <label className="label">Nombre</label>
          <input name="label" className="input" required />
        </div>
        <div>
          <label className="label">Ruta (URL)</label>
          <input name="route_base" className="input font-mono" placeholder="MiUniverso" required />
        </div>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          Crear
        </button>
      </form>
      <div className="mt-2">
        <Feedback r={state} />
      </div>
    </details>
  );
}
