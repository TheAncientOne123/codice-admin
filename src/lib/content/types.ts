/**
 * Modelo de contenido compartido por el admin, el importador y el renderizador.
 * Debe coincidir con las columnas de `supabase/migrations/0001_init.sql`.
 */

export type UniverseVisibility = 'publico' | 'proximamente' | 'oculto';
export type ArticleStatus = 'borrador' | 'publicado' | 'despublicado';

export type Universe = {
  id: string;
  route_base: string;
  plugin_id: string;
  docs_dir: string;
  label: string;
  description: string | null;
  cover_image: string | null;
  theme_id: string | null;
  visibility: UniverseVisibility;
  sort_order: number;
};

export type Category = {
  id: string;
  universe_id: string;
  slug: string;
  label: string;
  sort_order: number;
};

export type InfoboxImage = {src: string; alt?: string; label?: string};

/** `value` es markdown en línea: texto, *cursiva*, **negrita** y [enlaces](/ruta). */
export type InfoboxRow = {label: string; value: string};

/**
 * Dónde se coloca la ficha en el artículo exportado:
 * - `inicio`: antes de todo el cuerpo
 * - `tras-titulo`: justo después del primer encabezado `# …`
 * - `marcador`: en la línea `<FichaInfobox />` del cuerpo
 */
export type InfoboxPlacement = 'inicio' | 'tras-titulo' | 'marcador';

export type Infobox = {
  title?: string;
  caption?: string;
  image?: InfoboxImage;
  images?: InfoboxImage[];
  rows: InfoboxRow[];
  placement: InfoboxPlacement;
  /** Envolver en <BrowserOnly> (como hoy en casi todas las fichas). */
  browserOnly: boolean;
};

export const INFOBOX_MARKER = '<FichaInfobox />';

/** Contenido editable de un artículo (borrador o instantánea publicada). */
export type ArticleContent = {
  title: string;
  description: string | null;
  frontmatter: Record<string, unknown>;
  infobox: Infobox | null;
  body: string;
};

export type PublishedSnapshot = ArticleContent & {
  /** Ruta del archivo dentro de docs/, p. ej. `CrSaSo/personajes/Anya Rudzki.mdx`. */
  path: string;
  /** Archivo MDX final, listo para escribir tal cual. */
  mdx: string;
};

export type Article = {
  id: string;
  universe_id: string;
  category_id: string | null;
  slug: string;
  title: string;
  description: string | null;
  frontmatter: Record<string, unknown>;
  infobox: Infobox | null;
  body: string;
  status: ArticleStatus;
  published: PublishedSnapshot | null;
  is_landing: boolean;
  updated_at?: string;
  published_at?: string | null;
};
