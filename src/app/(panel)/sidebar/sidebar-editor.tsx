'use client';

import {DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent} from '@dnd-kit/core';
import {SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy} from '@dnd-kit/sortable';
import {CSS} from '@dnd-kit/utilities';
import Link from 'next/link';
import {useState, useTransition} from 'react';
import {saveSidebar, type SidebarItemInput} from './actions';

type Item = SidebarItemInput & {key: string};
type ArticleOpt = {id: string; title: string; status: string; category: string; landing: boolean};
type U = {id: string; label: string; graphEnabled: boolean; items: Item[]; articles: ArticleOpt[]};

const KIND_LABEL = {articulo: 'Artículo', enlace: 'Enlace', grafo: 'Grafo'} as const;

function Row({item, articles, onChange, onRemove}: {item: Item; articles: ArticleOpt[]; onChange: (p: Partial<Item>) => void; onRemove: () => void}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: item.key});
  const article = articles.find((a) => a.id === item.article_id);
  const placeholder = item.kind === 'articulo' ? article?.title ?? '' : item.kind === 'grafo' ? 'Grafo de relaciones' : 'Texto del enlace';

  return (
    <li
      ref={setNodeRef}
      style={{transform: CSS.Transform.toString(transform), transition}}
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2 ${isDragging ? 'z-10 shadow-lg ring-2 ring-[var(--ring)]' : ''}`}
    >
      <button type="button" className="cursor-grab touch-none px-1 text-muted active:cursor-grabbing" aria-label="Arrastrar para reordenar" {...attributes} {...listeners}>
        ⋮⋮
      </button>
      <span className={`chip ${item.kind === 'grafo' ? 'border-accent/60 text-accent' : 'text-muted'}`}>{KIND_LABEL[item.kind]}</span>
      {item.kind === 'articulo' ? (
        <select className="input max-w-64" value={item.article_id ?? ''} onChange={(e) => onChange({article_id: e.target.value})}>
          {articles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.landing ? '★ ' : ''}
              {a.title} ({a.category}){a.status !== 'publicado' ? ` · ${a.status}` : ''}
            </option>
          ))}
        </select>
      ) : null}
      {item.kind === 'enlace' ? (
        <input className="input max-w-64 font-mono text-xs" placeholder="/ruta o https://…" value={item.href ?? ''} onChange={(e) => onChange({href: e.target.value})} />
      ) : null}
      <input
        className="input min-w-40 flex-1"
        placeholder={placeholder}
        value={item.label ?? ''}
        onChange={(e) => onChange({label: e.target.value})}
        aria-label="Etiqueta en el sidebar"
      />
      {item.kind === 'articulo' && article && article.status !== 'publicado' ? (
        <span className="text-xs text-warn" title="Los artículos no publicados no aparecen en el sitio">no publicado</span>
      ) : null}
      <button type="button" className="btn btn-ghost px-2 text-danger" onClick={onRemove} aria-label="Quitar">
        ✕
      </button>
    </li>
  );
}

function UniverseSidebar({u}: {u: U}) {
  const [items, setItems] = useState<Item[]>(u.items);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const [pending, start] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {coordinateGetter: sortableKeyboardCoordinates}));

  const change = (next: Item[]) => {
    setItems(next);
    setDirty(true);
    setMsg(null);
  };
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.key === e.active.id);
    const to = items.findIndex((i) => i.key === e.over!.id);
    change(arrayMove(items, from, to));
  };
  const add = (kind: Item['kind']) =>
    change([...items, {key: crypto.randomUUID(), kind, article_id: kind === 'articulo' ? u.articles[0]?.id ?? null : null, label: null, href: null}]);

  return (
    <div className="space-y-4">
      {!u.graphEnabled && items.some((i) => i.kind === 'grafo') ? (
        <p className="rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
          Este universo no tiene página de grafo activada: la entrada «Grafo» no se mostrará. Actívala en <Link className="font-semibold text-accent" href="/grafos">Grafos</Link>.
        </p>
      ) : null}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {items.map((it, idx) => (
              <Row
                key={it.key}
                item={it}
                articles={u.articles}
                onChange={(p) => change(items.map((x, k) => (k === idx ? {...x, ...p} : x)))}
                onRemove={() => change(items.filter((_, k) => k !== idx))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => add('articulo')}>
          + Artículo
        </button>
        <button type="button" className="btn" onClick={() => add('enlace')}>
          + Enlace
        </button>
        <button type="button" className="btn" disabled={items.some((i) => i.kind === 'grafo')} onClick={() => add('grafo')}>
          + Grafo
        </button>
        <span className="flex-1" />
        {msg ? <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</span> : null}
        <button
          type="button"
          className="btn btn-primary"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await saveSidebar(u.id, items);
              setMsg(r.ok ? {ok: true, text: 'Sidebar guardado.'} : {ok: false, text: r.error});
              if (r.ok) setDirty(false);
            })
          }
        >
          Guardar orden
        </button>
      </div>
    </div>
  );
}

export function SidebarEditor({universes}: {universes: U[]}) {
  const [active, setActive] = useState(universes[0]?.id);
  const u = universes.find((x) => x.id === active);
  return (
    <div className="card p-5">
      <div className="mb-5 flex flex-wrap gap-1" role="tablist">
        {universes.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === active}
            onClick={() => setActive(x.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${x.id === active ? 'bg-accent/15 text-ink' : 'text-muted hover:bg-surface-2'}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      {u ? <UniverseSidebar key={u.id} u={u} /> : null}
    </div>
  );
}
