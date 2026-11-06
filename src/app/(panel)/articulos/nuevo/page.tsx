import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {NewArticleForm} from './new-article-form';

export const metadata = {title: 'Nuevo artículo'};

export default function NewArticlePage() {
  return (
    <>
      <PageHeader title="Nuevo artículo" description="Se crea como borrador; no aparece en el sitio hasta que lo publiques." />
      <Suspense fallback={<Skeleton className="h-72" />}>
        <Form />
      </Suspense>
    </>
  );
}

async function Form() {
  const {supabase} = await requireAdmin();
  const [{data: universes}, {data: categories}] = await Promise.all([
    supabase.from('universes').select('id, label').order('sort_order'),
    supabase.from('categories').select('id, label, universe_id').order('sort_order'),
  ]);
  return <NewArticleForm universes={universes ?? []} categories={categories ?? []} />;
}
