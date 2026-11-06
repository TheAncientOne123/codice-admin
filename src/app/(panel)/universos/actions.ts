'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import {logChange} from '@/lib/data/changes';
import type {UniverseVisibility} from '@/lib/content/types';

export type Result = {ok: true; message?: string} | {ok: false; error: string};

const VIS: UniverseVisibility[] = ['publico', 'proximamente', 'oculto'];
const SAFE_SEGMENT = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9_-]+$/;

export async function updateUniverse(id: string, form: FormData): Promise<Result> {
  const {supabase} = await requireAdmin();
  const visibility = String(form.get('visibility')) as UniverseVisibility;
  if (!VIS.includes(visibility)) return {ok: false, error: 'Visibilidad no válida.'};
  const patch = {
    label: String(form.get('label') ?? '').trim(),
    description: String(form.get('description') ?? '').trim() || null,
    cover_image: String(form.get('cover_image') ?? '').trim() || null,
    theme_id: String(form.get('theme_id') ?? '').trim() || null,
    visibility,
  };
  if (!patch.label) return {ok: false, error: 'El nombre no puede estar vacío.'};
  const {error} = await supabase.from('universes').update(patch).eq('id', id);
  if (error) return {ok: false, error: error.message};
  await logChange(supabase, 'universo', `Universo actualizado: ${patch.label} (${visibility})`, id);
  revalidatePath('/universos');
  return {ok: true, message: 'Guardado.'};
}

export async function moveUniverse(id: string, dir: -1 | 1): Promise<Result> {
  const {supabase} = await requireAdmin();
  const {data} = await supabase.from('universes').select('id, label').order('sort_order');
  const list = data ?? [];
  const i = list.findIndex((u) => u.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return {ok: true};
  [list[i], list[j]] = [list[j], list[i]];
  await Promise.all(list.map((u, k) => supabase.from('universes').update({sort_order: k}).eq('id', u.id)));
  await logChange(supabase, 'universo', `Orden de universos cambiado`);
  revalidatePath('/universos');
  return {ok: true};
}

export async function createUniverse(_prev: Result | null, form: FormData): Promise<Result> {
  const {supabase} = await requireAdmin();
  const label = String(form.get('label') ?? '').trim();
  const route_base = String(form.get('route_base') ?? '').trim();
  if (!label || !SAFE_SEGMENT.test(route_base)) {
    return {ok: false, error: 'Escribe un nombre y una ruta (solo letras, números, - y _).'};
  }
  const {count} = await supabase.from('universes').select('id', {count: 'exact', head: true});
  const {error} = await supabase.from('universes').insert({
    label,
    route_base,
    plugin_id: route_base.toLowerCase(),
    docs_dir: route_base.toLowerCase(),
    visibility: 'oculto',
    sort_order: count ?? 0,
  });
  if (error) return {ok: false, error: error.code === '23505' ? 'Ya existe un universo con esa ruta.' : error.message};
  revalidatePath('/universos');
  return {ok: true, message: 'Universo creado como oculto. Añade artículos y hazlo público cuando esté listo.'};
}

export async function saveCategory(universeId: string, form: FormData): Promise<Result> {
  const {supabase} = await requireAdmin();
  const id = String(form.get('id') ?? '');
  const label = String(form.get('label') ?? '').trim();
  if (!label) return {ok: false, error: 'La categoría necesita un nombre.'};
  if (id) {
    const {error} = await supabase.from('categories').update({label}).eq('id', id);
    if (error) return {ok: false, error: error.message};
  } else {
    const slug = String(form.get('slug') ?? '').trim();
    if (!SAFE_SEGMENT.test(slug)) return {ok: false, error: 'La carpeta solo admite letras, números, - y _.'};
    const {count} = await supabase.from('categories').select('id', {count: 'exact', head: true}).eq('universe_id', universeId);
    const {error} = await supabase.from('categories').insert({universe_id: universeId, slug, label, sort_order: count ?? 0});
    if (error) return {ok: false, error: error.code === '23505' ? 'Esa carpeta ya existe.' : error.message};
  }
  await logChange(supabase, 'universo', `Categoría: ${label}`);
  revalidatePath('/universos');
  return {ok: true, message: 'Categoría guardada.'};
}
