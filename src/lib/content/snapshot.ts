import type {Article, Category, Universe} from './types';

/** Filas de todas las tablas: formato de import/export y respaldo. */
export type Snapshot = {
  generatedAt: string;
  source?: string;
  universes: Universe[];
  categories: Category[];
  articles: Article[];
  article_links: {from_id: string; to_id: string; scope: 'draft' | 'published'}[];
  sidebar_items: {
    id: string;
    universe_id: string;
    sort_order: number;
    kind: 'articulo' | 'enlace' | 'grafo';
    article_id: string | null;
    label: string | null;
    href: string | null;
  }[];
  books: {
    id: string;
    universe_id: string | null;
    key: string;
    label: string;
    color: string;
    sort_order: number;
    published: boolean;
    article_id: string | null;
    cover: string | null;
    tagline: string | null;
    year: string | null;
    synopsis: string | null;
    buy_url: string | null;
    in_store: boolean;
  }[];
  graph_configs: {
    universe_id: string;
    enabled: boolean;
    route_slug: string;
    title: string | null;
    groups: {id: string; label: string; color: string; categories: string[]; articles: string[]}[];
    other_label: string;
    other_color: string;
    excluded_article_ids: string[];
    filters: Record<string, unknown>;
    settings: Record<string, unknown>;
  }[];
  timeline_lanes: {id: string; label: string; color: string; href: string | null; universe_id: string | null; sort_order: number}[];
  timeline_entries: {
    id: string;
    lane_id: string;
    kind: 'escritura' | 'publicacion' | 'proyecto';
    title: string;
    start_date: string;
    end_date: string | null;
    ongoing: boolean;
    approx: boolean;
    description: string | null;
    href: string | null;
    cover: string | null;
    sort_order: number;
  }[];
  site_settings: Record<string, unknown>;
};
