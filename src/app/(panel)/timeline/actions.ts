'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import {logChange} from '@/lib/data/changes';

export type LaneRow = {id: string; label: string; color: string; href: string | null; universe_id: string | null};
export type EntryRow = {
  id: string;
  lane_id: string;
  kind: 'escritura' | 'publicacion' | 'proyecto';
  title: string;
  start_date: string;
  end_date: string | null;
  ongoing: boolean;
  approx: boolean;
  description: string | null;
  href: string | null;
  cover: string | null;
};

const DATE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

export async function saveTimeline(lanes: LaneRow[], entries: EntryRow[]) {
  const {supabase} = await requireAdmin();
  const laneIds = new Set(lanes.map((l) => l.id));
  for (const e of entries) {
    if (!e.title.trim()) return {ok: false as const, error: 'Hay una entrada sin título.'};
    if (!DATE.test(e.start_date)) return {ok: false as const, error: `Fecha de inicio no válida en «${e.title}» (usa AAAA, AAAA-MM o AAAA-MM-DD).`};
    if (e.end_date && !DATE.test(e.end_date)) return {ok: false as const, error: `Fecha de fin no válida en «${e.title}».`};
    if (!laneIds.has(e.lane_id)) return {ok: false as const, error: `«${e.title}» apunta a un carril que no existe.`};
  }
  // Reemplazo completo: la timeline es pequeña y se edita como un todo.
  const del1 = await supabase.from('timeline_entries').delete().not('id', 'is', null);
  const del2 = await supabase.from('timeline_lanes').delete().not('id', 'is', null);
  if (del1.error || del2.error) return {ok: false as const, error: (del1.error ?? del2.error)!.message};
  if (lanes.length) {
    const {error} = await supabase.from('timeline_lanes').insert(lanes.map((l, i) => ({...l, sort_order: i})));
    if (error) return {ok: false as const, error: error.message};
  }
  if (entries.length) {
    const {error} = await supabase.from('timeline_entries').insert(
      entries.map((e, i) => ({
        ...e,
        end_date: e.kind === 'publicacion' || e.ongoing ? null : e.end_date || null,
        ongoing: e.kind !== 'publicacion' && e.ongoing,
        sort_order: i,
      })),
    );
    if (error) return {ok: false as const, error: error.message};
  }
  await logChange(supabase, 'timeline', 'Timeline de la portada actualizada');
  revalidatePath('/timeline');
  return {ok: true as const};
}
