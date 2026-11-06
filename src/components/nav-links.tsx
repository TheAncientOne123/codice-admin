'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {NAV} from './nav-items';


export function NavLinks({compact = false}: {compact?: boolean}) {
  const pathname = usePathname();
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  if (compact) {
    return (
      <nav className="flex gap-1 overflow-x-auto px-3 py-2" aria-label="Secciones">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-md px-2.5 py-1 text-sm ${isActive(item.href) ? 'bg-accent/15 font-semibold text-ink' : 'text-muted'}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Secciones">
      {NAV.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-lg px-3 py-2 text-sm transition-colors ${
              active ? 'bg-accent/15 font-semibold text-ink shadow-[inset_3px_0_0_var(--accent)]' : 'text-muted hover:bg-surface-2 hover:text-ink'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
