-- Códice Admin: esquema inicial.
-- Fuente de verdad del contenido de El Códice. El sitio (authorsite2) solo lee lo publicado.

create extension if not exists pgcrypto;

-- ─────────────────────────── Tipos ───────────────────────────
create type universe_visibility as enum ('publico', 'proximamente', 'oculto');
create type article_status as enum ('borrador', 'publicado', 'despublicado');
create type sidebar_item_kind as enum ('articulo', 'enlace', 'grafo');
create type timeline_kind as enum ('escritura', 'publicacion', 'proyecto');
create type deploy_status as enum ('solicitado', 'en_curso', 'exito', 'error');

-- ─────────────────────────── Administradores ───────────────────────────
create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null
);

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

-- updated_at automático
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─────────────────────────── Universos y categorías ───────────────────────────
create table universes (
  id uuid primary key default gen_random_uuid(),
  route_base text unique not null,          -- URL: /CrSaSo, /Meridian…
  plugin_id text unique not null,           -- id del plugin de docs (cronicas, meridian…)
  docs_dir text unique not null,            -- carpeta generada bajo docs/
  label text not null,
  description text,
  cover_image text,
  theme_id text,                            -- data-universe (null = tema por defecto)
  visibility universe_visibility not null default 'publico',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger universes_touch before update on universes for each row execute function touch_updated_at();

create table categories (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references universes (id) on delete cascade,
  slug text not null,                       -- carpeta: personajes, lugares…
  label text not null,
  sort_order int not null default 0,
  unique (universe_id, slug)
);

-- ─────────────────────────── Artículos ───────────────────────────
-- Los campos sin prefijo son el BORRADOR (lo que se edita).
-- `published` es la instantánea publicada: {path, title, description, frontmatter, infobox, body, mdx}.
create table articles (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references universes (id) on delete cascade,
  category_id uuid references categories (id) on delete restrict,
  slug text not null,                       -- nombre de archivo sin extensión (mantiene las URLs)
  title text not null,
  description text,
  frontmatter jsonb not null default '{}'::jsonb,
  infobox jsonb,
  body text not null default '',
  status article_status not null default 'borrador',
  published jsonb,
  is_landing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique nulls not distinct (universe_id, category_id, slug)
);
create trigger articles_touch before update on articles for each row execute function touch_updated_at();
create index articles_universe_idx on articles (universe_id, category_id);
create index articles_status_idx on articles (status);

create table article_revisions (
  id bigint generated always as identity primary key,
  article_id uuid not null references articles (id) on delete cascade,
  snapshot jsonb not null,
  note text,
  created_at timestamptz not null default now()
);
create index article_revisions_article_idx on article_revisions (article_id, created_at desc);

-- Enlaces entre artículos. scope 'draft' = del borrador (UI); 'published' = de lo publicado (grafo).
create table article_links (
  from_id uuid not null references articles (id) on delete cascade,
  to_id uuid not null references articles (id) on delete cascade,
  scope text not null check (scope in ('draft', 'published')),
  primary key (from_id, to_id, scope)
);
create index article_links_to_idx on article_links (to_id, scope);

-- ─────────────────────────── Sidebar ───────────────────────────
create table sidebar_items (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references universes (id) on delete cascade,
  sort_order int not null default 0,
  kind sidebar_item_kind not null,
  article_id uuid references articles (id) on delete cascade,
  label text,
  href text,
  check (kind <> 'articulo' or article_id is not null),
  check (kind <> 'enlace' or href is not null)
);

-- ─────────────────────────── Libros ───────────────────────────
create table books (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid references universes (id) on delete set null,
  key text unique not null,                 -- clave usada en frontmatter `libro`
  label text not null,
  color text not null default '#94a3b8',
  sort_order int not null default 0,
  published boolean not null default false,
  article_id uuid references articles (id) on delete set null,
  cover text,
  tagline text,
  year text,
  synopsis text,
  buy_url text,
  in_store boolean not null default false   -- aparece en "Adquiere mis libros"
);

-- ─────────────────────────── Grafos ───────────────────────────
-- groups: [{id, label, color, categories: [slug], articles: [uuid]}] en orden.
-- filters: {book: bool, groups: bool, frontmatterKeys: [..]}; settings: valores iniciales del visor.
create table graph_configs (
  universe_id uuid primary key references universes (id) on delete cascade,
  enabled boolean not null default false,
  route_slug text not null,                 -- /grafos/<route_slug>
  title text,
  groups jsonb not null default '[]'::jsonb,
  other_label text not null default 'Otros',
  other_color text not null default '#a8a29e',
  excluded_article_ids uuid[] not null default '{}',
  filters jsonb not null default '{"book": true, "groups": true}'::jsonb,
  settings jsonb not null default '{}'::jsonb
);

-- ─────────────────────────── Timeline ───────────────────────────
create table timeline_lanes (
  id text primary key,
  label text not null,
  color text not null,
  href text,
  universe_id uuid references universes (id) on delete set null,
  sort_order int not null default 0
);

create table timeline_entries (
  id text primary key,
  lane_id text not null references timeline_lanes (id) on delete cascade,
  kind timeline_kind not null,
  title text not null,
  start_date text not null check (start_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  end_date text check (end_date is null or end_date ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  ongoing boolean not null default false,  -- true = end null ("en curso")
  approx boolean not null default false,
  description text,
  href text,
  cover text,
  sort_order int not null default 0
);

-- ─────────────────────────── Ajustes del sitio ───────────────────────────
create table site_settings (
  id boolean primary key default true check (id),   -- fila única
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger site_settings_touch before update on site_settings for each row execute function touch_updated_at();

-- ─────────────────────────── Despliegues ───────────────────────────
create table deploys (
  id bigint generated always as identity primary key,
  status deploy_status not null default 'solicitado',
  requested_at timestamptz not null default now(),
  finished_at timestamptz,
  github_run_id bigint,
  github_run_url text,
  summary text
);

-- Cambios que afectan al sitio publicado. Pendientes = posteriores al último despliegue.
create table change_log (
  id bigint generated always as identity primary key,
  kind text not null,          -- articulo, universo, sidebar, grafo, timeline, libro, portada
  label text not null,         -- texto legible: "Publicado: Anya Rudzki"
  ref_id text,
  created_at timestamptz not null default now()
);
create index change_log_created_idx on change_log (created_at desc);

-- ─────────────────────────── RLS ───────────────────────────
-- Admin: todo. Anónimo (CI de authorsite2): solo lectura de lo publicable.
alter table admins enable row level security;
alter table universes enable row level security;
alter table categories enable row level security;
alter table articles enable row level security;
alter table article_revisions enable row level security;
alter table article_links enable row level security;
alter table sidebar_items enable row level security;
alter table books enable row level security;
alter table graph_configs enable row level security;
alter table timeline_lanes enable row level security;
alter table timeline_entries enable row level security;
alter table site_settings enable row level security;
alter table deploys enable row level security;
alter table change_log enable row level security;

create policy admin_self_read on admins for select to authenticated using (user_id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['universes','categories','articles','article_revisions','article_links',
    'sidebar_items','books','graph_configs','timeline_lanes','timeline_entries','site_settings','deploys','change_log']
  loop
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Lectura pública (lo que El Códice necesita para construirse). Nunca borradores.
create policy public_read on universes for select to anon using (visibility <> 'oculto');
create policy public_read on categories for select to anon
  using (exists (select 1 from universes u where u.id = universe_id and u.visibility <> 'oculto'));
create policy public_read on articles for select to anon
  using (status = 'publicado' and exists (select 1 from universes u where u.id = universe_id and u.visibility <> 'oculto'));
create policy public_read on article_links for select to anon
  using (scope = 'published'
    and exists (select 1 from articles a where a.id = from_id and a.status = 'publicado')
    and exists (select 1 from articles a where a.id = to_id and a.status = 'publicado'));
create policy public_read on sidebar_items for select to anon
  using (exists (select 1 from universes u where u.id = universe_id and u.visibility <> 'oculto'));
create policy public_read on books for select to anon using (true);
create policy public_read on graph_configs for select to anon using (enabled);
create policy public_read on timeline_lanes for select to anon using (true);
create policy public_read on timeline_entries for select to anon using (true);
create policy public_read on site_settings for select to anon using (true);

-- La columna con el borrador no debe salir al rol anónimo aunque la fila sea pública.
revoke select on articles from anon;
grant select (id, universe_id, category_id, slug, status, published, is_landing, published_at, updated_at)
  on articles to anon;
