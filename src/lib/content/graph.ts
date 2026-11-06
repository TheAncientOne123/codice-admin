/**
 * Construcción del grafo de un universo a partir de los enlaces entre artículos
 * (como Obsidian) y de la configuración de grupos del admin.
 *
 * Misma lógica que `authorsite2/scripts/sync-from-db.mjs` (buildGraphJson): mantener en sincronía.
 */

export type GraphGroup = {id: string; label: string; color: string; categories: string[]; articles: string[]};

export type GraphConfig = {
  universe_id: string;
  enabled: boolean;
  route_slug: string;
  title: string | null;
  groups: GraphGroup[];
  other_label: string;
  other_color: string;
  excluded_article_ids: string[];
  filters: {book?: boolean; groups?: boolean};
  settings: {repulsion?: number; gravity?: number; labelThreshold?: number; colorMode?: 'grupo' | 'libro' | 'comunidad'};
};

export type GraphArticle = {
  id: string;
  title: string;
  categorySlug: string | null;
  libro: string | null;
  route: string;
  docId: string;
  excerpt?: string;
  image?: string;
};

export type GraphNode = {
  id: string;
  docId: string;
  label: string;
  group: string;
  color: string;
  libro: string | null;
  route: string;
  degree: number;
  excerpt?: string;
  image?: string;
};

export const OTHER_GROUP_ID = 'otros';

export function groupOf(a: GraphArticle, cfg: Pick<GraphConfig, 'groups'>): GraphGroup | null {
  return (
    cfg.groups.find((g) => g.articles.includes(a.id)) ??
    cfg.groups.find((g) => a.categorySlug !== null && g.categories.includes(a.categorySlug)) ??
    null
  );
}

export function buildGraph(articles: GraphArticle[], links: {from_id: string; to_id: string}[], cfg: GraphConfig) {
  const excluded = new Set(cfg.excluded_article_ids);
  const included = articles.filter((a) => !excluded.has(a.id));
  const ids = new Set(included.map((a) => a.id));
  const seen = new Set<string>();
  const edges: {source: string; target: string}[] = [];
  const degree = new Map<string, number>();
  for (const l of links) {
    if (!ids.has(l.from_id) || !ids.has(l.to_id) || l.from_id === l.to_id) continue;
    const key = l.from_id < l.to_id ? `${l.from_id}|${l.to_id}` : `${l.to_id}|${l.from_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({source: l.from_id, target: l.to_id});
    degree.set(l.from_id, (degree.get(l.from_id) ?? 0) + 1);
    degree.set(l.to_id, (degree.get(l.to_id) ?? 0) + 1);
  }
  const nodes: GraphNode[] = included.map((a) => {
    const g = groupOf(a, cfg);
    return {
      id: a.id,
      docId: a.docId,
      label: a.title,
      group: g?.id ?? OTHER_GROUP_ID,
      color: g?.color ?? cfg.other_color,
      libro: a.libro,
      route: a.route,
      degree: degree.get(a.id) ?? 0,
      ...(a.excerpt ? {excerpt: a.excerpt} : {}),
      ...(a.image ? {image: a.image} : {}),
    };
  });
  const legend = [
    ...cfg.groups.map((g) => ({id: g.id, label: g.label, color: g.color})),
    {id: OTHER_GROUP_ID, label: cfg.other_label, color: cfg.other_color},
  ];
  return {nodes, edges, legend};
}
