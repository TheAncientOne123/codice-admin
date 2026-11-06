import {Suspense} from 'react';
import {PageHeader, Skeleton} from '@/components/page-header';
import {requireAdmin} from '@/lib/auth';
import {pendingChanges, recentDeploys} from '@/lib/data/changes';
import {githubConfigured} from '@/lib/github';
import {DeployPanel} from './deploy-panel';

export const metadata = {title: 'Desplegar'};

export default function DeployPage() {
  return (
    <>
      <PageHeader
        title="Desplegar"
        description="Reconstruye El Códice con todo lo publicado. Agrupa varios cambios y despliega una sola vez."
      />
      <Suspense fallback={<Skeleton className="h-80" />}>
        <Data />
      </Suspense>
    </>
  );
}

async function Data() {
  const {supabase} = await requireAdmin();
  const [pending, deploys] = await Promise.all([pendingChanges(supabase), recentDeploys(supabase, 15)]);
  return <DeployPanel pending={pending} deploys={deploys} configured={githubConfigured()} siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ''} />;
}
