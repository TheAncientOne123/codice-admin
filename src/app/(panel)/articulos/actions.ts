'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireAdmin} from '@/lib/auth';
import {INFOBOX_MARKER, type Article, type ArticleContent} from '@/lib/content/types';
import {
  buildSnapshot,
  contentOf,
  replaceLinks,
  resolveContentLinks,
  rewriteContent,
  routeKey,
} from '@/lib/data/articles';
import {logChange} from '@/lib/data/changes';
import {loadContentContext} from '@/lib/data/content-context';

export type ActionResult = {ok: true; message?: string; broken?: string[]; savedAt?: string} | {ok: false; error: string};

async function getArticle(db: Awaited<ReturnType<typeof requireAdmin>>['supabase'], id: string) {
  const {data, error} = await db.from('articles').select('*').eq('id', id).single();
  if (error || !data) throw new Error('Artículo no encontrado');
  return data as Article;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

const SLUG_RE = /^[^/\\?#%<>"|*:]+$/;

// ─────────────────────────── Guardar borrador ───────────────────────────
export async function saveDraft(id: string, content: ArticleContent): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  if (!content.title.trim()) return {ok: false, error: 'El título no puede estar vacío.'};
  if (content.infobox?.placement === 'marcador' && !content.body.includes(INFOBOX_MARKER)) {
    content = {...content, infobox: {...content.infobox, placement: 'tras-titulo'}};
  }
  const {error} = await supabase
    .from('articles')
    .update({
      title: content.title.trim(),
      description: content.description?.trim() || null,
      frontmatter: content.frontmatter,
      infobox: content.infobox,
      body: content.body,
    })
    .eq('id', id);
  if (error) return {ok: false, error: error.message};

  const ctx = await loadContentContext(supabase);
  const {ids, broken} = resolveContentLinks(content, ctx, id);
  await replaceLinks(supabase, id, ids, 'draft');
  return {ok: true, broken, savedAt: new Date().toISOString()};
}

// ─────────────────────────── Publicar / despublicar ───────────────────────────
export async function publishArticle(id: string): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  const a = await getArticle(supabase, id);
  const ctx = await loadContentContext(supabase);

  // Convención del sitio: `updated` refleja la última publicación (si el artículo usa esa clave).
  const frontmatter = 'updated' in a.frontmatter ? {...a.frontmatter, updated: today()} : a.frontmatter;
  const content = {...contentOf(a), frontmatter};
  const snapshot = buildSnapshot(a, content, ctx);
  const {ids, broken} = resolveContentLinks(content, ctx, id);

  const {error} = await supabase
    .from('articles')
    .update({frontmatter, status: 'publicado', published: snapshot, published_at: new Date().toISOString()})
    .eq('id', id);
  if (error) return {ok: false, error: error.message};
  await supabase.from('article_revisions').insert({article_id: id, snapshot, note: 'Publicado'});
  await replaceLinks(supabase, id, ids, 'published');
  await logChange(supabase, 'articulo', `Publicado: ${a.title}`, id);
  revalidatePath('/articulos');
  return {ok: true, broken, message: broken.length ? `Publicado con ${broken.length} enlace(s) roto(s).` : 'Publicado.'};
}

export async function unpublishArticle(id: string): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  const a = await getArticle(supabase, id);
  const {error} = await supabase.from('articles').update({status: 'despublicado'}).eq('id', id);
  if (error) return {ok: false, error: error.message};
  await replaceLinks(supabase, id, [], 'published');
  await logChange(supabase, 'articulo', `Despublicado: ${a.title}`, id);
  revalidatePath('/articulos');
  return {ok: true, message: 'Despublicado. Desaparecerá del sitio en el próximo despliegue.'};
}

export async function bulkSetStatus(ids: string[], action: 'publicar' | 'despublicar'): Promise<ActionResult> {
  await requireAdmin();
  let failed = 0;
  for (const id of ids) {
    const r = action === 'publicar' ? await publishArticle(id) : await unpublishArticle(id);
    if (!r.ok) failed++;
  }
  revalidatePath('/articulos');
  return failed ? {ok: false, error: `${failed} artículo(s) fallaron.`} : {ok: true, message: `${ids.length} artículo(s) actualizados.`};
}

// ─────────────────────────── Crear / eliminar ───────────────────────────
export async function createArticle(_prev: ActionResult | null, form: FormData): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  const universe_id = String(form.get('universe_id') ?? '');
  const category_id = String(form.get('category_id') ?? '') || null;
  const title = String(form.get('title') ?? '').trim();
  const slug = (String(form.get('slug') ?? '').trim() || title).replace(/\s+/g, ' ');
  if (!universe_id || !title) return {ok: false, error: 'Elige universo y escribe un título.'};
  if (!SLUG_RE.test(slug)) return {ok: false, error: 'El nombre de archivo tiene caracteres no permitidos (/ \\ ? # % < > " | * :).'};

  const {data, error} = await supabase
    .from('articles')
    .insert({universe_id, category_id, slug, title, body: `# ${title}\n\n`, status: 'borrador'})
    .select('id')
    .single();
  if (error) {
    return {ok: false, error: error.code === '23505' ? 'Ya existe un artículo con ese nombre en esa categoría.' : error.message};
  }
  redirect(`/articulos/${data.id}`);
}

export async function deleteArticle(id: string): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  const a = await getArticle(supabase, id);
  const {error} = await supabase.from('articles').delete().eq('id', id);
  if (error) return {ok: false, error: error.message};
  if (a.status === 'publicado') await logChange(supabase, 'articulo', `Eliminado: ${a.title}`, id);
  revalidatePath('/articulos');
  redirect('/articulos');
}

// ─────────────────────────── Renombrar / mover ───────────────────────────
/**
 * Cambia el nombre de archivo o la categoría (= la URL) y reescribe los enlaces
 * de todos los artículos que apuntaban a la ruta anterior, en borrador y en publicado.
 */
export async function renameArticle(id: string, slug: string, categoryId: string | null): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  slug = slug.trim().replace(/\s+/g, ' ');
  if (!slug || !SLUG_RE.test(slug)) return {ok: false, error: 'Nombre de archivo no válido.'};
  const a = await getArticle(supabase, id);
  if (a.slug === slug && a.category_id === categoryId) return {ok: true, message: 'Sin cambios.'};

  const before = await loadContentContext(supabase);
  const oldRoute = routeKey(before.routeOf(a));

  const {error} = await supabase.from('articles').update({slug, category_id: categoryId}).eq('id', id);
  if (error) return {ok: false, error: error.code === '23505' ? 'Ya existe un artículo con ese nombre ahí.' : error.message};

  const ctx = await loadContentContext(supabase);
  const moved = {...a, slug, category_id: categoryId};
  const newHref = ctx.hrefOf(moved);

  // Artículos que enlazan al renombrado (cualquier alcance).
  const {data: incoming} = await supabase.from('article_links').select('from_id').eq('to_id', id);
  const sources = [...new Set((incoming ?? []).map((l) => l.from_id as string))];
  let touched = 0;
  for (const srcId of sources) {
    const src = await getArticle(supabase, srcId);
    const draft = rewriteContent(contentOf(src), oldRoute, newHref);
    const patch: Record<string, unknown> = {body: draft.body, infobox: draft.infobox};
    if (src.published && src.status === 'publicado') {
      const pub = rewriteContent(src.published, oldRoute, newHref);
      patch.published = buildSnapshot(src, pub, ctx);
    }
    await supabase.from('articles').update(patch).eq('id', srcId);
    touched++;
  }

  // El propio artículo publicado cambia de ruta de archivo.
  if (a.published && a.status === 'publicado') {
    await supabase.from('articles').update({published: buildSnapshot(moved, a.published, ctx)}).eq('id', id);
    await logChange(supabase, 'articulo', `Renombrado: ${a.title} → ${newHref}`, id);
  }
  revalidatePath('/articulos');
  return {ok: true, message: `Ruta nueva: ${newHref}. Enlaces actualizados en ${touched} artículo(s).`};
}

// ─────────────────────────── Revisiones ───────────────────────────
export async function restoreRevision(articleId: string, revisionId: number): Promise<ActionResult> {
  const {supabase} = await requireAdmin();
  const {data: rev} = await supabase.from('article_revisions').select('snapshot').eq('id', revisionId).eq('article_id', articleId).single();
  if (!rev) return {ok: false, error: 'Revisión no encontrada.'};
  const s = rev.snapshot as ArticleContent;
  const {error} = await supabase
    .from('articles')
    .update({title: s.title, description: s.description, frontmatter: s.frontmatter, infobox: s.infobox, body: s.body})
    .eq('id', articleId);
  if (error) return {ok: false, error: error.message};
  revalidatePath(`/articulos/${articleId}`);
  return {ok: true, message: 'Revisión restaurada en el borrador (publica para aplicarla al sitio).'};
}
