'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import type {GraphConfig} from '@/lib/content/graph';
import {logChange} from '@/lib/data/changes';

export type Result = {ok: true; message?: string} | {ok: false; error: string};

const PALETTE = ['#38bdf8', '#c084fc', '#fbbf24', '#f472b6', '#34d399', '#fb7185', '#60a5fa', '#a78bfa', '#2dd4bf', '#f59e0b'];
const SLUG = /^[a-z0-9-]+$/;

export async function setGraphEnabled(universeId: string, enabled: boolean): Promise<Result> {
  const {supabase} = await requireAdmin();
  const [{data: existing}, {data: u}] = await Promise.all([
    supabase.from('graph_configs').select('universe_id').eq('universe_id', universeId).maybeSingle(),
    supabase.from('universes').select('label, route_base').eq('id', universeId).single(),
  ]);
  if (existing) {
    const {error} = await supabase.from('graph_configs').update({enabled}).eq('universe_id', universeId);
    if (error) return {ok: false, error: error.message};
  } else {
    // Primera vez: un grupo por categoría como punto de partida.
    const {data: cats} = await supabase.from('categories').select('slug, label').eq('universe_id', universeId).order('sort_order');
    const groups = (cats ?? []).map((c, i) => ({id: c.slug, label: c.label, color: PALETTE[i % PALETTE.length], categories: [c.slug], articles: []}));
    const {error} = await supabase.from('graph_configs').insert({
      universe_id: universeId,
      enabled,
      route_slug: (u?.route_base ?? 'grafo').toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
      title: 'Grafo de relaciones',
      groups,
    });
    if (error) return {ok: false, error: error.message};
  }
  await logChange(supabase, 'grafo', `Página de grafo ${enabled ? 'activada' : 'desactivada'}: ${u?.label}`, universeId);
  revalidatePath('/grafos');
  return {ok: true};
}

export async function saveGraphConfig(cfg: Omit<GraphConfig, 'enabled'>): Promise<Result> {
  const {supabase} = await requireAdmin();
  if (!SLUG.test(cfg.route_slug)) return {ok: false, error: 'La ruta solo admite minúsculas, números y guiones.'};
  const ids = new Set<string>();
  for (const g of cfg.groups) {
    if (!g.label.trim()) return {ok: false, error: 'Todos los grupos necesitan nombre.'};
    if (ids.has(g.id)) return {ok: false, error: `Id de grupo repetido: ${g.id}`};
    ids.add(g.id);
  }
  const {error} = await supabase
    .from('graph_configs')
    .update({
      route_slug: cfg.route_slug,
      title: cfg.title,
      groups: cfg.groups,
      other_label: cfg.other_label,
      other_color: cfg.other_color,
      excluded_article_ids: cfg.excluded_article_ids,
      filters: cfg.filters,
      settings: cfg.settings,
    })
    .eq('universe_id', cfg.universe_id);
  if (error) return {ok: false, error: error.code === '23505' ? 'Esa ruta ya la usa otro grafo.' : error.message};
  await logChange(supabase, 'grafo', 'Configuración de grafo actualizada', cfg.universe_id);
  revalidatePath(`/grafos/${cfg.universe_id}`);
  return {ok: true, message: 'Grafo guardado.'};
}
