/**
 * Importación única: authorsite2 (archivos) → instantánea JSON con la forma de las tablas.
 *
 *   npx tsx scripts/import-from-codice.ts [ruta-a-authorsite2]
 *
 * Salida: data/snapshot.json (filas por tabla) y data/import-report.md (problemas encontrados).
 * Cargar en Supabase después con scripts/load-snapshot.ts.
 */
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {importMdx} from '../src/lib/content/import-mdx';
import {articleFilePath, buildRouteIndex, resolveLink} from '../src/lib/content/paths';
import {extractLinkUrls, renderMdx} from '../src/lib/content/render';
import type {Article, Category, Universe} from '../src/lib/content/types';
import type {Snapshot} from '../src/lib/content/snapshot';

const SITE = path.resolve(process.argv[2] ?? path.join(__dirname, '..', '..', 'authorsite2'));
const OUT_DIR = path.join(__dirname, '..', 'data');
const require = createRequire(__filename);

// ─────────────────────────── Universos (hoy en docusaurus.config.js + UniverseSelector) ───────────────────────────
const UNIVERSES: (Omit<Universe, 'id'> & {sidebar: string; sidebarKey: string})[] = [
  {
    route_base: 'orbe', plugin_id: 'orbe', docs_dir: 'orbe', label: 'El Orbe de los Destinos',
    description: 'Un reino amurallado por la historia y la magia, donde los destinos se entrelazan.',
    cover_image: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/orbe/portadaLowQual',
    theme_id: 'orbe', visibility: 'proximamente', sort_order: 0,
    sidebar: 'orbe_sidebars.js', sidebarKey: 'orbeSidebar',
  },
  {
    route_base: 'CrSaSo', plugin_id: 'cronicas', docs_dir: 'CrSaSo', label: 'Crónicas de Sangre y Sombra',
    description: 'Oscuridad, sangre, deseo y una guerra secreta que cambiará la historia.',
    cover_image: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/cronicas-sangre/portadaNMLowQual',
    theme_id: null, visibility: 'publico', sort_order: 1,
    sidebar: 'docs/CrSaSo/cronicas_sidebars.js', sidebarKey: 'CrSaSoSidebar',
  },
  {
    route_base: 'Meridian', plugin_id: 'meridian', docs_dir: 'meridian', label: 'Meridian',
    description: 'Facciones, razas, campañas y un mapa en expansión: el códice de un mundo por descubrir.',
    cover_image: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/meridian-contenidos/meridian-portada',
    theme_id: 'meridian', visibility: 'proximamente', sort_order: 2,
    sidebar: 'meridian_sidebars.js', sidebarKey: 'meridianSidebar',
  },
  {
    route_base: 'Tumulo', plugin_id: 'tumulo', docs_dir: 'tumulo', label: 'El Túmulo de las Cataratas Lúgubres',
    description: 'Ensayos y libros standalone que no forman parte de un universo mayor.',
    cover_image: 'https://res.cloudinary.com/dtntllea5/image/upload/q_auto/f_auto/v1780631262/tcl-portada_l9ji9y.png',
    theme_id: 'tumulo', visibility: 'publico', sort_order: 3,
    sidebar: 'tumulo_sidebars.js', sidebarKey: 'tumuloSidebar',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  bestiario: 'Bestiario', 'campañas': 'Campañas', clases: 'Clases', ensayos: 'Ensayos', eventos: 'Eventos',
  facciones: 'Facciones', familias: 'Familias y Organizaciones', libros: 'Libros',
  'objetos-conceptos': 'Objetos y conceptos', lugares: 'Lugares', mapa: 'Mapa', otros: 'Otros',
  personajes: 'Personajes', razas: 'Razas',
};

const prettify = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/[-_]/g, ' ');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.mdx?$/.test(e.name)) out.push(p);
  }
  return out.sort();
}

async function importTs<T>(rel: string): Promise<T> {
  return (await import(pathToFileURL(path.join(SITE, rel)).href)) as T;
}

async function main() {
  const report: string[] = [];
  const universes: Universe[] = [];
  const categories: Category[] = [];
  const articles: Article[] = [];
  const docIdToArticle = new Map<string, string>(); // `${universeId}:${docId}` → article id
  const importsSeen = new Map<string, number>();

  for (const cfg of UNIVERSES) {
    const {sidebar: _s, sidebarKey: _k, ...row} = cfg;
    const u: Universe = {id: randomUUID(), ...row};
    universes.push(u);
    const root = path.join(SITE, 'docs', u.docs_dir);
    const catBySlug = new Map<string, Category>();

    for (const file of walk(root)) {
      const rel = path.relative(root, file).split(path.sep).join('/');
      const parts = rel.split('/');
      const slug = parts[parts.length - 1].replace(/\.mdx?$/, '');
      let cat: Category | null = null;
      if (parts.length === 2) {
        cat = catBySlug.get(parts[0]) ?? null;
        if (!cat) {
          cat = {
            id: randomUUID(), universe_id: u.id, slug: parts[0],
            label: CATEGORY_LABELS[parts[0]] ?? prettify(parts[0]), sort_order: catBySlug.size,
          };
          catBySlug.set(parts[0], cat);
          categories.push(cat);
        }
      }
      const res = importMdx(fs.readFileSync(file, 'utf8'), slug);
      for (const imp of res.imports) importsSeen.set(imp, (importsSeen.get(imp) ?? 0) + 1);
      for (const w of res.warnings) report.push(`- \`${u.docs_dir}/${rel}\`: ${w}`);

      const a: Article = {
        id: randomUUID(),
        universe_id: u.id,
        category_id: cat?.id ?? null,
        slug,
        ...res.content,
        status: res.empty ? 'borrador' : 'publicado',
        published: null,
        is_landing: parts.length === 1 || slug === 'index',
      };
      articles.push(a);
      const fmId = typeof a.frontmatter.id === 'string' ? a.frontmatter.id : null;
      const docId = fmId ? [cat?.slug, fmId].filter(Boolean).join('/') : rel.replace(/\.mdx?$/, '');
      docIdToArticle.set(`${u.id}:${docId}`, a.id);
    }
  }

  // ─────────── Enlaces ───────────
  const routeIndex = buildRouteIndex(articles, universes, categories);
  const links: {from_id: string; to_id: string; scope: 'draft' | 'published'}[] = [];
  const broken: string[] = [];
  const uById = new Map(universes.map((u) => [u.id, u]));
  const cById = new Map(categories.map((c) => [c.id, c]));
  for (const a of articles) {
    const seen = new Set<string>();
    for (const url of extractLinkUrls(a)) {
      if (!url.startsWith('/')) continue;
      const to = resolveLink(url, routeIndex);
      if (!to) {
        broken.push(`- \`${articleFilePath(a, uById.get(a.universe_id)!, cById.get(a.category_id ?? ''))}\` → \`${url}\``);
        continue;
      }
      if (to === a.id || seen.has(to)) continue;
      seen.add(to);
      links.push({from_id: a.id, to_id: to, scope: 'draft'});
      if (a.status === 'publicado') links.push({from_id: a.id, to_id: to, scope: 'published'});
    }
  }

  // ─────────── Instantánea publicada (MDX final) ───────────
  for (const a of articles) {
    if (a.status !== 'publicado') continue;
    const u = uById.get(a.universe_id)!;
    const cat = a.category_id ? cById.get(a.category_id) : null;
    const {title, description, frontmatter, infobox, body} = a;
    const content = {title, description, frontmatter, infobox, body};
    a.published = {...content, path: articleFilePath(a, u, cat), mdx: renderMdx(content)};
  }

  // ─────────── Sidebars ───────────
  const sidebar_items: Snapshot['sidebar_items'] = [];
  for (const cfg of UNIVERSES) {
    const u = universes.find((x) => x.route_base === cfg.route_base)!;
    const sb = require(path.join(SITE, cfg.sidebar)) as Record<string, {type: string; id?: string; label?: string; href?: string}[]>;
    sb[cfg.sidebarKey].forEach((item, i) => {
      if (item.type === 'doc') {
        const article_id = docIdToArticle.get(`${u.id}:${item.id}`);
        if (!article_id) return report.push(`- Sidebar ${u.route_base}: doc \`${item.id}\` no encontrado`);
        sidebar_items.push({id: randomUUID(), universe_id: u.id, sort_order: i, kind: 'articulo', article_id, label: item.label ?? null, href: null});
      } else if (item.type === 'link') {
        const isGraph = item.href?.startsWith('/grafos/');
        sidebar_items.push({id: randomUUID(), universe_id: u.id, sort_order: i, kind: isGraph ? 'grafo' : 'enlace', article_id: null, label: item.label ?? null, href: isGraph ? null : item.href ?? null});
      }
    });
  }

  // ─────────── Libros ───────────
  const crsaso = universes.find((u) => u.route_base === 'CrSaSo')!;
  const orbe = universes.find((u) => u.route_base === 'orbe')!;
  const {CR_SA_SO_SAGA_BOOKS} = await importTs<{CR_SA_SO_SAGA_BOOKS: Record<string, string | number | boolean | undefined>[]}>('src/data/crSaSoSagaBooks.ts');
  const {CR_SA_SO_BOOKS} = await importTs<{CR_SA_SO_BOOKS: readonly {key: string; label: string; color: string}[]}>('src/data/crSaSoBooks.ts');
  const STORE: Record<string, string> = {
    'necromancia-medianoche': 'https://www.amazon.com.mx/Necromancia-Medianoche-Historias-Oscuras-Spanish/dp/B0FHBYZWRS',
  };
  const books: Snapshot['books'] = [];
  const routeToId = (href?: string) => (href ? resolveLink(href, routeIndex) : null);
  for (const b of CR_SA_SO_SAGA_BOOKS) {
    const key = String(b.key);
    const viewerColor = CR_SA_SO_BOOKS.find((x) => x.key === key)?.color;
    if (viewerColor && viewerColor.toLowerCase() !== String(b.color).toLowerCase()) {
      report.push(`- Libro \`${key}\`: color distinto entre crSaSoBooks.ts (${viewerColor}) y crSaSoSagaBooks.ts (${b.color}); se usa ${viewerColor} (el que ve el lector en grafo y tarjetas)`);
    }
    books.push({
      id: randomUUID(), universe_id: crsaso.id, key, label: String(b.label), color: viewerColor ?? String(b.color),
      sort_order: Number(b.order), published: Boolean(b.published),
      article_id: routeToId(b.docRoute as string | undefined) ?? resolveLink(`/CrSaSo/libros/${b.label}`, routeIndex),
      cover: (b.cover as string) ?? null, tagline: (b.tagline as string) ?? null, year: (b.year as string) ?? null,
      synopsis: (b.synopsis as string) ?? null, buy_url: STORE[key] ?? null, in_store: key in STORE,
    });
  }
  for (const b of CR_SA_SO_BOOKS) {
    if (books.some((x) => x.key === b.key)) continue;
    books.push({id: randomUUID(), universe_id: crsaso.id, key: b.key, label: b.label, color: b.color, sort_order: 90, published: false,
      article_id: null, cover: null, tagline: null, year: null, synopsis: null, buy_url: null, in_store: false});
  }
  books.push({
    id: randomUUID(), universe_id: orbe.id, key: 'orbe-de-los-destinos', label: 'El Orbe de los Destinos', color: '#a78bfa',
    sort_order: 0, published: true, article_id: null,
    cover: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/orbe/portadaLowQual',
    tagline: 'El Reino de Ludrian', year: '2024', synopsis: null,
    buy_url: 'https://www.amazon.com.mx/ORBE-DESTINOS-REINO-LUDRIAN-Spanish/dp/B0D9NH2DS5', in_store: true,
  });

  // ─────────── Timeline ───────────
  const tl = await importTs<{
    TIMELINE_LANES: {id: string; label: string; color: string; href?: string}[];
    TIMELINE_ENTRIES: {id: string; lane: string; kind: string; title: string; start: string; end?: string | null; approx?: boolean; description?: string; href?: string; cover?: string}[];
  }>('src/data/authorTimeline.ts');
  const timeline_lanes = tl.TIMELINE_LANES.map((l, i) => ({
    id: l.id, label: l.label, color: l.color, href: l.href ?? null, sort_order: i,
    universe_id: universes.find((u) => l.href === `/${u.route_base}`)?.id ?? null,
  }));
  const timeline_entries = tl.TIMELINE_ENTRIES.map((e, i) => ({
    id: e.id, lane_id: e.lane, kind: e.kind as 'escritura' | 'publicacion' | 'proyecto', title: e.title,
    start_date: e.start, end_date: e.end ?? null, ongoing: e.end === null, approx: Boolean(e.approx),
    description: e.description ?? null, href: e.href ?? null, cover: e.cover ?? null, sort_order: i,
  }));

  // ─────────── Grafo de CrSaSo ───────────
  const {CR_SA_SO_GRAPH_LEGEND, CR_SA_SO_OTHER_COLOR} = await importTs<{
    CR_SA_SO_GRAPH_LEGEND: readonly {key: string; label: string; color: string}[]; CR_SA_SO_OTHER_COLOR: string;
  }>('src/data/crSaSoGraphCategories.ts');
  const excludedDocIds = ['index_c', 'eventos', 'familia', 'lugares', 'personajes', 'otros', 'libros/index'];
  const crsasoArticles = articles.filter((a) => a.universe_id === crsaso.id);
  const graph_configs: Snapshot['graph_configs'] = [
    {
      universe_id: crsaso.id, enabled: true, route_slug: 'sangre-y-sombra', title: 'Grafo de relaciones',
      groups: CR_SA_SO_GRAPH_LEGEND.map((g) => ({id: g.key, label: g.label, color: g.color, categories: [g.key], articles: []})),
      other_label: 'Libros y otras rutas', other_color: CR_SA_SO_OTHER_COLOR,
      excluded_article_ids: crsasoArticles
        .filter((a) => a.category_id === null && excludedDocIds.includes(a.slug))
        .map((a) => a.id),
      filters: {book: true, groups: true}, settings: {},
    },
  ];

  const site_settings = {
    title: 'El Códice',
    tagline: 'Compendio de obras, personajes y universos de Héctor Sánchez.',
    announcement: {
      enabled: true, id: 'spoiler_notice_v1',
      content: 'Este códice contiene spoilers de las obras. Se recomienda leer los libros antes de consultar.',
    },
    // Textos de src/pages/index.js y src/components/HomepageFeatures/index.js
    hero: {buttonLabel: 'Entrar', buttonHref: '/universes'},
    features: [
      {
        title: 'Explora el Universo',
        image: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/landing-page/universo',
        description: 'Sumérgete en los mundos, ciudades, razas y secretos que habitan mis historias. Desde mapas interactivos hasta descripciones detalladas, cada rincón de mi universo está a tu alcance.',
      },
      {
        title: 'Conoce a los personajes',
        image: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/landing-page/personajes',
        description: 'Cada historia está marcada por las decisiones de sus protagonistas. Aquí encontrarás biografías, relaciones, líneas del tiempo, relaciones y secretos de los personajes que dan vida a mis libros.',
      },
      {
        title: 'Accede a los libros',
        image: 'https://res.cloudinary.com/dtntllea5/image/upload/f_auto,q_auto/v1/authorsite/landing-page/libros',
        description: 'Descubre mis obras publicadas, orden de lectura, datos curiosos, inspiraciones y más.',
      },
    ],
    about: {
      title: 'Sobre el autor',
      image: '/img/flavicon/logoDark.png',
      paragraphs: [
        'Soy Héctor Sánchez, un autor apasionado por la creación de mundos fantásticos e historias épicas. Aunque soy relativamente nuevo en la escritura, siento una pasión innata por crear historias que transporten a los lectores a universos ricos en detalles y emociones.',
        'En este sitio encontrarás un compendio de mis obras, personajes y el vasto universo que he creado. Mi objetivo es compartir mi amor por la narrativa y ofrecer a los lectores una experiencia inmersiva en cada historia.',
        'Mi misión es que cada historia deje una emoción persistente, con preguntas nuevas y un deseo de volver y seguir explorando.',
      ],
    },
    storeTitle: 'Adquiere mis libros',
    timelineTitle: 'Cronología de la obra',
    timelineSubtitle: 'Cuándo se escribió y publicó cada libro, y lo que viene después.',
  };

  const snapshot: Snapshot = {
    generatedAt: new Date().toISOString(), source: SITE,
    universes, categories, articles, article_links: links, sidebar_items, books, graph_configs,
    timeline_lanes, timeline_entries, site_settings,
  };

  // ─────────── Reporte ───────────
  const published = articles.filter((a) => a.status === 'publicado').length;
  const withBox = articles.filter((a) => a.infobox).length;
  const imgLocal = articles.filter((a) => [a.infobox?.image?.src, ...(a.infobox?.images ?? []).map((i) => i.src)].some((s) => s?.startsWith('/img/')));
  const labels = new Map<string, number>();
  for (const a of articles) for (const r of a.infobox?.rows ?? []) labels.set(r.label, (labels.get(r.label) ?? 0) + 1);
  const norm = (s: string) => s.toLowerCase().replace(/\s*\/\s*/g, '/').trim();
  const labelGroups = new Map<string, string[]>();
  for (const l of labels.keys()) labelGroups.set(norm(l), [...(labelGroups.get(norm(l)) ?? []), l]);
  const inconsistent = [...labelGroups.values()].filter((g) => g.length > 1);

  const md = [
    `# Reporte de importación`,
    ``,
    `Origen: \`${SITE}\` · ${snapshot.generatedAt}`,
    ``,
    `- Universos: ${universes.length} · Categorías: ${categories.length}`,
    `- Artículos: ${articles.length} (publicados ${published}, borradores ${articles.length - published})`,
    `- Fichas (Infobox) convertidas a datos: ${withBox}`,
    `- Enlaces entre artículos: ${links.filter((l) => l.scope === 'draft').length}`,
    `- Elementos de sidebar: ${sidebar_items.length} · Libros: ${books.length} · Timeline: ${timeline_lanes.length} carriles, ${timeline_entries.length} entradas`,
    ``,
    `## Archivos vacíos (importados como borrador)`,
    ...articles.filter((a) => a.status === 'borrador').map((a) => `- \`${articleFilePath(a, uById.get(a.universe_id)!, cById.get(a.category_id ?? ''))}\``),
    ``,
    `## Enlaces rotos (${broken.length})`,
    ...broken,
    ``,
    `## Imágenes locales /img/ (ya no existen en static/)`,
    ...imgLocal.map((a) => `- \`${a.slug}\`: ${a.infobox?.image?.src ?? ''}`),
    ``,
    `## Etiquetas de ficha con variantes`,
    ...inconsistent.map((g) => `- ${g.map((l) => `"${l}" (${labels.get(l)})`).join(' · ')}`),
    ``,
    `## Avisos de conversión`,
    ...(report.length ? report : ['- ninguno']),
    ``,
    `## Imports encontrados`,
    ...[...importsSeen.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `- ${n}× \`${l}\``),
  ].join('\n');

  fs.mkdirSync(OUT_DIR, {recursive: true});
  fs.writeFileSync(path.join(OUT_DIR, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'import-report.md'), md);
  console.log(md.split('\n').slice(0, 9).join('\n'));
  console.log(`\nEnlaces rotos: ${broken.length} · avisos: ${report.length} → data/import-report.md`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
