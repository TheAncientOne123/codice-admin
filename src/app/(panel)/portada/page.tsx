import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {withDefaults} from '@/lib/content/site-settings';
import {SettingsForm} from './settings-form';

export const metadata = {title: 'Portada'};

export default function HomeSettingsPage() {
  return (
    <>
      <PageHeader title="Portada" description="Textos de la página de inicio de El Códice y ajustes generales del sitio." />
      <Suspense fallback={<Skeleton className="h-96" />}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  const {supabase} = await requireAdmin();
  const {data} = await supabase.from('site_settings').select('data').eq('id', true).maybeSingle();
  return <SettingsForm initial={withDefaults(data?.data)} />;
}
