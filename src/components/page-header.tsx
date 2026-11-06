import type {ReactNode} from 'react';

export function PageHeader({title, description, actions}: {title: string; description?: ReactNode; actions?: ReactNode}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Skeleton({className = 'h-40'}: {className?: string}) {
  return <div className={`card animate-pulse ${className}`} aria-hidden />;
}
