import type {Category, Universe} from './types';
import {canonicalUrl, decodedPath} from './inline';

type ArticleLike = {slug: string; category_id: string | null; frontmatter: Record<string, unknown>};

/** Ruta del archivo dentro de docs/ (sin `docs/`). */
export function articleFilePath(a: ArticleLike, u: Universe, cat: Category | null | undefined): string {
  return [u.docs_dir, cat?.slug, `${a.slug}.mdx`].filter(Boolean).join('/');
}

/**
 * URL pública del artículo (sin baseUrl), con las reglas de Docusaurus:
 * `slug` del frontmatter manda; `index` se colapsa a su carpeta.
 */
export function articleRoute(a: ArticleLike, u: Universe, cat: Category | null | undefined): string {
  const base = `/${u.route_base}`;
  const fmSlug = typeof a.frontmatter.slug === 'string' ? a.frontmatter.slug : null;
  if (fmSlug) {
    if (fmSlug.startsWith('/')) return fmSlug === '/' ? base : `${base}${fmSlug.replace(/\/$/, '')}`;
    return [base, cat?.slug, fmSlug].filter(Boolean).join('/');
  }
  const parts = [cat?.slug, a.slug === 'index' ? null : a.slug].filter(Boolean);
  return parts.length ? `${base}/${parts.join('/')}` : base;
}

/** URL lista para usar en un enlace markdown dentro de un artículo. */
export function articleHref(a: ArticleLike, u: Universe, cat: Category | null | undefined): string {
  return canonicalUrl(articleRoute(a, u, cat));
}

/** Índice ruta-decodificada (minúsculas) → id de artículo, para resolver enlaces. */
export function buildRouteIndex(
  articles: (ArticleLike & {id: string; universe_id: string})[],
  universes: Universe[],
  categories: Category[],
): Map<string, string> {
  const uById = new Map(universes.map((u) => [u.id, u]));
  const cById = new Map(categories.map((c) => [c.id, c]));
  const index = new Map<string, string>();
  for (const a of articles) {
    const u = uById.get(a.universe_id);
    if (!u) continue;
    const cat = a.category_id ? cById.get(a.category_id) : null;
    index.set(decodedPath(articleRoute(a, u, cat)).toLowerCase(), a.id);
  }
  return index;
}

export function resolveLink(url: string, routeIndex: Map<string, string>): string | null {
  if (!url.startsWith('/')) return null;
  return routeIndex.get(decodedPath(url).toLowerCase()) ?? null;
}
