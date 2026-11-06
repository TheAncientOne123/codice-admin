import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {SidebarEditor} from './sidebar-editor';

export const metadata = {title: 'Sidebar'};

export default function SidebarPage() {
  return (
    <>
      <PageHeader title="Sidebar" description="Orden y contenido de la barra lateral de cada universo. Arrastra para reordenar." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  const {supabase} = await requireAdmin();
  const [{data: universes}, {data: items}, {data: articles}, {data: categories}, {data: graphs}] = await Promise.all([
    supabase.from('universes').select('id, label').order('sort_order'),
    supabase.from('sidebar_items').select('*').order('sort_order'),
    supabase.from('articles').select('id, universe_id, category_id, title, status, is_landing').order('title'),
    supabase.from('categories').select('id, label'),
    supabase.from('graph_configs').select('universe_id, enabled'),
  ]);
  const catLabel = new Map((categories ?? []).map((c) => [c.id, c.label as string]));
  return (
    <SidebarEditor
      universes={(universes ?? []).map((u) => ({
        id: u.id,
        label: u.label,
        graphEnabled: !!graphs?.find((g) => g.universe_id === u.id && g.enabled),
        items: (items ?? [])
          .filter((i) => i.universe_id === u.id)
          .map((i) => ({key: i.id, kind: i.kind, article_id: i.article_id, label: i.label, href: i.href})),
        articles: (articles ?? [])
          .filter((a) => a.universe_id === u.id)
          .sort((a, b) => Number(b.is_landing) - Number(a.is_landing))
          .map((a) => ({id: a.id, title: a.title, status: a.status, category: a.category_id ? catLabel.get(a.category_id) ?? '' : 'raíz', landing: a.is_landing})),
      }))}
    />
  );
}
