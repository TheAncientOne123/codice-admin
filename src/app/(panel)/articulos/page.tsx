import Link from 'next/link';
import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {loadContentContext} from '@/lib/data/content-context';
import {ArticleTable, type ArticleRow} from './article-table';

export const metadata = {title: 'Artículos'};

export default function ArticlesPage({searchParams}: PageProps<'/articulos'>) {
  return (
    <>
      <PageHeader
        title="Artículos"
        description="Todas las fichas de El Códice. Edita, publica o despublica."
        actions={
          <Link href="/articulos/nuevo" className="btn btn-primary">
            Nuevo artículo
          </Link>
        }
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <ArticleList searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ArticleList({searchParams}: {searchParams: PageProps<'/articulos'>['searchParams']}) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? '';
  const {supabase} = await requireAdmin();
  const ctx = await loadContentContext(supabase);
  const {data} = await supabase
    .from('articles')
    .select('id, universe_id, category_id, slug, title, status, frontmatter, updated_at, published_at, is_landing')
    .order('title');

  const rows: ArticleRow[] = (data ?? []).map((a) => ({
    id: a.id,
    title: a.title,
    universeId: a.universe_id,
    universe: ctx.uById.get(a.universe_id)?.label ?? '',
    categoryId: a.category_id,
    category: a.category_id ? ctx.cById.get(a.category_id)?.label ?? '' : 'Raíz',
    route: ctx.routeOf(a),
    status: a.status,
    isLanding: a.is_landing,
    updatedAt: a.updated_at,
    hasUnpublishedEdits:
      a.status === 'publicado' && !!a.published_at && new Date(a.updated_at).getTime() - new Date(a.published_at).getTime() > 2000,
  }));

  return (
    <ArticleTable
      rows={rows}
      universes={ctx.universes.map((u) => ({id: u.id, label: u.label}))}
      categories={ctx.categories.map((c) => ({id: c.id, label: c.label, universeId: c.universe_id}))}
      initial={{universo: one('universo'), categoria: one('categoria'), estado: one('estado'), q: one('q'), cambios: one('cambios') === '1'}}
    />
  );
}
