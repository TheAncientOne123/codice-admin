import {Suspense} from 'react';
import Link from 'next/link';
import {NAV} from '@/components/nav-items';
import {NavLinks} from '@/components/nav-links';
import {UserMenu} from '@/components/user-menu';

/** Navegación sin estado activo (se ve mientras llega la ruta actual). */
function StaticNav() {
  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Secciones">
      {NAV.map((item) => (
        <Link key={item.href} href={item.href} className="rounded-lg px-3 py-2 text-sm text-muted">
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

/** Marco del panel: estático (prerenderizado); la sesión se lee dentro de <Suspense>. */
export default function PanelLayout({children}: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-surface max-md:hidden">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="grid h-8 w-8 place-items-center rounded-full border border-accent/60 text-sm font-bold text-accent">
            C
          </span>
          <div className="leading-tight">
            <p className="text-sm font-bold">Códice Admin</p>
            <p className="text-xs text-muted">El Códice</p>
          </div>
        </div>
        <Suspense fallback={<StaticNav />}>
          <NavLinks />
        </Suspense>
        <div className="mt-auto border-t border-line p-3">
          <Suspense fallback={<div className="h-9" />}>
            <UserMenu />
          </Suspense>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line bg-surface md:hidden">
          <Suspense fallback={<div className="h-11" />}>
            <NavLinks compact />
          </Suspense>
        </div>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
