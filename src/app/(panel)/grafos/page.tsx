import Link from 'next/link';
import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {GraphToggle} from './graph-toggle';

export const metadata = {title: 'Grafos'};

export default function GraphsPage() {
  return (
    <>
      <PageHeader
        title="Grafos"
        description="Cada universo puede tener una página de grafo. Los enlaces se calculan solos a partir de los artículos, como en Obsidian."
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <List />
      </Suspense>
    </>
  );
}

async function List() {
  const {supabase} = await requireAdmin();
  const [{data: universes}, {data: configs}] = await Promise.all([
    supabase.from('universes').select('id, label, route_base').order('sort_order'),
    supabase.from('graph_configs').select('universe_id, enabled, route_slug, groups'),
  ]);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(universes ?? []).map((u) => {
        const cfg = configs?.find((c) => c.universe_id === u.id);
        return (
          <section key={u.id} className="card flex flex-col gap-4 p-5">
            <div>
              <h2 className="font-bold">{u.label}</h2>
              {cfg?.enabled ? (
                <p className="font-mono text-xs text-muted">/grafos/{cfg.route_slug}</p>
              ) : (
                <p className="text-xs text-muted">Sin página de grafo</p>
              )}
            </div>
            <GraphToggle universeId={u.id} enabled={!!cfg?.enabled} />
            {cfg?.enabled ? (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{(cfg.groups as unknown[]).length} grupos de color</span>
                <Link href={`/grafos/${u.id}`} className="btn btn-primary">
                  Editar grafo
                </Link>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
