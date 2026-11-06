'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import {logChange} from '@/lib/data/changes';

export type SidebarItemInput = {
  kind: 'articulo' | 'enlace' | 'grafo';
  article_id: string | null;
  label: string | null;
  href: string | null;
};

export async function saveSidebar(universeId: string, items: SidebarItemInput[]) {
  const {supabase} = await requireAdmin();
  for (const it of items) {
    if (it.kind === 'articulo' && !it.article_id) return {ok: false as const, error: 'Hay un elemento de artículo sin artículo.'};
    if (it.kind === 'enlace' && !it.href?.trim()) return {ok: false as const, error: 'Hay un enlace sin dirección.'};
  }
  const {error: delErr} = await supabase.from('sidebar_items').delete().eq('universe_id', universeId);
  if (delErr) return {ok: false as const, error: delErr.message};
  if (items.length) {
    const {error} = await supabase.from('sidebar_items').insert(
      items.map((it, i) => ({
        universe_id: universeId,
        sort_order: i,
        kind: it.kind,
        article_id: it.kind === 'articulo' ? it.article_id : null,
        label: it.label?.trim() || null,
        href: it.kind === 'enlace' ? it.href!.trim() : null,
      })),
    );
    if (error) return {ok: false as const, error: error.message};
  }
  const {data: u} = await supabase.from('universes').select('label').eq('id', universeId).single();
  await logChange(supabase, 'sidebar', `Sidebar de ${u?.label ?? 'universo'} actualizado`, universeId);
  revalidatePath('/sidebar');
  return {ok: true as const};
}
