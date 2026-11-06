'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useRef, useState, useTransition} from 'react';
import {FrontmatterEditor} from '@/components/editor/frontmatter-editor';
import {InfoboxEditor} from '@/components/editor/infobox-editor';
import {StatusBadge} from '@/components/status-badge';
import type {Article, ArticleContent} from '@/lib/content/types';
import type {LinkTarget} from '@/lib/data/content-context';
import {
  type ActionResult,
  deleteArticle,
  publishArticle,
  renameArticle,
  restoreRevision,
  saveDraft,
  unpublishArticle,
} from '../actions';

// MDXEditor solo funciona en el navegador.
const MdxBodyEditor = dynamic(() => import('@/components/editor/mdx-body-editor'), {
  ssr: false,
  loading: () => <div className="card h-96 animate-pulse" />,
});

type Ref = {id: string; title: string; status: string};
type Tab = 'contenido' | 'ficha' | 'datos' | 'url';

const TABS: {id: Tab; label: string}[] = [
  {id: 'contenido', label: 'Contenido'},
  {id: 'ficha', label: 'Ficha'},
  {id: 'datos', label: 'Datos'},
  {id: 'url', label: 'URL y eliminar'},
];

export function ArticleEditor(props: {
  article: Article;
  route: string;
  universeLabel: string;
  categories: {id: string; label: string; slug: string}[];
  targets: LinkTarget[];
  books: {key: string; label: string}[];
  labelSuggestions: string[];
  outgoing: Ref[];
  incoming: Ref[];
  revisions: {id: number; note: string | null; created_at: string}[];
  siteUrl: string;
}) {
  const {article: a} = props;
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('contenido');
  const [content, setContent] = useState<ArticleContent>({
    title: a.title,
    description: a.description,
    frontmatter: a.frontmatter,
    infobox: a.infobox,
    body: a.body,
  });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [broken, setBroken] = useState<string[]>([]);
  const [notice, setNotice] = useState<{ok: boolean; text: string} | null>(null);
  const [pending, start] = useTransition();
  // Último contenido para el autoguardado (se actualiza tras cada render, no durante él).
  const latest = useRef(content);
  useEffect(() => {
    latest.current = content;
  }, [content]);

  const update = useCallback((patch: Partial<ArticleContent>) => {
    setContent((c) => ({...c, ...patch}));
    setDirty(true);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    setSaving(true);
    const r = await saveDraft(a.id, latest.current);
    setSaving(false);
    if (r.ok) {
      setDirty(false);
      setSavedAt(r.savedAt ?? null);
      setBroken(r.broken ?? []);
    } else setNotice({ok: false, text: r.error});
    return r.ok;
  }, [a.id]);

  // Autoguardado del borrador 1,5 s después del último cambio.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => void save(), 1500);
    return () => clearTimeout(t);
  }, [content, dirty, save]);

  // Aviso al salir con cambios sin guardar.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [dirty]);

  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      if (dirty && !(await save())) return;
      const r = await fn();
      setNotice(r.ok ? {ok: true, text: r.message ?? 'Hecho.'} : {ok: false, text: r.error});
      if (r.ok && r.broken) setBroken(r.broken);
      router.refresh();
    });

  const liveUrl = props.siteUrl ? `${props.siteUrl}${props.route}` : null;

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href="/articulos" className="text-xs text-muted hover:text-accent">
            ← Artículos · {props.universeLabel}
          </Link>
          <input
            className="mt-1 w-full bg-transparent text-2xl font-bold outline-none focus:ring-0"
            value={content.title}
            onChange={(e) => update({title: e.target.value})}
            aria-label="Título"
          />
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
            <StatusBadge status={a.status} />
            <span className="font-mono">{decodeURI(props.route)}</span>
            <span aria-live="polite">
              {saving ? 'Guardando…' : dirty ? 'Cambios sin guardar' : savedAt ? `Borrador guardado ${new Date(savedAt).toLocaleTimeString('es')}` : ''}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {liveUrl && a.status === 'publicado' ? (
            <a className="btn" href={liveUrl} target="_blank" rel="noreferrer">
              Ver en el sitio ↗
            </a>
          ) : null}
          <button type="button" className="btn" disabled={saving || !dirty} onClick={() => void save()}>
            Guardar borrador
          </button>
          {a.status === 'publicado' ? (
            <button type="button" className="btn" disabled={pending} onClick={() => run(() => unpublishArticle(a.id))}>
              Despublicar
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" disabled={pending} onClick={() => run(() => publishArticle(a.id))}>
            {a.status === 'publicado' ? 'Publicar cambios' : 'Publicar'}
          </button>
        </div>
      </div>

      {notice ? (
        <p role="status" className={`rounded-lg border px-3 py-2 text-sm ${notice.ok ? 'border-ok/40 bg-ok/10' : 'border-danger/40 bg-danger/10'}`}>
          {notice.text}
          {notice.ok && a.status === 'publicado' ? (
            <>
              {' '}
              <Link href="/desplegar" className="font-semibold text-accent">
                Desplegar al sitio →
              </Link>
            </>
          ) : null}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_260px]">
        <div className="min-w-0">
          <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold ${tab === t.id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* El editor de cuerpo se mantiene montado para no perder el historial de deshacer. */}
          <div hidden={tab !== 'contenido'}>
            <MdxBodyEditor markdown={a.body} onChange={(body) => update({body})} targets={props.targets} />
          </div>
          {tab === 'ficha' ? (
            <InfoboxEditor
              value={content.infobox}
              onChange={(infobox) => update({infobox})}
              targets={props.targets}
              labelSuggestions={props.labelSuggestions}
            />
          ) : null}
          {tab === 'datos' ? (
            <FrontmatterEditor
              description={content.description ?? ''}
              onDescription={(description) => update({description})}
              value={content.frontmatter}
              onChange={(frontmatter) => update({frontmatter})}
              books={props.books}
            />
          ) : null}
          {tab === 'url' ? <UrlPanel {...props} onResult={(r) => setNotice(r.ok ? {ok: true, text: r.message ?? ''} : {ok: false, text: r.error})} /> : null}
        </div>

        {/* Panel lateral */}
        <aside className="space-y-4 text-sm">
          {broken.length ? (
            <section className="card border-danger/40 p-4">
              <h3 className="mb-2 font-bold text-danger">Enlaces rotos ({broken.length})</h3>
              <ul className="space-y-1 font-mono text-xs">
                {broken.map((u) => (
                  <li key={u} className="break-all">
                    {decodeURI(u)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <RefList title="Enlaza a" refs={props.outgoing} />
          <RefList title="Enlazado desde" refs={props.incoming} />
          <section className="card p-4">
            <h3 className="mb-2 font-bold">Historial</h3>
            {props.revisions.length ? (
              <ul className="space-y-1.5">
                {props.revisions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2">
                    <span className="text-xs">
                      {r.note ?? 'Revisión'} · {new Date(r.created_at).toLocaleString('es')}
                    </span>
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-0.5 text-xs"
                      onClick={() => {
                        if (confirm('¿Restaurar esta versión en el borrador?')) run(() => restoreRevision(a.id, r.id));
                      }}
                    >
                      Restaurar
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted">Aún no hay publicaciones registradas.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function RefList({title, refs}: {title: string; refs: Ref[]}) {
  return (
    <section className="card p-4">
      <h3 className="mb-2 font-bold">
        {title} <span className="font-normal text-muted">({refs.length})</span>
      </h3>
      {refs.length ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {refs.map((r) => (
            <li key={r.id}>
              <Link href={`/articulos/${r.id}`} className="hover:text-accent">
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted">Ninguno.</p>
      )}
    </section>
  );
}

function UrlPanel(props: {
  article: Article;
  route: string;
  categories: {id: string; label: string}[];
  incoming: Ref[];
  onResult: (r: ActionResult) => void;
}) {
  const {article: a} = props;
  const router = useRouter();
  const [slug, setSlug] = useState(a.slug);
  const [cat, setCat] = useState(a.category_id ?? '');
  const [pending, start] = useTransition();

  return (
    <div className="space-y-5">
      <div className="card space-y-4 p-5">
        <h3 className="font-bold">Dirección del artículo</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="">(Raíz del universo)</option>
              {props.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Nombre de archivo</label>
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
        </div>
        <p className="text-xs text-muted">
          Al cambiarla, los enlaces de los {props.incoming.length} artículo(s) que apuntan aquí se actualizan solos.
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={pending || (slug === a.slug && cat === (a.category_id ?? ''))}
          onClick={() =>
            start(async () => {
              const r = await renameArticle(a.id, slug, cat || null);
              props.onResult(r);
              router.refresh();
            })
          }
        >
          Cambiar dirección
        </button>
      </div>

      <div className="card border-danger/40 space-y-3 p-5">
        <h3 className="font-bold text-danger">Eliminar artículo</h3>
        <p className="text-sm text-muted">
          {props.incoming.length
            ? `Atención: ${props.incoming.length} artículo(s) enlazan aquí y quedarían con enlaces rotos. Considera despublicar en su lugar.`
            : 'Ningún artículo enlaza aquí.'}
        </p>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`¿Eliminar «${a.title}» definitivamente? No se puede deshacer.`)) start(async () => void (await deleteArticle(a.id)));
          }}
        >
          Eliminar definitivamente
        </button>
      </div>
    </div>
  );
}
