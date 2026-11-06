'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useState, useTransition} from 'react';
import type {DeployRow} from '@/lib/data/changes';
import {refreshDeploys, requestDeploy} from './actions';

const STATUS = {
  solicitado: {label: 'Solicitado', cls: 'border-line text-muted'},
  en_curso: {label: 'En curso', cls: 'border-accent/60 text-accent'},
  exito: {label: 'Publicado', cls: 'border-ok/50 text-ok'},
  error: {label: 'Error', cls: 'border-danger/50 text-danger'},
} as const;

export function DeployPanel({
  pending,
  deploys,
  configured,
  siteUrl,
}: {
  pending: {id: number; kind: string; label: string; created_at: string}[];
  deploys: DeployRow[];
  configured: boolean;
  siteUrl: string;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const [busy, start] = useTransition();
  const active = deploys.some((d) => d.status === 'solicitado' || d.status === 'en_curso');

  // Mientras hay un despliegue activo, consultar GitHub cada 10 s.
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      const r = await refreshDeploys();
      router.refresh();
      if (!r.active) clearInterval(t);
    }, 10_000);
    return () => clearInterval(t);
  }, [active, router]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <section className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-bold">
            Cambios pendientes <span className="font-normal text-muted">({pending.length})</span>
          </h2>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!configured || busy || active}
            onClick={() =>
              start(async () => {
                const r = await requestDeploy();
                setMsg(r.ok ? {ok: true, text: r.message} : {ok: false, text: r.error});
                router.refresh();
              })
            }
          >
            {active ? 'Desplegando…' : pending.length ? 'Desplegar ahora' : 'Redesplegar'}
          </button>
        </div>
        {!configured ? (
          <p className="mb-3 rounded-lg border border-warn/50 bg-warn/10 px-3 py-2 text-sm">
            Falta configurar <code>GITHUB_TOKEN</code> para poder desplegar desde aquí.
          </p>
        ) : null}
        {msg ? <p className={`mb-3 text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p> : null}
        {pending.length ? (
          <ul className="divide-y divide-line text-sm">
            {pending.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="chip mr-2 text-muted">{c.kind}</span>
                  {c.label}
                </span>
                <time className="shrink-0 text-xs text-muted">{new Date(c.created_at).toLocaleString('es')}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No hay cambios desde el último despliegue: El Códice está al día.</p>
        )}
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-bold">Historial</h2>
        {deploys.length ? (
          <ul className="space-y-3 text-sm">
            {deploys.map((d) => (
              <li key={d.id} className="border-b border-line pb-3 last:border-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`chip ${STATUS[d.status].cls}`}>{STATUS[d.status].label}</span>
                  <time className="text-xs text-muted">{new Date(d.requested_at).toLocaleString('es')}</time>
                </div>
                {d.summary ? <p className="mt-1 line-clamp-3 whitespace-pre-line text-xs text-muted">{d.summary}</p> : null}
                <div className="mt-1 flex gap-3 text-xs">
                  {d.github_run_url ? (
                    <a href={d.github_run_url} target="_blank" rel="noreferrer" className="text-accent">
                      Ver en GitHub ↗
                    </a>
                  ) : null}
                  {d.status === 'exito' && siteUrl ? (
                    <a href={siteUrl} target="_blank" rel="noreferrer" className="text-accent">
                      Abrir El Códice ↗
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Aún no hay despliegues.</p>
        )}
      </section>
    </div>
  );
}
