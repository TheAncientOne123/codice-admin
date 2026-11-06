import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import type {Category, Universe} from '@/lib/content/types';
import {NewUniverseForm, UniverseCard} from './universe-forms';

export const metadata = {title: 'Universos'};

export default function UniversesPage() {
  return (
    <>
      <PageHeader
        title="Universos"
        description="Qué proyectos se ven en El Códice, en qué orden y con qué categorías."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Universes />
      </Suspense>
    </>
  );
}

async function Universes() {
  const {supabase} = await requireAdmin();
  const [{data: universes}, {data: categories}, {data: articles}] = await Promise.all([
    supabase.from('universes').select('*').order('sort_order'),
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('articles').select('universe_id, category_id, status'),
  ]);
  const count = (uid: string, cid?: string) =>
    (articles ?? []).filter((a) => a.universe_id === uid && (cid === undefined || a.category_id === cid) && a.status === 'publicado').length;

  return (
    <div className="space-y-5">
      {(universes as Universe[] | null ?? []).map((u, i, all) => (
        <UniverseCard
          key={u.id}
          universe={u}
          first={i === 0}
          last={i === all.length - 1}
          published={count(u.id)}
          categories={((categories ?? []) as Category[])
            .filter((c) => c.universe_id === u.id)
            .map((c) => ({...c, published: count(u.id, c.id)}))}
        />
      ))}
      <NewUniverseForm />
    </div>
  );
}
