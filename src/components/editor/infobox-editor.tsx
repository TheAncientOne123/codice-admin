'use client';

import {Fragment, useState} from 'react';
import {parseInline, type InlineNode} from '@/lib/content/inline';
import type {Infobox, InfoboxImage, InfoboxRow} from '@/lib/content/types';
import type {LinkTarget} from '@/lib/data/content-context';
import {LinkPicker} from './link-picker';

const EMPTY: Infobox = {title: '', caption: '', rows: [{label: '', value: ''}], placement: 'tras-titulo', browserOnly: true};

function Inline({nodes}: {nodes: InlineNode[]}) {
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type === 'text') return <Fragment key={i}>{n.value}</Fragment>;
        if (n.type === 'em') return <em key={i}><Inline nodes={n.children} /></em>;
        if (n.type === 'strong') return <strong key={i}><Inline nodes={n.children} /></strong>;
        return (
          <span key={i} className="text-accent underline decoration-dotted underline-offset-2" title={decodeURI(n.url)}>
            <Inline nodes={n.children} />
          </span>
        );
      })}
    </>
  );
}

/** Vista previa con la misma estructura que la Infobox del sitio. */
function Preview({box}: {box: Infobox}) {
  const img = box.images?.[0] ?? box.image;
  return (
    <aside className="overflow-hidden rounded-xl border border-line bg-surface text-sm">
      {box.title ? <p className="bg-surface-2 px-3 py-2 text-center font-bold">{box.title}</p> : null}
      {img?.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.src} alt={img.alt ?? ''} className="max-h-72 w-full object-cover" />
      ) : null}
      {box.caption ? <p className="px-3 py-1.5 text-center text-xs italic text-muted">{box.caption}</p> : null}
      <dl className="divide-y divide-line">
        {box.rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[40%_1fr] gap-2 px-3 py-1.5">
            <dt className="font-semibold">{r.label}</dt>
            <dd>
              <Inline nodes={parseInline(r.value)} />
            </dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

export function InfoboxEditor({
  value,
  onChange,
  targets,
  labelSuggestions,
}: {
  value: Infobox | null;
  onChange: (v: Infobox | null) => void;
  targets: LinkTarget[];
  labelSuggestions: string[];
}) {
  const [pickFor, setPickFor] = useState<number | null>(null);

  if (!value) {
    return (
      <div className="card p-8 text-center">
        <p className="mb-3 text-sm text-muted">Este artículo no tiene ficha (Infobox).</p>
        <button type="button" className="btn btn-primary" onClick={() => onChange(EMPTY)}>
          Añadir ficha
        </button>
      </div>
    );
  }

  const box = value;
  const set = (patch: Partial<Infobox>) => onChange({...box, ...patch});
  const setRow = (i: number, patch: Partial<InfoboxRow>) => set({rows: box.rows.map((r, k) => (k === i ? {...r, ...patch} : r))});
  const moveRow = (i: number, d: -1 | 1) => {
    const rows = [...box.rows];
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    [rows[i], rows[j]] = [rows[j], rows[i]];
    set({rows});
  };
  const images: InfoboxImage[] = box.images?.length ? box.images : box.image ? [box.image] : [];
  const setImages = (imgs: InfoboxImage[]) =>
    imgs.length <= 1 ? set({image: imgs[0], images: undefined}) : set({image: undefined, images: imgs});

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div className="card space-y-4 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Título de la ficha</label>
              <input className="input" value={box.title ?? ''} onChange={(e) => set({title: e.target.value})} />
            </div>
            <div>
              <label className="label">Pie (subtítulo)</label>
              <input className="input" value={box.caption ?? ''} onChange={(e) => set({caption: e.target.value})} />
            </div>
          </div>

          <div>
            <label className="label">Imágenes {images.length > 1 ? '(carrusel)' : ''}</label>
            <div className="space-y-2">
              {images.map((img, i) => (
                <div key={i} className="flex flex-wrap gap-2">
                  <input
                    className="input min-w-60 flex-[2]"
                    placeholder="URL de la imagen (Cloudinary…)"
                    value={img.src}
                    onChange={(e) => setImages(images.map((x, k) => (k === i ? {...x, src: e.target.value} : x)))}
                  />
                  <input
                    className="input flex-1"
                    placeholder="Texto alternativo"
                    value={img.alt ?? ''}
                    onChange={(e) => setImages(images.map((x, k) => (k === i ? {...x, alt: e.target.value} : x)))}
                  />
                  {images.length > 1 ? (
                    <input
                      className="input w-32"
                      placeholder="Etiqueta"
                      value={img.label ?? ''}
                      onChange={(e) => setImages(images.map((x, k) => (k === i ? {...x, label: e.target.value} : x)))}
                    />
                  ) : null}
                  <button type="button" className="btn btn-ghost" aria-label="Quitar imagen" onClick={() => setImages(images.filter((_, k) => k !== i))}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn" onClick={() => setImages([...images, {src: '', alt: box.title ?? ''}])}>
                + Imagen
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Posición en el artículo</label>
              <select className="input" value={box.placement} onChange={(e) => set({placement: e.target.value as Infobox['placement']})}>
                <option value="tras-titulo">Tras el título (habitual)</option>
                <option value="inicio">Al inicio</option>
                <option value="marcador">Donde esté el marcador en el contenido</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" checked={box.browserOnly} onChange={(e) => set({browserOnly: e.target.checked})} />
              Renderizar solo en el navegador (como hasta ahora)
            </label>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-bold">Filas</h3>
            <p className="text-xs text-muted">Valores: texto, *cursiva*, **negrita** y enlaces</p>
          </div>
          <datalist id="infobox-labels">
            {labelSuggestions.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
          <ol className="space-y-2">
            {box.rows.map((r, i) => (
              <li key={i} className="flex flex-wrap items-start gap-2 rounded-lg border border-line p-2">
                <input
                  className="input w-44"
                  list="infobox-labels"
                  placeholder="Etiqueta"
                  value={r.label}
                  onChange={(e) => setRow(i, {label: e.target.value})}
                  aria-label={`Etiqueta de la fila ${i + 1}`}
                />
                <textarea
                  className="input min-h-[38px] min-w-60 flex-1 font-mono text-xs"
                  rows={Math.min(4, Math.ceil(r.value.length / 70) || 1)}
                  placeholder="Valor"
                  value={r.value}
                  onChange={(e) => setRow(i, {value: e.target.value})}
                  aria-label={`Valor de la fila ${i + 1}`}
                />
                <div className="flex gap-1">
                  <button type="button" className="btn btn-ghost px-2" title="Añadir enlace a ficha" onClick={() => setPickFor(i)}>
                    ↗
                  </button>
                  <button type="button" className="btn btn-ghost px-2" title="Subir" onClick={() => moveRow(i, -1)}>
                    ↑
                  </button>
                  <button type="button" className="btn btn-ghost px-2" title="Bajar" onClick={() => moveRow(i, 1)}>
                    ↓
                  </button>
                  <button type="button" className="btn btn-ghost px-2 text-danger" title="Eliminar fila" onClick={() => set({rows: box.rows.filter((_, k) => k !== i)})}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex justify-between">
            <button type="button" className="btn" onClick={() => set({rows: [...box.rows, {label: '', value: ''}]})}>
              + Fila
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                if (confirm('¿Quitar la ficha de este artículo?')) onChange(null);
              }}
            >
              Quitar ficha
            </button>
          </div>
        </div>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="label">Vista previa</p>
        <Preview box={box} />
      </div>

      {pickFor !== null ? (
        <LinkPicker
          targets={targets}
          onClose={() => setPickFor(null)}
          onPick={(t) => {
            const row = box.rows[pickFor];
            setRow(pickFor, {value: `${row.value}${row.value && !row.value.endsWith(' ') ? ' ' : ''}[${t.title}](${t.href})`});
            setPickFor(null);
          }}
        />
      ) : null}
    </div>
  );
}
