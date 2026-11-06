/**
 * Importa un .mdx de El Códice al modelo del admin.
 *
 * Estrategia: ediciones quirúrgicas sobre el texto original usando las posiciones
 * del AST (remark-mdx). Todo lo que no se convierte queda byte a byte igual.
 * - imports → se eliminan (el renderizador los regenera)
 * - primera <Infobox> (con o sin <BrowserOnly>) → JSON estructurado
 * - <Link to> en línea → [texto](url) markdown
 */
import * as acorn from 'acorn';
import jsx from 'acorn-jsx';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import {unified} from 'unified';
import {visit} from 'unist-util-visit';
import type {Node, Parent} from 'unist';
import {UnsupportedJsx, canonicalUrl, cleanJsxText, jsxToInline} from './inline';
import {INFOBOX_MARKER, type ArticleContent, type Infobox, type InfoboxImage, type InfoboxPlacement} from './types';

const JsxParser = acorn.Parser.extend(jsx());

type Pos = {start: {offset?: number}; end: {offset?: number}};
type MdNode = Node & {position?: Pos; name?: string | null; value?: string; attributes?: MdAttr[]; children?: MdNode[]; depth?: number};
type MdAttr = {type: string; name?: string; value?: unknown};
type Edit = {start: number; end: number; text: string};

export type ImportResult = {
  content: ArticleContent;
  imports: string[];
  warnings: string[];
  empty: boolean;
};

const parser = unified().use(remarkParse).use(remarkMdx);

function off(n: MdNode, which: 'start' | 'end'): number {
  const v = n.position?.[which].offset;
  if (v == null) throw new Error('nodo sin posición');
  return v;
}

// ─────────────────────────── Evaluación de estree literal ───────────────────────────

type Est = {type: string; [k: string]: unknown};

function evalLiteral(n: Est): unknown {
  switch (n.type) {
    case 'Literal':
      return n.value;
    case 'TemplateLiteral':
      if ((n.expressions as unknown[]).length) throw new UnsupportedJsx('template con expresiones');
      return ((n.quasis as Est[])[0].value as {cooked: string}).cooked;
    case 'ObjectExpression': {
      const obj: Record<string, unknown> = {};
      for (const p of n.properties as Est[]) {
        if (p.type !== 'Property') throw new UnsupportedJsx('spread en objeto');
        const key = p.key as Est;
        const k = key.type === 'Identifier' ? (key.name as string) : String(key.value);
        obj[k] = evalLiteral(p.value as Est);
      }
      return obj;
    }
    case 'ArrayExpression':
      return (n.elements as Est[]).map((e) => evalLiteral(e));
    case 'JSXElement':
    case 'JSXFragment':
      return {__inline: jsxToInline(n)};
    default:
      throw new UnsupportedJsx(`expresión no literal: ${n.type}`);
  }
}

function asInline(v: unknown): string {
  if (typeof v === 'string') return v.replace(/([\\`*_[\]<>{}])/g, '\\$1');
  if (v && typeof v === 'object' && '__inline' in v) return (v as {__inline: string}).__inline;
  if (typeof v === 'number') return String(v);
  throw new UnsupportedJsx('valor de fila no soportado');
}

function asImage(v: unknown): InfoboxImage {
  const o = v as Record<string, unknown>;
  if (!o || typeof o.src !== 'string') throw new UnsupportedJsx('imagen sin src');
  const img: InfoboxImage = {src: o.src};
  if (typeof o.alt === 'string') img.alt = o.alt;
  if (typeof o.label === 'string') img.label = o.label;
  return img;
}

/** Parsea `<Infobox …/>` a partir de `src[at]` y devuelve sus props. */
function parseInfoboxJsx(src: string, at: number): Omit<Infobox, 'placement' | 'browserOnly'> {
  const el = JsxParser.parseExpressionAt(src, at, {ecmaVersion: 'latest', sourceType: 'module'}) as unknown as Est;
  if (el.type !== 'JSXElement') throw new UnsupportedJsx('Infobox no es un elemento JSX');
  if ((el.children as unknown[]).some((c) => (c as Est).type !== 'JSXText' || cleanJsxText((c as {value: string}).value))) {
    throw new UnsupportedJsx('Infobox con hijos');
  }
  const props: Record<string, unknown> = {};
  for (const a of (el.openingElement as Est).attributes as Est[]) {
    if (a.type !== 'JSXAttribute') throw new UnsupportedJsx('spread en Infobox');
    const name = (a.name as Est).name as string;
    const v = a.value as Est | null;
    if (!v) props[name] = true;
    else if (v.type === 'Literal') props[name] = v.value;
    else if (v.type === 'JSXExpressionContainer') props[name] = evalLiteral(v.expression as Est);
    else throw new UnsupportedJsx(`atributo ${name}`);
  }
  const known = new Set(['title', 'caption', 'image', 'images', 'rows']);
  const unknown = Object.keys(props).filter((k) => !known.has(k));
  if (unknown.length) throw new UnsupportedJsx(`props desconocidas: ${unknown.join(', ')}`);
  const rows = ((props.rows as Record<string, unknown>[]) ?? []).map((r) => {
    if (typeof r.label !== 'string') throw new UnsupportedJsx('fila sin label');
    return {label: r.label, value: asInline(r.value)};
  });
  const box: Omit<Infobox, 'placement' | 'browserOnly'> = {rows};
  if (typeof props.title === 'string') box.title = props.title;
  if (typeof props.caption === 'string') box.caption = props.caption;
  // Infobox ignora una `image` sin src (no la pinta): se descarta sin cambiar la salida.
  if (props.image && typeof (props.image as {src?: unknown}).src === 'string') box.image = asImage(props.image);
  if (Array.isArray(props.images)) box.images = props.images.map(asImage);
  return box;
}

// ─────────────────────────── Importación ───────────────────────────

function parseFrontmatter(raw: string) {
  return matter(raw, {
    engines: {yaml: (s: string) => (yaml.load(s, {schema: yaml.JSON_SCHEMA}) ?? {}) as object},
  });
}

function firstHeadingText(body: string): string | null {
  const m = /^#[ \t]+(.+?)\s*#*\s*$/m.exec(body);
  return m ? m[1].replace(/[*_`]/g, '').trim() : null;
}

/** Texto de los hijos de un <Link> en línea, como markdown. */
function linkLabel(content: string, n: MdNode): string {
  const kids = n.children ?? [];
  if (!kids.length) return '';
  const inner = content.slice(off(kids[0], 'start'), off(kids[kids.length - 1], 'end'));
  return inner
    .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

function attrValue(n: MdNode, name: string): string | null {
  const a = n.attributes?.find((x) => x.type === 'mdxJsxAttribute' && x.name === name);
  return typeof a?.value === 'string' ? a.value : null;
}

export function importMdx(rawFile: string, fallbackTitle: string): ImportResult {
  const warnings: string[] = [];
  const raw = rawFile.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  if (!raw.trim()) {
    return {
      content: {title: fallbackTitle, description: null, frontmatter: {}, infobox: null, body: ''},
      imports: [],
      warnings: ['archivo vacío'],
      empty: true,
    };
  }

  const fm = parseFrontmatter(raw);
  const data = {...(fm.data as Record<string, unknown>)};
  const content = fm.content;
  const tree = parser.parse(content) as unknown as MdNode;

  const edits: Edit[] = [];
  const imports: string[] = [];
  let infobox: Infobox | null = null;
  const consumed: [number, number][] = [];
  const inConsumed = (s: number) => consumed.some(([a, b]) => s >= a && s < b);

  const top = (tree.children ?? []) as MdNode[];
  const meaningful = top.filter((n) => n.type !== 'mdxjsEsm');

  for (const n of top) {
    if (n.type === 'mdxjsEsm') {
      imports.push(...String(n.value).split('\n').filter((l) => l.trim()));
      edits.push({start: off(n, 'start'), end: off(n, 'end'), text: ''});
    }
  }

  // Primera Infobox de nivel superior (envuelta o no en BrowserOnly).
  for (const n of top) {
    if (infobox || n.type !== 'mdxJsxFlowElement') continue;
    const isBrowserOnly = n.name === 'BrowserOnly';
    if (!isBrowserOnly && n.name !== 'Infobox') continue;
    const s = off(n, 'start');
    const e = off(n, 'end');
    const src = content.slice(s, e);
    const at = src.indexOf('<Infobox');
    if (at === -1) continue;
    if (isBrowserOnly && !/^\s*\{\s*\(\)\s*=>\s*\(?\s*$/m.test(src.slice(src.indexOf('>') + 1, at))) {
      warnings.push('BrowserOnly con forma inesperada; la ficha se deja en el cuerpo');
      continue;
    }
    try {
      const props = parseInfoboxJsx(src, at);
      const idx = meaningful.indexOf(n);
      const prev = idx > 0 ? meaningful[idx - 1] : null;
      let placement: InfoboxPlacement;
      if (idx === 0) placement = 'inicio';
      else if (idx === 1 && prev?.type === 'heading' && prev.depth === 1) placement = 'tras-titulo';
      else placement = 'marcador';
      infobox = {...props, placement, browserOnly: isBrowserOnly};
      edits.push({start: s, end: e, text: placement === 'marcador' ? INFOBOX_MARKER : ''});
      consumed.push([s, e]);
    } catch (err) {
      if (err instanceof UnsupportedJsx) warnings.push(`Infobox no convertida (${err.message}); se deja en el cuerpo`);
      else throw err;
    }
  }

  // <Link to> en línea → markdown.
  visit(tree as unknown as Parent, (node) => {
    const n = node as MdNode;
    if (n.type !== 'mdxJsxTextElement' || n.name !== 'Link') return;
    const s = off(n, 'start');
    if (inConsumed(s)) return;
    const to = attrValue(n, 'to');
    if (!to || (n.attributes?.length ?? 0) !== 1) {
      warnings.push('Link con atributos no convertibles; se deja como JSX');
      return;
    }
    const label = linkLabel(content, n);
    if (/<[A-Za-z]/.test(label) || /\]\(/.test(label)) {
      warnings.push(`Link con contenido complejo; se deja como JSX: ${label.slice(0, 40)}`);
      return;
    }
    edits.push({start: s, end: off(n, 'end'), text: `[${label}](${canonicalUrl(to)})`});
  });

  // Saltos de línea forzados ("  \n" o "\\\n") → <br />: se renderizan igual, y el editor
  // visual (MDXEditor) conserva <br /> pero pierde los dos espacios al re-serializar.
  visit(tree as unknown as Parent, (node) => {
    const n = node as MdNode;
    if (n.type !== 'break') return;
    const s = off(n, 'start');
    if (inConsumed(s)) return;
    edits.push({start: s, end: off(n, 'end'), text: '<br />\n'});
  });

  edits.sort((a, b) => b.start - a.start);
  let body = content;
  for (const ed of edits) body = body.slice(0, ed.start) + ed.text + body.slice(ed.end);
  // Limpieza de líneas que solo quedaron vacías por quitar imports o la ficha.
  body = body.replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n');
  if (infobox && (infobox as Infobox).placement === 'tras-titulo') {
    body = body.replace(/^(#[ \t][^\n]*\n)\n+/, '$1\n');
  }

  const title =
    (typeof data.title === 'string' && data.title.trim()) || firstHeadingText(body) || fallbackTitle;
  const description = typeof data.description === 'string' ? data.description : null;
  delete data.title;
  delete data.description;

  return {content: {title, description, frontmatter: data, infobox, body}, imports, warnings, empty: false};
}
