const STYLES = {
  publicado: 'border-ok/50 text-ok',
  borrador: 'border-line text-muted',
  despublicado: 'border-warn/50 text-warn',
} as const;

const LABELS = {publicado: 'Publicado', borrador: 'Borrador', despublicado: 'Despublicado'} as const;

export function StatusBadge({status, pendingEdits}: {status: keyof typeof STYLES; pendingEdits?: boolean}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className={`chip ${STYLES[status]}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        {LABELS[status]}
      </span>
      {pendingEdits ? (
        <span className="chip border-accent/50 text-accent" title="Hay cambios en el borrador que aún no se publicaron">
          cambios sin publicar
        </span>
      ) : null}
    </span>
  );
}
