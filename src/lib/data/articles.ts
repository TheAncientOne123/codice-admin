import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import {canonicalUrl, decodedPath} from '@/lib/content/inline';
import {articleFilePath, resolveLink} from '@/lib/content/paths';
import {extractLinkUrls, renderMdx} from '@/lib/content/render';
import type {Article, ArticleContent, Infobox, PublishedSnapshot} from '@/lib/content/types';
import type {ContentContext} from './content-context';

export function contentOf(a: Pick<Article, 'title' | 'description' | 'frontmatter' | 'infobox' | 'body'>): ArticleContent {
  return {title: a.title, description: a.description, frontmatter: a.frontmatter, infobox: a.infobox, body: a.body};
}

/** Enlaces resueltos de un contenido + los que no resuelven (rotos). */
export function resolveContentLinks(content: Pick<ArticleContent, 'body' | 'infobox'>, ctx: ContentContext, selfId: string) {
  const ids = new Set<string>();
  const broken: string[] = [];
  for (const url of extractLinkUrls(content)) {
    if (!url.startsWith('/')) continue;
    const id = resolveLink(url, ctx.routeIndex);
    if (!id) broken.push(url);
    else if (id !== selfId) ids.add(id);
  }
  return {ids: [...ids], broken};
}

export async function replaceLinks(db: SupabaseClient, fromId: string, toIds: string[], scope: 'draft' | 'published') {
  await db.from('article_links').delete().eq('from_id', fromId).eq('scope', scope);
  if (toIds.length) {
    const {error} = await db.from('article_links').insert(toIds.map((to_id) => ({from_id: fromId, to_id, scope})));
    if (error) throw new Error(error.message);
  }
}

export function buildSnapshot(a: Article, content: ArticleContent, ctx: ContentContext): PublishedSnapshot {
  const u = ctx.uById.get(a.universe_id)!;
  const cat = a.category_id ? ctx.cById.get(a.category_id) : null;
  return {...content, path: articleFilePath(a, u, cat), mdx: renderMdx(content)};
}

// ─────────────────────────── Reescritura de enlaces al renombrar ───────────────────────────

const MD_LINK = /\]\(\s*(<[^>]+>|[^)\s]+)\s*\)/g;
const JSX_LINK = /(<Link[^>]*\sto=)(["'])([^"']+)\2/g;

function rewriteText(text: string, oldRoute: string, newHref: string): string {
  const matches = (url: string) => decodedPath(url.replace(/^<|>$/g, '')).toLowerCase() === oldRoute;
  return text
    .replace(MD_LINK, (m, url: string) => (matches(url) ? m.replace(url, newHref) : m))
    .replace(JSX_LINK, (m, pre: string, q: string, url: string) => (matches(url) ? `${pre}${q}${newHref}${q}` : m));
}

function rewriteInfobox(box: Infobox | null, oldRoute: string, newHref: string): Infobox | null {
  if (!box) return box;
  return {...box, rows: box.rows.map((r) => ({...r, value: rewriteText(r.value, oldRoute, newHref)}))};
}

export function rewriteContent<T extends Pick<ArticleContent, 'body' | 'infobox'>>(c: T, oldRoute: string, newHref: string): T {
  return {...c, body: rewriteText(c.body, oldRoute, newHref), infobox: rewriteInfobox(c.infobox, oldRoute, newHref)};
}

/** Ruta "antigua" normalizada para comparar. */
export function routeKey(route: string): string {
  return decodedPath(route).toLowerCase();
}

export {canonicalUrl};
