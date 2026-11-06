'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import {logChange} from '@/lib/data/changes';

export type BookResult = {ok: true; message?: string} | {ok: false; error: string};

const KEY = /^[a-z0-9-]+$/;

function fields(form: FormData) {
  const str = (k: string) => String(form.get(k) ?? '').trim() || null;
  return {
    key: String(form.get('key') ?? '').trim(),
    label: String(form.get('label') ?? '').trim(),
    color: String(form.get('color') ?? '#94a3b8'),
    universe_id: str('universe_id'),
    article_id: str('article_id'),
    cover: str('cover'),
    tagline: str('tagline'),
    year: str('year'),
    synopsis: str('synopsis'),
    buy_url: str('buy_url'),
    published: form.get('published') === 'on',
    in_store: form.get('in_store') === 'on',
  };
}

export async function saveBook(id: string | null, form: FormData): Promise<BookResult> {
  const {supabase} = await requireAdmin();
  const f = fields(form);
  if (!f.label) return {ok: false, error: 'El libro necesita título.'};
  if (!KEY.test(f.key)) return {ok: false, error: 'La clave solo admite minúsculas, números y guiones (p. ej. la-mujer-carmesi).'};
  if (f.in_store && !f.buy_url) return {ok: false, error: 'Para aparecer en la tienda necesita enlace de compra.'};
  const q = id
    ? supabase.from('books').update(f).eq('id', id)
    : supabase.from('books').insert({...f, sort_order: 100});
  const {error} = await q;
  if (error) return {ok: false, error: error.code === '23505' ? 'Ya existe un libro con esa clave.' : error.message};
  await logChange(supabase, 'libro', `Libro ${id ? 'actualizado' : 'creado'}: ${f.label}`);
  revalidatePath('/libros');
  return {ok: true, message: 'Libro guardado.'};
}

export async function deleteBook(id: string): Promise<BookResult> {
  const {supabase} = await requireAdmin();
  const {data: b} = await supabase.from('books').select('key, label').eq('id', id).single();
  const {count} = await supabase.from('articles').select('id', {count: 'exact', head: true}).eq('frontmatter->>libro', b?.key ?? '');
  if (count) return {ok: false, error: `${count} artículo(s) usan este libro. Cámbialos antes de eliminarlo.`};
  const {error} = await supabase.from('books').delete().eq('id', id);
  if (error) return {ok: false, error: error.message};
  await logChange(supabase, 'libro', `Libro eliminado: ${b?.label}`);
  revalidatePath('/libros');
  return {ok: true};
}

export async function moveBook(id: string, dir: -1 | 1): Promise<BookResult> {
  const {supabase} = await requireAdmin();
  const {data} = await supabase.from('books').select('id').order('sort_order');
  const list = data ?? [];
  const i = list.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return {ok: true};
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((b, k) => supabase.from('books').update({sort_order: k}).eq('id', b.id)));
  await logChange(supabase, 'libro', 'Orden de libros cambiado');
  revalidatePath('/libros');
  return {ok: true};
}
