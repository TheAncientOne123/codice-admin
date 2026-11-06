import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {BookForm, type BookRow} from './book-form';

export const metadata = {title: 'Libros'};

export default function BooksPage() {
  return (
    <>
      <PageHeader
        title="Libros"
        description="Una sola lista para el orden de lectura, los colores del grafo, el filtro por libro y la tienda de la portada."
      />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  const {supabase} = await requireAdmin();
  const [{data: books}, {data: universes}, {data: articles}] = await Promise.all([
    supabase.from('books').select('*').order('sort_order'),
    supabase.from('universes').select('id, label').order('sort_order'),
    supabase.from('articles').select('id, title, universe_id, frontmatter').order('title'),
  ]);
  const usage = (key: string) => (articles ?? []).filter((a) => (a.frontmatter as {libro?: string}).libro === key).length;
  return (
    <div className="space-y-4">
      {((books ?? []) as BookRow[]).map((b, i, all) => (
        <BookForm key={b.id} book={b} usage={usage(b.key)} universes={universes ?? []} articles={articles ?? []} first={i === 0} last={i === all.length - 1} />
      ))}
      <details className="card p-5">
        <summary className="cursor-pointer font-semibold">+ Nuevo libro</summary>
        <div className="mt-4">
          <BookForm book={null} usage={0} universes={universes ?? []} articles={articles ?? []} first last />
        </div>
      </details>
    </div>
  );
}
