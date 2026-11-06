import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {articleHref, articleRoute, buildRouteIndex} from '@/lib/content/paths';
import type {Category, Universe} from '@/lib/content/types';

export type ArticleRef = {
  id: string;
  universe_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  status: string;
  frontmatter: Record<string, unknown>;
};

/** Todo lo necesario para resolver rutas y enlaces entre artículos. */
export async function loadContentContext(db: SupabaseClient) {
  const [{data: universes}, {data: categories}, {data: articles}] = await Promise.all([
    db.from('universes').select('*').order('sort_order'),
    db.from('categories').select('*').order('sort_order'),
    db.from('articles').select('id, universe_id, category_id, slug, title, status, frontmatter'),
  ]);
  const U = (universes ?? []) as Universe[];
  const C = (categories ?? []) as Category[];
  const A = (articles ?? []) as ArticleRef[];
  const uById = new Map(U.map((u) => [u.id, u]));
  const cById = new Map(C.map((c) => [c.id, c]));
  const routeIndex = buildRouteIndex(A, U, C);

  const hrefOf = (a: Pick<ArticleRef, 'slug' | 'category_id' | 'frontmatter' | 'universe_id'>) =>
    articleHref(a, uById.get(a.universe_id)!, a.category_id ? cById.get(a.category_id) : null);
  const routeOf = (a: Pick<ArticleRef, 'slug' | 'category_id' | 'frontmatter' | 'universe_id'>) =>
    articleRoute(a, uById.get(a.universe_id)!, a.category_id ? cById.get(a.category_id) : null);

  return {universes: U, categories: C, articles: A, uById, cById, routeIndex, hrefOf, routeOf};
}

export type ContentContext = Awaited<ReturnType<typeof loadContentContext>>;

/** Lista ligera para el selector de enlaces del editor. */
export function linkTargets(ctx: ContentContext) {
  return ctx.articles
    .map((a) => ({
      id: a.id,
      title: a.title,
      href: ctx.hrefOf(a),
      universe: ctx.uById.get(a.universe_id)?.label ?? '',
      category: a.category_id ? ctx.cById.get(a.category_id)?.label ?? '' : '',
      status: a.status,
    }))
    .sort((x, y) => x.title.localeCompare(y.title, 'es'));
}

export type LinkTarget = ReturnType<typeof linkTargets>[number];
