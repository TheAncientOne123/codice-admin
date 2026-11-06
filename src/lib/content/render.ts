/**
 * Artículo → archivo MDX final de El Códice.
 * La salida reproduce la forma actual de los documentos (imports, frontmatter,
 * <BrowserOnly><Infobox/></BrowserOnly>) para que el sitio no cambie.
 */
import yaml from 'js-yaml';
import {importLines} from './components';
import {inlineLinks, inlineToJsxExpression} from './inline';
import {INFOBOX_MARKER, type ArticleContent, type Infobox, type InfoboxImage} from './types';

function jsString(s: string): string {
  return JSON.stringify(s);
}

function imageObject(img: InfoboxImage): string {
  const parts = [`src: ${jsString(img.src)}`];
  if (img.alt != null) parts.push(`alt: ${jsString(img.alt)}`);
  if (img.label != null) parts.push(`label: ${jsString(img.label)}`);
  return `{ ${parts.join(', ')} }`;
}

export function renderInfobox(box: Infobox): string {
  const ind = box.browserOnly ? '  ' : '';
  const lines: string[] = [`${ind}<Infobox`];
  if (box.title != null) lines.push(`${ind}  title={${jsString(box.title)}}`);
  if (box.image) lines.push(`${ind}  image={${imageObject(box.image)}}`);
  if (box.images?.length) {
    lines.push(`${ind}  images={[`);
    for (const img of box.images) lines.push(`${ind}    ${imageObject(img)},`);
    lines.push(`${ind}  ]}`);
  }
  if (box.caption != null) lines.push(`${ind}  caption={${jsString(box.caption)}}`);
  lines.push(`${ind}  rows={[`);
  for (const row of box.rows) {
    lines.push(`${ind}    { label: ${jsString(row.label)}, value: ${inlineToJsxExpression(row.value)} },`);
  }
  lines.push(`${ind}  ]}`);
  lines.push(`${ind}/>`);
  const el = lines.join('\n');
  if (!box.browserOnly) return el;
  return `<BrowserOnly fallback={<div />}>\n{()=>(\n${el}\n)}\n</BrowserOnly>`;
}

/** Inserta la ficha en el cuerpo según su `placement`. */
export function bodyWithInfobox(body: string, box: Infobox | null): string {
  if (!box) return body.split(INFOBOX_MARKER).join('');
  const block = renderInfobox(box);
  if (box.placement === 'marcador' && body.includes(INFOBOX_MARKER)) {
    return body.replace(INFOBOX_MARKER, block);
  }
  if (box.placement === 'tras-titulo') {
    const m = /^(#[ \t][^\n]*\n)/m.exec(body);
    if (m && body.slice(0, m.index).trim() === '') {
      const at = m.index + m[0].length;
      return `${body.slice(0, at)}\n${block}\n${body.slice(at)}`;
    }
  }
  return `${block}\n\n${body}`;
}

const FRONTMATTER_FIRST = ['id', 'title', 'slug', 'sidebar_label', 'sidebar_position', 'description'];

export function renderFrontmatter(c: ArticleContent): string {
  const fm: Record<string, unknown> = {...c.frontmatter, title: c.title};
  if (c.description != null) fm.description = c.description;
  else delete fm.description;
  const ordered: Record<string, unknown> = {};
  for (const k of FRONTMATTER_FIRST) if (k in fm) ordered[k] = fm[k];
  for (const k of Object.keys(fm)) if (!(k in ordered)) ordered[k] = fm[k];
  return yaml.dump(ordered, {schema: yaml.JSON_SCHEMA, lineWidth: -1, noRefs: true});
}

export function renderMdx(c: ArticleContent): string {
  const body = bodyWithInfobox(c.body.replace(/^\s+/, ''), c.infobox).replace(/\s+$/, '');
  const imports = importLines(body);
  const head = `---\n${renderFrontmatter(c)}---\n`;
  return `${head}\n${imports.length ? `${imports.join('\n')}\n\n` : ''}${body}\n`;
}

/** URLs enlazadas por el artículo (cuerpo + ficha), sin resolver. */
export function extractLinkUrls(c: Pick<ArticleContent, 'body' | 'infobox'>): string[] {
  const urls = new Set<string>();
  const md = /\]\(\s*<?([^)\s>]+)>?\s*\)/g;
  const jsx = /<Link[^>]*\sto=["']([^"']+)["']/g;
  for (const re of [md, jsx]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(c.body))) urls.add(m[1]);
  }
  for (const row of c.infobox?.rows ?? []) for (const u of inlineLinks(row.value)) urls.add(u);
  return [...urls];
}
