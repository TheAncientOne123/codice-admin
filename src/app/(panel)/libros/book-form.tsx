'use client';

import {useState, useTransition} from 'react';
import {deleteBook, moveBook, saveBook, type BookResult} from './actions';

export type BookRow = {
  id: string;
  key: string;
  label: string;
  color: string;
  universe_id: string | null;
  article_id: string | null;
  cover: string | null;
  tagline: string | null;
  year: string | null;
  synopsis: string | null;
  buy_url: string | null;
  published: boolean;
  in_store: boolean;
};

export function BookForm({
  book: b,
  usage,
  universes,
  articles,
  first,
  last,
}: {
  book: BookRow | null;
  usage: number;
  universes: {id: string; label: string}[];
  articles: {id: string; title: string; universe_id: string}[];
  first: boolean;
  last: boolean;
}) {
  const [res, setRes] = useState<BookResult | null>(null);
  const [universe, setUniverse] = useState(b?.universe_id ?? universes[0]?.id ?? '');
  const [pending, start] = useTransition();
  const Wrapper = b ? 'section' : 'div';

  return (
    <Wrapper className={b ? 'card p-5' : ''} style={b ? {borderLeft: `4px solid ${b.color}`} : undefined}>
      <form action={(fd) => start(async () => setRes(await saveBook(b?.id ?? null, fd)))} className="grid gap-4 md:grid-cols-[120px_1fr]">
        <div className="space-y-2">
          {b?.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.cover} alt="" className="aspect-[2/3] w-full rounded-md object-cover shadow" />
          ) : (
            <div className="grid aspect-[2/3] w-full place-items-center rounded-md border border-dashed border-line text-xs text-muted">Sin portada</div>
          )}
          {b ? (
            <div className="flex justify-center gap-1">
              <button type="button" className="btn btn-ghost px-2" disabled={first || pending} onClick={() => start(async () => void (await moveBook(b.id, -1)))} aria-label="Subir">↑</button>
              <button type="button" className="btn btn-ghost px-2" disabled={last || pending} onClick={() => start(async () => void (await moveBook(b.id, 1)))} aria-label="Bajar">↓</button>
            </div>
          ) : null}
        </div>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_70px]">
            <div>
              <label className="label">Título</label>
              <input name="label" className="input" defaultValue={b?.label} required />
            </div>
            <div>
              <label className="label">Clave</label>
              <input name="key" className="input font-mono text-xs" defaultValue={b?.key} required placeholder="mi-libro" />
            </div>
            <div>
              <label className="label">Color</label>
              <input name="color" type="color" className="h-[38px] w-full cursor-pointer rounded-lg border border-line bg-transparent" defaultValue={b?.color ?? '#94a3b8'} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Universo</label>
              <select name="universe_id" className="input" value={universe} onChange={(e) => setUniverse(e.target.value)}>
                <option value="">—</option>
                {universes.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Ficha del libro</label>
              <select name="article_id" className="input" defaultValue={b?.article_id ?? ''}>
                <option value="">—</option>
                {articles
                  .filter((a) => a.universe_id === universe)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="label">Año / estado</label>
              <input name="year" className="input" defaultValue={b?.year ?? ''} placeholder="Desde 2025, Próximamente…" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Portada (URL)</label>
              <input name="cover" className="input font-mono text-xs" defaultValue={b?.cover ?? ''} />
            </div>
            <div>
              <label className="label">Frase corta</label>
              <input name="tagline" className="input" defaultValue={b?.tagline ?? ''} />
            </div>
          </div>
          <div>
            <label className="label">Sinopsis</label>
            <textarea name="synopsis" className="input" rows={2} defaultValue={b?.synopsis ?? ''} />
          </div>
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label className="label">Enlace de compra</label>
              <input name="buy_url" className="input font-mono text-xs" defaultValue={b?.buy_url ?? ''} placeholder="https://www.amazon…" />
            </div>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="published" defaultChecked={b?.published} className="accent-[var(--accent)]" />
              Publicado
            </label>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="in_store" defaultChecked={b?.in_store} className="accent-[var(--accent)]" />
              En la tienda
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {b ? 'Guardar libro' : 'Crear libro'}
            </button>
            {b ? (
              <>
                <span className="text-xs text-muted">{usage} artículo(s) lo usan</span>
                <button
                  type="button"
                  className="btn btn-danger ml-auto"
                  disabled={pending}
                  onClick={() => {
                    if (confirm(`¿Eliminar «${b.label}»?`)) start(async () => setRes(await deleteBook(b.id)));
                  }}
                >
                  Eliminar
                </button>
              </>
            ) : null}
            {res ? <span className={`text-sm ${res.ok ? 'text-ok' : 'text-danger'}`}>{res.ok ? res.message : res.error}</span> : null}
          </div>
        </div>
      </form>
    </Wrapper>
  );
}
