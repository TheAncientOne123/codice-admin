'use client';

import {useActionState, useState} from 'react';
import {createArticle, type ActionResult} from '../actions';

export function NewArticleForm({
  universes,
  categories,
}: {
  universes: {id: string; label: string}[];
  categories: {id: string; label: string; universe_id: string}[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(createArticle, null);
  const [universe, setUniverse] = useState(universes[0]?.id ?? '');
  const [title, setTitle] = useState('');

  return (
    <form action={action} className="card max-w-2xl space-y-4 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="universe_id">
            Universo
          </label>
          <select id="universe_id" name="universe_id" className="input" value={universe} onChange={(e) => setUniverse(e.target.value)}>
            {universes.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="category_id">
            Categoría
          </label>
          <select id="category_id" name="category_id" className="input" key={universe}>
            <option value="">(Raíz del universo)</option>
            {categories
              .filter((c) => c.universe_id === universe)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="title">
          Título
        </label>
        <input id="title" name="title" className="input" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="label" htmlFor="slug">
          Nombre de archivo (URL)
        </label>
        <input id="slug" name="slug" className="input" placeholder={title || 'Igual que el título'} />
        <p className="mt-1 text-xs text-muted">Define la dirección de la ficha. Si lo dejas vacío se usa el título.</p>
      </div>
      {state && !state.ok ? (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? 'Creando…' : 'Crear borrador'}
      </button>
    </form>
  );
}
