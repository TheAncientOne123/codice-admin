'use client';

import Link from 'next/link';
import {useMemo, useState, useTransition} from 'react';
import {StatusBadge} from '@/components/status-badge';
import {bulkSetStatus} from './actions';

export type ArticleRow = {
  id: string;
  title: string;
  universeId: string;
  universe: string;
  categoryId: string | null;
  category: string;
  route: string;
  status: 'borrador' | 'publicado' | 'despublicado';
  isLanding: boolean;
  updatedAt: string;
  hasUnpublishedEdits: boolean;
};

type Filters = {universo: string; categoria: string; estado: string; q: string; cambios: boolean};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Diacritic}+/gu, '');

export function ArticleTable({
  rows,
  universes,
  categories,
  initial,
}: {
  rows: ArticleRow[];
  universes: {id: string; label: string}[];
  categories: {id: string; label: string; universeId: string}[];
  initial: Filters;
}) {
  const [f, setF] = useState<Filters>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const visible = useMemo(() => {
    const q = norm(f.q);
    return rows.filter(
      (r) =>
        (!f.universo || r.universeId === f.universo) &&
        (!f.categoria || r.categoryId === f.categoria) &&
        (!f.estado || r.status === f.estado) &&
        (!f.cambios || r.hasUnpublishedEdits) &&
        (!q || norm(r.title).includes(q) || norm(r.route).includes(q)),
    );
  }, [rows, f]);

  const set = (patch: Partial<Filters>) => {
    const next = {...f, ...patch};
    if (patch.universo !== undefined) next.categoria = '';
    setF(next);
    const p = new URLSearchParams();
    if (next.universo) p.set('universo', next.universo);
    if (next.categoria) p.set('categoria', next.categoria);
    if (next.estado) p.set('estado', next.estado);
    if (next.q) p.set('q', next.q);
    if (next.cambios) p.set('cambios', '1');
    window.history.replaceState(null, '', `?${p.toString()}`);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const allChecked = visible.length > 0 && visible.every((r) => selected.has(r.id));

  const bulk = (action: 'publicar' | 'despublicar') =>
    start(async () => {
      const r = await bulkSetStatus([...selected], action);
      setMsg(r.ok ? r.message ?? 'Hecho.' : r.error);
      setSelected(new Set());
    });

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor="q">
            Buscar
          </label>
          <input id="q" className="input" placeholder="Título o ruta…" value={f.q} onChange={(e) => set({q: e.target.value})} />
        </div>
        <div>
          <label className="label" htmlFor="universo">
            Universo
          </label>
          <select id="universo" className="input" value={f.universo} onChange={(e) => set({universo: e.target.value})}>
            <option value="">Todos</option>
            {universes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="categoria">
            Categoría
          </label>
          <select id="categoria" className="input" value={f.categoria} onChange={(e) => set({categoria: e.target.value})}>
            <option value="">Todas</option>
            {categories
              .filter((c) => !f.universo || c.universeId === f.universo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="estado">
            Estado
          </label>
          <select id="estado" className="input" value={f.estado} onChange={(e) => set({estado: e.target.value})}>
            <option value="">Todos</option>
            <option value="publicado">Publicado</option>
            <option value="borrador">Borrador</option>
            <option value="despublicado">Despublicado</option>
          </select>
        </div>
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input type="checkbox" checked={f.cambios} onChange={(e) => set({cambios: e.target.checked})} className="accent-[var(--accent)]" />
          Con ediciones sin publicar
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          {visible.length} de {rows.length} artículos
          {selected.size ? ` · ${selected.size} seleccionados` : ''}
        </span>
        <div className="flex items-center gap-2">
          {msg ? <span className="text-muted">{msg}</span> : null}
          <button type="button" className="btn" disabled={!selected.size || pending} onClick={() => bulk('publicar')}>
            Publicar selección
          </button>
          <button type="button" className="btn" disabled={!selected.size || pending} onClick={() => bulk('despublicar')}>
            Despublicar selección
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="w-10 p-3">
                <input
                  type="checkbox"
                  aria-label="Seleccionar todos"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(visible.map((r) => r.id)))}
                  className="accent-[var(--accent)]"
                />
              </th>
              <th className="p-3">Título</th>
              <th className="p-3 max-sm:hidden">Universo · Categoría</th>
              <th className="p-3">Estado</th>
              <th className="p-3 max-md:hidden">Editado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={r.id} className="hover:bg-surface-2">
                <td className="p-3">
                  <input
                    type="checkbox"
                    aria-label={`Seleccionar ${r.title}`}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="accent-[var(--accent)]"
                  />
                </td>
                <td className="p-3">
                  <Link href={`/articulos/${r.id}`} className="font-semibold hover:text-accent">
                    {r.title}
                  </Link>
                  {r.isLanding ? <span className="chip ml-2 text-muted">portada</span> : null}
                  <p className="truncate font-mono text-xs text-muted">{decodeURI(r.route)}</p>
                </td>
                <td className="p-3 text-muted max-sm:hidden">
                  {r.universe} · {r.category}
                </td>
                <td className="p-3">
                  <StatusBadge status={r.status} pendingEdits={r.hasUnpublishedEdits} />
                </td>
                <td className="p-3 text-xs text-muted max-md:hidden">{new Date(r.updatedAt).toLocaleDateString('es')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!visible.length ? <p className="p-6 text-center text-sm text-muted">No hay artículos con estos filtros.</p> : null}
      </div>
    </div>
  );
}
