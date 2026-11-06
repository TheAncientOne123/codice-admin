'use client';

import {useState, useTransition} from 'react';
import type {SiteSettings} from '@/lib/content/site-settings';
import {saveSiteSettings} from './actions';

function Field({label, children}: {label: string; children: React.ReactNode}) {
  return (
    <div>
      <p className="label">{label}</p>
      {children}
    </div>
  );
}

export function SettingsForm({initial}: {initial: SiteSettings}) {
  const [s, setS] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ok: boolean; text: string} | null>(null);
  const [pending, start] = useTransition();
  const set = (patch: Partial<SiteSettings>) => {
    setS((x) => ({...x, ...patch}));
    setDirty(true);
    setMsg(null);
  };

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Cabecera</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título del sitio">
            <input className="input" value={s.title} onChange={(e) => set({title: e.target.value})} />
          </Field>
          <Field label="Texto del botón">
            <input className="input" value={s.hero.buttonLabel} onChange={(e) => set({hero: {...s.hero, buttonLabel: e.target.value}})} />
          </Field>
        </div>
        <Field label="Lema">
          <input className="input" value={s.tagline} onChange={(e) => set({tagline: e.target.value})} />
        </Field>
      </section>

      <section className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Aviso superior</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-[var(--accent)]" checked={s.announcement.enabled} onChange={(e) => set({announcement: {...s.announcement, enabled: e.target.checked}})} />
            Mostrar
          </label>
        </div>
        <textarea className="input" rows={2} value={s.announcement.content} onChange={(e) => set({announcement: {...s.announcement, content: e.target.value}})} />
        <p className="text-xs text-muted">Si cambias el texto, el aviso vuelve a aparecer para quien lo había cerrado.</p>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Tarjetas de presentación</h2>
        {s.features.map((f, i) => (
          <div key={i} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-[96px_1fr]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {f.image ? <img src={f.image} alt="" className="h-24 w-24 rounded-md object-contain" /> : <div className="h-24 w-24 rounded-md border border-dashed border-line" />}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input className="input" placeholder="Título" value={f.title} onChange={(e) => set({features: s.features.map((x, k) => (k === i ? {...x, title: e.target.value} : x))})} />
                <button type="button" className="btn btn-ghost px-2 text-danger" aria-label="Quitar tarjeta" onClick={() => set({features: s.features.filter((_, k) => k !== i)})}>
                  ✕
                </button>
              </div>
              <input className="input font-mono text-xs" placeholder="Imagen (URL)" value={f.image} onChange={(e) => set({features: s.features.map((x, k) => (k === i ? {...x, image: e.target.value} : x))})} />
              <textarea className="input" rows={2} placeholder="Descripción" value={f.description} onChange={(e) => set({features: s.features.map((x, k) => (k === i ? {...x, description: e.target.value} : x))})} />
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set({features: [...s.features, {title: '', image: '', description: ''}]})}>
          + Tarjeta
        </button>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-bold">Sobre el autor</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Título de la sección">
            <input className="input" value={s.about.title} onChange={(e) => set({about: {...s.about, title: e.target.value}})} />
          </Field>
          <Field label="Imagen (URL o ruta del sitio)">
            <input className="input font-mono text-xs" value={s.about.image} onChange={(e) => set({about: {...s.about, image: e.target.value}})} />
          </Field>
        </div>
        <Field label="Texto (deja una línea en blanco entre párrafos)">
          <textarea
            className="input"
            rows={8}
            value={s.about.paragraphs.join('\n\n')}
            onChange={(e) => set({about: {...s.about, paragraphs: e.target.value.split(/\n\s*\n/)}})}
          />
        </Field>
      </section>

      <section className="card grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Título de la cronología">
          <input className="input" value={s.timelineTitle} onChange={(e) => set({timelineTitle: e.target.value})} />
        </Field>
        <Field label="Subtítulo de la cronología">
          <input className="input" value={s.timelineSubtitle} onChange={(e) => set({timelineSubtitle: e.target.value})} />
        </Field>
        <Field label="Título de la tienda">
          <input className="input" value={s.storeTitle} onChange={(e) => set({storeTitle: e.target.value})} />
        </Field>
      </section>

      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {msg ? <span className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</span> : null}
        <button
          type="button"
          className="btn btn-primary shadow-lg"
          disabled={!dirty || pending}
          onClick={() =>
            start(async () => {
              const r = await saveSiteSettings(s);
              setMsg(r.ok ? {ok: true, text: 'Portada guardada.'} : {ok: false, text: r.error});
              if (r.ok) setDirty(false);
            })
          }
        >
          Guardar portada
        </button>
      </div>
    </div>
  );
}
