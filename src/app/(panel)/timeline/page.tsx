import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import type {EntryRow, LaneRow} from './actions';
import {TimelineEditor} from './timeline-editor';

export const metadata = {title: 'Timeline'};

export default function TimelinePage() {
  return (
    <>
      <PageHeader title="Timeline" description="Cronología de la portada: escritura, publicaciones y proyectos futuros." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  const {supabase} = await requireAdmin();
  const [{data: lanes}, {data: entries}, {data: universes}] = await Promise.all([
    supabase.from('timeline_lanes').select('id, label, color, href, universe_id').order('sort_order'),
    supabase.from('timeline_entries').select('*').order('sort_order'),
    supabase.from('universes').select('id, label, route_base').order('sort_order'),
  ]);
  return (
    <TimelineEditor
      initialLanes={(lanes ?? []) as LaneRow[]}
      initialEntries={((entries ?? []) as (EntryRow & {sort_order: number})[]).map(({sort_order: _s, ...e}) => e)}
      universes={universes ?? []}
    />
  );
}
