'use client';

import {useState} from 'react';

type FM = Record<string, unknown>;

const HINTS: Record<string, string> = {
  type: 'personaje, lugar, evento, familia, objeto-concepto, libro…',
  saga: 'clave de la saga (p. ej. crsaso)',
  estado: 'Activo, Fallecido…',
  genero: 'Masculino / Femenino…',
  raza: 'Humano, Rapax Hominum…',
  updated: 'se actualiza solo al publicar',
  id: 'id interno de Docusaurus (avanzado)',
  slug: 'ruta personalizada (avanzado)',
  sidebar_label: 'texto en la barra lateral',
};

function toText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function fromText(s: string): unknown {
  const t = s.trim();
  if ((t.startsWith('[') && t.endsWith(']')) || (t.startsWith('{') && t.endsWith('}'))) {
    try {
      return JSON.parse(t);
    } catch {
      return s;
    }
  }
  if (/^-?\d+(\.\d+)?$/.test(t) && !/^0\d/.test(t)) return Number(t);
  if (t === 'true' || t === 'false') return t === 'true';
  return s;
}

export function FrontmatterEditor({
  description,
  onDescription,
  value,
  onChange,
  books,
}: {
  description: string;
  onDescription: (v: string) => void;
  value: FM;
  onChange: (v: FM) => void;
  books: {key: string; label: string}[];
}) {
  const [newKey, setNewKey] = useState('');
  const keys = Object.keys(value).filter((k) => k !== 'libro');
  const set = (k: string, v: unknown) => onChange({...value, [k]: v});
  const remove = (k: string) => {
    const next = {...value};
    delete next[k];
    onChange(next);
  };

  return (
    <div className="card space-y-5 p-5">
      <div>
        <label className="label" htmlFor="fm-description">
          Descripción
        </label>
        <textarea
          id="fm-description"
          className="input"
          rows={2}
          value={description}
          onChange={(e) => onDescription(e.target.value)}
          placeholder="Resumen breve (aparece en buscadores y tarjetas)"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="fm-libro">
            Libro
          </label>
          <select
            id="fm-libro"
            className="input"
            value={typeof value.libro === 'string' ? value.libro : ''}
            onChange={(e) => (e.target.value ? set('libro', e.target.value) : remove('libro'))}
          >
            <option value="">—</option>
            {books.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className="label">Otros datos</p>
        <div className="space-y-2">
          {keys.map((k) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate font-mono text-xs" title={HINTS[k] ?? k}>
                {k}
              </span>
              <input
                className="input"
                defaultValue={toText(value[k])}
                placeholder={HINTS[k]}
                onBlur={(e) => set(k, fromText(e.target.value))}
                aria-label={k}
              />
              <button type="button" className="btn btn-ghost px-2" aria-label={`Quitar ${k}`} onClick={() => remove(k)}>
                ✕
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input className="input max-w-60" placeholder="nueva_clave" value={newKey} onChange={(e) => setNewKey(e.target.value.trim())} />
          <button
            type="button"
            className="btn"
            disabled={!newKey || newKey in value}
            onClick={() => {
              set(newKey, '');
              setNewKey('');
            }}
          >
            Añadir dato
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Las listas se escriben como JSON: [&quot;a&quot;, &quot;b&quot;].</p>
      </div>
    </div>
  );
}
