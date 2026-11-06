import {notFound} from 'next/navigation';
import {Suspense} from 'react';
import {Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import type {Article} from '@/lib/content/types';
import {linkTargets, loadContentContext} from '@/lib/data/content-context';
import {ArticleEditor} from './article-editor';

export const metadata = {title: 'Editar artículo'};

export default function EditArticlePage({params}: PageProps<'/articulos/[id]'>) {
  return (
    <Suspense fallback={<Skeleton className="h-[70vh]" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({params}: {params: PageProps<'/articulos/[id]'>['params']}) {
  const {id} = await params;
  const {supabase} = await requireAdmin();
  const {data} = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const article = data as Article;

  const [ctx, {data: books}, {data: boxes}, {data: outLinks}, {data: inLinks}, {data: revisions}] = await Promise.all([
    loadContentContext(supabase),
    supabase.from('books').select('key, label').order('sort_order'),
    supabase.from('articles').select('infobox').not('infobox', 'is', null),
    supabase.from('article_links').select('to_id').eq('from_id', id).eq('scope', 'draft'),
    supabase.from('article_links').select('from_id').eq('to_id', id).eq('scope', 'draft'),
    supabase.from('article_revisions').select('id, note, created_at').eq('article_id', id).order('created_at', {ascending: false}).limit(15),
  ]);

  const labelCount = new Map<string, number>();
  for (const b of boxes ?? []) for (const r of (b.infobox as Article['infobox'])?.rows ?? []) labelCount.set(r.label, (labelCount.get(r.label) ?? 0) + 1);
  const labelSuggestions = [...labelCount.entries()].sort((a, b) => b[1] - a[1]).map(([l]) => l);

  const byId = new Map(ctx.articles.map((a) => [a.id, a]));
  const ref = (aid: string) => {
    const a = byId.get(aid);
    return a ? {id: a.id, title: a.title, status: a.status} : null;
  };

  return (
    <ArticleEditor
      // Si el servidor cambia el artículo (publicar, restaurar, renombrar) el editor se reinicia con esos datos.
      key={article.updated_at}
      article={article}
      route={ctx.routeOf(article)}
      universeLabel={ctx.uById.get(article.universe_id)?.label ?? ''}
      categories={ctx.categories.filter((c) => c.universe_id === article.universe_id).map((c) => ({id: c.id, label: c.label, slug: c.slug}))}
      targets={linkTargets(ctx)}
      books={books ?? []}
      labelSuggestions={labelSuggestions}
      outgoing={(outLinks ?? []).map((l) => ref(l.to_id)).filter((x) => x !== null)}
      incoming={(inLinks ?? []).map((l) => ref(l.from_id)).filter((x) => x !== null)}
      revisions={revisions ?? []}
      siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ''}
    />
  );
}
