import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';

export type ChangeKind = 'articulo' | 'universo' | 'sidebar' | 'grafo' | 'timeline' | 'libro' | 'portada';

/** Registra un cambio que afecta al sitio publicado (aparece en "Desplegar"). */
export async function logChange(db: SupabaseClient, kind: ChangeKind, label: string, refId?: string) {
  await db.from('change_log').insert({kind, label, ref_id: refId ?? null});
}

export type DeployRow = {
  id: number;
  status: 'solicitado' | 'en_curso' | 'exito' | 'error';
  requested_at: string;
  finished_at: string | null;
  github_run_url: string | null;
  summary: string | null;
};

/** Cambios registrados después del último despliegue que no falló. */
export async function pendingChanges(db: SupabaseClient) {
  const {data: last} = await db
    .from('deploys')
    .select('requested_at')
    .neq('status', 'error')
    .order('requested_at', {ascending: false})
    .limit(1)
    .maybeSingle();
  let q = db.from('change_log').select('id, kind, label, created_at').order('created_at', {ascending: false});
  if (last?.requested_at) q = q.gt('created_at', last.requested_at);
  const {data} = await q.limit(200);
  return data ?? [];
}

export async function recentDeploys(db: SupabaseClient, limit = 10): Promise<DeployRow[]> {
  const {data} = await db.from('deploys').select('*').order('requested_at', {ascending: false}).limit(limit);
  return (data ?? []) as DeployRow[];
}
