'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useId, useMemo, useState, useTransition} from 'react';
import {buildGraph, type GraphArticle, type GraphConfig, type GraphGroup} from '@/lib/content/graph';
import {saveGraphConfig} from '../actions';

const GraphPreview = dynamic(() => import('@/components/graph/graph-preview'), {
  ssr: false,
  loading: () => <div className="h-full animate-pulse rounded-xl bg-surface-2" />,
});

type Art = GraphArticle & {status: string};

function ArticleAdder({articles, exclude, onAdd, placeholder}: {articles: Art[]; exclude: Set<string>; onAdd: (id: string) => void; placeholder: string}) {
  const [q, setQ] = useState('');
  const listId = `arts-${useId().replace(/:/g, '')}`;
  const byTitle = useMemo(() => new Map(articles.map((a) => [a.title, a.id])), [articles]);
  return (
    <>
      <input
        className="input text-xs"
        list={listId}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          const id = byTitle.get(e.target.value);
          if (id) {
            onAdd(id);
            setQ('');
          } else setQ(e.target.value);
        }}
      />
      <datalist id={listId}>
        {articles
          .filter((a) => !exclude.has(a.id))
          .map((a) => (
            <option key={a.id} value={a.title} />
          ))}
      </datalist>
    </>
  );
}

function Chips({ids, articles, onRemove}: {ids: string[]; articles: Map<string, Art>; onRemove: (id: string) => void}) {
  if (!ids.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {ids.map((id) => (
        <span key={id} className="chip">
          {articles.get(id)?.title ?? '(eliminado)'}
          <button type="button" aria-label="Quitar" className="text-muted hover:text-danger" onClick={() => onRemove(id)}>
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

export function GraphEditor({
  universe,
  config,
  articles,
  categories,
  links,
  books,
}: {
  universe: {id: string; label: string};
  config: GraphConfig;
  articles: Art[];
  categories: {slug: string; label: string}[];
  links: {from_id: string; to_id: string; scope: 'draft' | 'published'}[];
  books: {key: string; label: string; color: string}[];
}) {
  const [cfg, setCfg] = useState<GraphConfig>({...config, settings: {repulsion: 10, gravity: 1, labelThreshold: 9, colorMode: 'grupo', ...config.settings}});
  const [drafts, setDrafts] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const [pending, start] = useTransition();
  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles]);

  const set = (patch: Partial<GraphConfig>) => {
    setCfg((c) => ({...c, ...patch}));
    setDirty(true);
    setMsg(null);
  };
  const setGroup = (i: number, patch: Partial<GraphGroup>) => set({groups: cfg.groups.map((g, k) => (k === i ? {...g, ...patch} : g))});
  const moveGroup = (i: number, d: -1 | 1) => {
    const groups = [...cfg.groups];
    const j = i + d;
    if (j < 0 || j >= groups.length) return;
    [groups[i], groups[j]] = [groups[j], groups[i]];
    set({groups});
  };

  const preview = useMemo(() => {
    const scope = drafts ? 'draft' : 'published';
    const pool = articles.filter((a) => drafts || a.status === 'publicado');
    return buildGraph(pool, links.filter((l) => l.scope === scope), cfg);
  }, [articles, links, cfg, drafts]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of preview.nodes) m.set(n.group, (m.get(n.group) ?? 0) + 1);
    return m;
  }, [preview]);

  const s = cfg.settings;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/grafos" className="text-xs text-muted hover:text-accent">
            ← Grafos
          </Link>
          <h1 className="text-2xl font-bold">Grafo · {universe.label}</h1>
        </div>
        <div className="flex items-center gap-3">
          {msg ? <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</span> : null}
          <button
            type="button"
            className="btn btn-primary"
            disabled={!dirty || pending}
            onClick={() =>
              start(async () => {
                const r = await saveGraphConfig(cfg);
                setMsg(r.ok ? {ok: true, text: r.message ?? 'Guardado.'} : {ok: false, text: r.error});
                if (r.ok) setDirty(false);
              })
            }
          >
            Guardar grafo
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,460px)_1fr]">
        <div className="space-y-5">
          <section className="card space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Título de la página</label>
                <input className="input" value={cfg.title ?? ''} onChange={(e) => set({title: e.target.value})} />
              </div>
              <div>
                <label className="label">Ruta</label>
                <div className="flex items-center gap-1 font-mono text-xs">
                  <span className="text-muted">/grafos/</span>
                  <input className="input font-mono text-xs" value={cfg.route_slug} onChange={(e) => set({route_slug: e.target.value.toLowerCase()})} />
                </div>
              </div>
            </div>
          </section>

          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold">Grupos de color</h2>
              <p className="text-xs text-muted">El primer grupo que coincide gana</p>
            </div>
            <ol className="space-y-3">
              {cfg.groups.map((g, i) => (
                <li key={g.id} className="space-y-2 rounded-lg border border-line p-3" style={{borderLeft: `4px solid ${g.color}`}}>
                  <div className="flex items-center gap-2">
                    <input type="color" aria-label="Color" value={g.color} onChange={(e) => setGroup(i, {color: e.target.value})} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" />
                    <input className="input flex-1" value={g.label} onChange={(e) => setGroup(i, {label: e.target.value})} placeholder="Nombre del grupo" />
                    <span className="w-8 text-right text-xs text-muted tabular-nums" title="Nodos en el grupo">
                      {counts.get(g.id) ?? 0}
                    </span>
                    <button type="button" className="btn btn-ghost px-1.5" onClick={() => moveGroup(i, -1)} aria-label="Subir">
                      ↑
                    </button>
                    <button type="button" className="btn btn-ghost px-1.5" onClick={() => moveGroup(i, 1)} aria-label="Bajar">
                      ↓
                    </button>
                    <button type="button" className="btn btn-ghost px-1.5 text-danger" onClick={() => set({groups: cfg.groups.filter((_, k) => k !== i)})} aria-label="Eliminar grupo">
                      ✕
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {categories.map((c) => (
                      <label key={c.slug} className="flex items-center gap-1.5 text-xs">
                        <input
                          type="checkbox"
                          className="accent-[var(--accent)]"
                          checked={g.categories.includes(c.slug)}
                          onChange={(e) =>
                            setGroup(i, {categories: e.target.checked ? [...g.categories, c.slug] : g.categories.filter((x) => x !== c.slug)})
                          }
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                  <Chips ids={g.articles} articles={byId} onRemove={(id) => setGroup(i, {articles: g.articles.filter((x) => x !== id)})} />
                  <ArticleAdder
                    articles={articles}
                    exclude={new Set(g.articles)}
                    placeholder="+ Añadir artículo concreto a este grupo…"
                    onAdd={(id) => setGroup(i, {articles: [...g.articles, id]})}
                  />
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="btn mt-3"
              onClick={() =>
                set({groups: [...cfg.groups, {id: `grupo-${Date.now().toString(36)}`, label: 'Nuevo grupo', color: '#94a3b8', categories: [], articles: []}]})
              }
            >
              + Grupo
            </button>
            <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
              <input type="color" aria-label="Color de otros" value={cfg.other_color} onChange={(e) => set({other_color: e.target.value})} className="h-8 w-10 cursor-pointer rounded border border-line bg-transparent" />
              <input className="input flex-1" value={cfg.other_label} onChange={(e) => set({other_label: e.target.value})} />
              <span className="w-8 text-right text-xs text-muted">{counts.get('otros') ?? 0}</span>
            </div>
            <p className="mt-1 text-xs text-muted">Artículos que no entran en ningún grupo.</p>
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Excluir del grafo</h2>
            <Chips ids={cfg.excluded_article_ids} articles={byId} onRemove={(id) => set({excluded_article_ids: cfg.excluded_article_ids.filter((x) => x !== id)})} />
            <ArticleAdder
              articles={articles}
              exclude={new Set(cfg.excluded_article_ids)}
              placeholder="+ Excluir artículo (p. ej. portadas)…"
              onAdd={(id) => set({excluded_article_ids: [...cfg.excluded_article_ids, id]})}
            />
          </section>

          <section className="card space-y-3 p-5">
            <h2 className="font-bold">Lo que verá el lector</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" checked={cfg.filters.groups !== false} onChange={(e) => set({filters: {...cfg.filters, groups: e.target.checked}})} />
              Filtro por grupos
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-[var(--accent)]" checked={cfg.filters.book !== false} onChange={(e) => set({filters: {...cfg.filters, book: e.target.checked}})} />
              Filtro por libro ({books.length} libros)
            </label>
            <div>
              <label className="label">Color inicial de los nodos</label>
              <select className="input" value={s.colorMode} onChange={(e) => set({settings: {...s, colorMode: e.target.value as 'grupo'}})}>
                <option value="grupo">Por grupo</option>
                <option value="libro">Por libro</option>
                <option value="comunidad">Por comunidad (automático)</option>
              </select>
            </div>
            {(
              [
                ['repulsion', 'Repulsión', 1, 40, 1],
                ['gravity', 'Gravedad', 0.05, 5, 0.05],
                ['labelThreshold', 'Umbral de etiquetas (menor = más)', 0, 18, 1],
              ] as const
            ).map(([k, label, min, max, step]) => (
              <label key={k} className="block text-sm">
                <span className="flex justify-between">
                  {label}
                  <span className="text-xs text-muted tabular-nums">{s[k]}</span>
                </span>
                <input type="range" className="w-full accent-[var(--accent)]" min={min} max={max} step={step} value={s[k]} onChange={(e) => set({settings: {...s, [k]: Number(e.target.value)}})} />
              </label>
            ))}
          </section>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="mb-2 flex items-center justify-between text-xs text-muted">
            <span>
              Vista previa · {preview.nodes.length} nodos · {preview.edges.length} conexiones
            </span>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" className="accent-[var(--accent)]" checked={drafts} onChange={(e) => setDrafts(e.target.checked)} />
              Incluir borradores
            </label>
          </div>
          <div className="card h-[72vh] overflow-hidden">
            <GraphPreview
              nodes={preview.nodes}
              edges={preview.edges}
              repulsion={s.repulsion ?? 10}
              gravity={s.gravity ?? 1}
              labelThreshold={s.labelThreshold ?? 9}
            />
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {preview.legend.map((l) => (
              <span key={l.id} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{background: l.color}} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
