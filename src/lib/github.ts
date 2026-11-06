import 'server-only';

/** Cliente mínimo de la API de GitHub Actions para desplegar El Códice. */
function cfg() {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO ?? 'TheAncientOne123/authorsite2';
  const workflow = process.env.GITHUB_WORKFLOW ?? 'deploy.yml';
  const ref = process.env.GITHUB_REF ?? 'main';
  if (!token) throw new Error('Falta GITHUB_TOKEN en las variables de entorno.');
  return {token, repo, workflow, ref};
}

async function gh(path: string, init?: RequestInit) {
  const {token, repo} = cfg();
  return fetch(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  });
}

export async function dispatchDeploy(): Promise<void> {
  const {workflow, ref} = cfg();
  const res = await gh(`/actions/workflows/${workflow}/dispatches`, {method: 'POST', body: JSON.stringify({ref})});
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

export type WorkflowRun = {
  id: number;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | 'skipped' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
};

export async function recentRuns(): Promise<WorkflowRun[]> {
  const {workflow} = cfg();
  const res = await gh(`/actions/workflows/${workflow}/runs?event=workflow_dispatch&per_page=10`);
  if (!res.ok) throw new Error(`GitHub respondió ${res.status}`);
  const data = (await res.json()) as {workflow_runs: WorkflowRun[]};
  return data.workflow_runs;
}

export function githubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN);
}
