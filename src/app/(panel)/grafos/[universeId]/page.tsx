import {notFound} from 'next/navigation';
import {Suspense} from 'react';
import {Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import type {GraphArticle, GraphConfig} from '@/lib/content/graph';
import {loadContentContext} from '@/lib/data/content-context';
import {GraphEditor} from './graph-editor';

export const metadata = {title: 'Editar grafo'};

export default function GraphEditorPage({params}: PageProps<'/grafos/[universeId]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh]" />}>
      <Data params={params} />
    </Suspense>
  );
}

async function Data({params}: {params: PageProps<'/grafos/[universeId]'>['params']}) {
  const {universeId} = await params;
  const {supabase} = await requireAdmin();
  const [{data: cfg}, ctx, {data: links}, {data: books}, {data: full}] = await Promise.all([
    supabase.from('graph_configs').select('*').eq('universe_id', universeId).maybeSingle(),
    loadContentContext(supabase),
    supabase.from('article_links').select('from_id, to_id, scope'),
    supabase.from('books').select('key, label, color').order('sort_order'),
    supabase.from('articles').select('id, description, infobox').eq('universe_id', universeId),
  ]);
  const universe = ctx.uById.get(universeId);
  if (!cfg || !universe) notFound();

  const extra = new Map((full ?? []).map((a) => [a.id, a]));
  const articles: (GraphArticle & {status: string})[] = ctx.articles
    .filter((a) => a.universe_id === universeId)
    .map((a) => {
      const cat = a.category_id ? ctx.cById.get(a.category_id) : null;
      const box = extra.get(a.id)?.infobox as {image?: {src: string}; images?: {src: string}[]} | null;
      return {
        id: a.id,
        title: a.title,
        categorySlug: cat?.slug ?? null,
        libro: typeof a.frontmatter.libro === 'string' ? a.frontmatter.libro : null,
        route: ctx.routeOf(a),
        docId: [cat?.slug, a.slug].filter(Boolean).join('/'),
        status: a.status,
        image: box?.images?.[0]?.src ?? box?.image?.src,
      };
    });

  return (
    <GraphEditor
      universe={{id: universe.id, label: universe.label}}
      config={cfg as GraphConfig}
      articles={articles}
      categories={ctx.categories.filter((c) => c.universe_id === universeId).map((c) => ({slug: c.slug, label: c.label}))}
      links={(links ?? []) as {from_id: string; to_id: string; scope: 'draft' | 'published'}[]}
      books={books ?? []}
    />
  );
}
