import Link from 'next/link';
import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {pendingChanges, recentDeploys} from '@/lib/data/changes';

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Panel" description="Resumen del contenido de El Códice." />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Dashboard />
      </Suspense>
    </>
  );
}

const STATUS_LABEL = {publicado: 'Publicados', borrador: 'Borradores', despublicado: 'Despublicados'} as const;

async function Dashboard() {
  const {supabase} = await requireAdmin();
  const [{data: articles}, {data: universes}, pending, deploys] = await Promise.all([
    supabase.from('articles').select('id, status, universe_id, updated_at, published_at'),
    supabase.from('universes').select('id, label, visibility').order('sort_order'),
    pendingChanges(supabase),
    recentDeploys(supabase, 1),
  ]);
  const rows = articles ?? [];
  const byStatus = (s: keyof typeof STATUS_LABEL) => rows.filter((a) => a.status === s).length;
  const unpublishedEdits = rows.filter(
    (a) => a.status === 'publicado' && a.published_at && new Date(a.updated_at) > new Date(a.published_at),
  ).length;
  const last = deploys[0];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
          <Link key={s} href={`/articulos?estado=${s}`} className="card p-4 transition-colors hover:border-accent">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">{STATUS_LABEL[s]}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{byStatus(s)}</p>
          </Link>
        ))}
        <Link href="/articulos?cambios=1" className="card p-4 transition-colors hover:border-accent">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ediciones sin publicar</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{unpublishedEdits}</p>
        </Link>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Cambios pendientes de desplegar</h2>
            <Link href="/desplegar" className="btn btn-primary">
              Desplegar
            </Link>
          </div>
          {pending.length ? (
            <ul className="space-y-1.5 text-sm">
              {pending.slice(0, 8).map((c) => (
                <li key={c.id} className="flex justify-between gap-3">
                  <span className="truncate">{c.label}</span>
                  <time className="shrink-0 text-xs text-muted">{new Date(c.created_at).toLocaleString('es')}</time>
                </li>
              ))}
              {pending.length > 8 ? <li className="text-xs text-muted">y {pending.length - 8} más…</li> : null}
            </ul>
          ) : (
            <p className="text-sm text-muted">El sitio está al día.</p>
          )}
          {last ? (
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              Último despliegue: {new Date(last.requested_at).toLocaleString('es')} · {last.status}
            </p>
          ) : null}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold">Universos</h2>
          <ul className="divide-y divide-line text-sm">
            {(universes ?? []).map((u) => (
              <li key={u.id} className="flex items-center justify-between py-2">
                <Link href={`/articulos?universo=${u.id}`} className="hover:text-accent">
                  {u.label}
                </Link>
                <span className="chip text-muted">{u.visibility}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
