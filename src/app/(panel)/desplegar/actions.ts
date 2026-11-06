'use server';

import {revalidatePath} from 'next/cache';
import {requireAdmin} from '@/lib/auth';
import {pendingChanges} from '@/lib/data/changes';
import {dispatchDeploy, recentRuns} from '@/lib/github';

export type DeployResult = {ok: true; message: string} | {ok: false; error: string};

const ACTIVE_WINDOW_MS = 20 * 60 * 1000;

export async function requestDeploy(): Promise<DeployResult> {
  const {supabase} = await requireAdmin();
  const {data: active} = await supabase
    .from('deploys')
    .select('id, requested_at')
    .in('status', ['solicitado', 'en_curso'])
    .gt('requested_at', new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString())
    .limit(1);
  if (active?.length) return {ok: false, error: 'Ya hay un despliegue en curso. Espera a que termine.'};

  const pending = await pendingChanges(supabase);
  const summary = pending.length ? pending.slice(0, 20).map((c) => c.label).join('\n') : 'Sin cambios registrados (redespliegue)';
  const {data: row, error} = await supabase.from('deploys').insert({status: 'solicitado', summary}).select('id').single();
  if (error) return {ok: false, error: error.message};

  try {
    await dispatchDeploy();
  } catch (e) {
    await supabase.from('deploys').update({status: 'error', finished_at: new Date().toISOString(), summary: `${summary}\n\n${String(e)}`}).eq('id', row.id);
    revalidatePath('/desplegar');
    return {ok: false, error: e instanceof Error ? e.message : String(e)};
  }
  revalidatePath('/desplegar');
  return {ok: true, message: 'Despliegue solicitado. El Códice se reconstruye en 2–5 minutos.'};
}

/** Sincroniza el estado de los despliegues recientes con los runs de GitHub Actions. */
export async function refreshDeploys(): Promise<{active: boolean}> {
  const {supabase} = await requireAdmin();
  const {data: open} = await supabase
    .from('deploys')
    .select('id, requested_at, github_run_id')
    .in('status', ['solicitado', 'en_curso'])
    .order('requested_at');
  if (!open?.length) return {active: false};

  let runs: Awaited<ReturnType<typeof recentRuns>>;
  try {
    runs = await recentRuns();
  } catch {
    return {active: true};
  }
  const used = new Set(open.map((d) => d.github_run_id).filter(Boolean));
  for (const d of open) {
    const run =
      runs.find((r) => r.id === d.github_run_id) ??
      runs
        .filter((r) => !used.has(r.id) && new Date(r.created_at).getTime() >= new Date(d.requested_at).getTime() - 15_000)
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0];
    if (!run) {
      if (Date.now() - new Date(d.requested_at).getTime() > ACTIVE_WINDOW_MS) {
        await supabase.from('deploys').update({status: 'error', summary: 'GitHub no inició el workflow a tiempo.'}).eq('id', d.id);
      }
      continue;
    }
    used.add(run.id);
    const status = run.status !== 'completed' ? 'en_curso' : run.conclusion === 'success' ? 'exito' : 'error';
    await supabase
      .from('deploys')
      .update({
        status,
        github_run_id: run.id,
        github_run_url: run.html_url,
        finished_at: run.status === 'completed' ? run.updated_at : null,
      })
      .eq('id', d.id);
  }
  revalidatePath('/desplegar');
  const {count} = await supabase.from('deploys').select('id', {count: 'exact', head: true}).in('status', ['solicitado', 'en_curso']);
  return {active: (count ?? 0) > 0};
}
