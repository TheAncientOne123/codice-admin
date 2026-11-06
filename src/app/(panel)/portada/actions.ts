'use server';

import {createHash} from 'node:crypto';
import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import {logChange} from '@/lib/data/changes';
import {withDefaults, type SiteSettings} from '@/lib/content/site-settings';

export async function saveSiteSettings(next: SiteSettings) {
  const {supabase} = await requireAdmin();
  if (!next.title.trim()) return {ok: false as const, error: 'El sitio necesita un título.'};
  const {data: current} = await supabase.from('site_settings').select('data').eq('id', true).maybeSingle();
  const prev = withDefaults(current?.data);

  // Docusaurus recuerda el aviso cerrado por su id: un texto nuevo necesita un id nuevo.
  const announcement = {...next.announcement};
  if (announcement.content !== prev.announcement.content) {
    announcement.id = `aviso_${createHash('sha1').update(announcement.content).digest('hex').slice(0, 8)}`;
  }
  const data = {
    ...next,
    announcement,
    features: next.features.filter((f) => f.title.trim()),
    about: {...next.about, paragraphs: next.about.paragraphs.map((p) => p.trim()).filter(Boolean)},
  };
  const {error} = await supabase.from('site_settings').upsert({id: true, data});
  if (error) return {ok: false as const, error: error.message};
  await logChange(supabase, 'portada', 'Portada y ajustes del sitio actualizados');
  revalidatePath('/portada');
  return {ok: true as const};
}
