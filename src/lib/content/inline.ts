/**
 * Markdown en línea (subconjunto) ⇄ JSX, para los valores de la Infobox.
 *
 * Subconjunto admitido: texto, `\x` (escape), `*cursiva*`, `**negrita**`, `[texto](url)`.
 */

/** Rutas internas canónicas: espacios y paréntesis codificados, acentos legibles. */
export function canonicalUrl(raw: string): string {
  let url = raw.trim();
  try {
    url = decodeURI(url.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  } catch {
    /* se queda tal cual */
  }
  return url.replace(/ /g, '%20').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/** Ruta decodificada (para comparar con rutas de artículos). */
export function decodedPath(url: string): string {
  let p = url.replace(/[#?].*$/, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* ignore */
  }
  return p.replace(/\/+$/, '') || '/';
}

const MD_SPECIAL = /([\\`*_[\]<>{}])/g;

export function escapeMarkdownText(text: string): string {
  return text.replace(MD_SPECIAL, '\\$1');
}

// ─────────────────────────── Markdown en línea → árbol ───────────────────────────

export type InlineNode =
  | {type: 'text'; value: string}
  | {type: 'em'; children: InlineNode[]}
  | {type: 'strong'; children: InlineNode[]}
  | {type: 'link'; url: string; children: InlineNode[]};

export function parseInline(src: string): InlineNode[] {
  let i = 0;

  function parseUntil(stop: string | null): InlineNode[] {
    const out: InlineNode[] = [];
    let buf = '';
    const flush = () => {
      if (buf) out.push({type: 'text', value: buf});
      buf = '';
    };
    while (i < src.length) {
      if (stop && src.startsWith(stop, i)) return (flush(), out);
      const ch = src[i];
      if (ch === '\\' && i + 1 < src.length) {
        buf += src[i + 1];
        i += 2;
      } else if (src.startsWith('**', i) && stop !== '*') {
        const close = src.indexOf('**', i + 2);
        if (close === -1) {
          buf += '**';
          i += 2;
          continue;
        }
        flush();
        i += 2;
        const children = parseUntil('**');
        i += 2;
        out.push({type: 'strong', children});
      } else if (ch === '*' && !src.startsWith('**', i)) {
        if (src.indexOf('*', i + 1) === -1) {
          buf += ch;
          i++;
          continue;
        }
        flush();
        i += 1;
        const children = parseUntil('*');
        i += 1;
        out.push({type: 'em', children});
      } else if (ch === '[') {
        const end = findLinkEnd(src, i);
        if (!end) {
          buf += ch;
          i++;
          continue;
        }
        flush();
        const label = src.slice(i + 1, end.labelEnd);
        const saved = i;
        const inner = parseInlineSub(label);
        out.push({type: 'link', url: end.url, children: inner});
        i = end.next;
        void saved;
      } else {
        buf += ch;
        i++;
      }
    }
    flush();
    return out;
  }

  return parseUntil(null);
}

function parseInlineSub(s: string): InlineNode[] {
  return parseInline(s);
}

function findLinkEnd(src: string, start: number): {labelEnd: number; url: string; next: number} | null {
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') {
      j++;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) {
        if (src[j + 1] !== '(') return null;
        const close = src.indexOf(')', j + 2);
        if (close === -1) return null;
        let url = src.slice(j + 2, close).trim();
        if (url.startsWith('<') && url.endsWith('>')) url = url.slice(1, -1);
        return {labelEnd: j, url, next: close + 1};
      }
    }
  }
  return null;
}

export function inlineLinks(src: string): string[] {
  const urls: string[] = [];
  const walk = (nodes: InlineNode[]) => {
    for (const n of nodes) {
      if (n.type === 'link') urls.push(n.url);
      if (n.type !== 'text') walk(n.children);
    }
  };
  walk(parseInline(src));
  return urls;
}

// ─────────────────────────── Árbol → JSX ───────────────────────────

function jsxText(text: string): string {
  return text.replace(/[{}<>]/g, (c) => `{'${c}'}`);
}

function toJsx(nodes: InlineNode[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
          return jsxText(n.value);
        case 'link':
          return `<Link to=${JSON.stringify(canonicalUrl(n.url))}>${toJsx(n.children)}</Link>`;
        default:
          return `<${n.type}>${toJsx(n.children)}</${n.type}>`;
      }
    })
    .join('');
}

/** Valor de fila de Infobox como expresión JS (string literal o fragmento JSX en una línea). */
export function inlineToJsxExpression(src: string): string {
  const nodes = parseInline(src);
  if (nodes.every((n) => n.type === 'text')) {
    return JSON.stringify(nodes.map((n) => (n as {value: string}).value).join(''));
  }
  return `(<>${toJsx(nodes)}</>)`;
}

// ─────────────────────────── JSX (estree) → markdown en línea ───────────────────────────

/** Limpieza de texto JSX idéntica a la de Babel (cleanJSXElementLiteralChild). */
export function cleanJsxText(value: string): string {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmptyLine = 0;
  for (let i = 0; i < lines.length; i++) if (/[^ \t]/.test(lines[i])) lastNonEmptyLine = i;
  let str = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isFirstLine = i === 0;
    const isLastLine = i === lines.length - 1;
    const isLastNonEmptyLine = i === lastNonEmptyLine;
    let trimmed = line.replace(/\t/g, ' ');
    if (!isFirstLine) trimmed = trimmed.replace(/^[ ]+/, '');
    if (!isLastLine) trimmed = trimmed.replace(/[ ]+$/, '');
    if (trimmed) {
      if (!isLastNonEmptyLine) trimmed += ' ';
      str += trimmed;
    }
  }
  return str;
}

type JsxNode = {
  type: string;
  [k: string]: unknown;
};

export class UnsupportedJsx extends Error {}

function elementName(n: JsxNode): string {
  const opening = n.openingElement as JsxNode;
  const name = opening.name as JsxNode;
  if (name.type === 'JSXIdentifier') return name.name as string;
  throw new UnsupportedJsx(`nombre JSX no soportado: ${name.type}`);
}

function attrString(n: JsxNode, attr: string): string | undefined {
  const opening = n.openingElement as JsxNode;
  for (const a of opening.attributes as JsxNode[]) {
    if (a.type !== 'JSXAttribute') continue;
    if ((a.name as JsxNode).name !== attr) continue;
    const v = a.value as JsxNode | null;
    if (!v) return '';
    if (v.type === 'Literal') return String(v.value);
    if (v.type === 'JSXExpressionContainer') {
      const e = v.expression as JsxNode;
      if (e.type === 'Literal') return String(e.value);
      if (e.type === 'TemplateLiteral' && (e.expressions as unknown[]).length === 0) {
        return ((e.quasis as JsxNode[])[0].value as {cooked: string}).cooked;
      }
    }
    throw new UnsupportedJsx(`atributo ${attr} no literal`);
  }
  return undefined;
}

function childrenToInline(children: JsxNode[]): string {
  return children.map(jsxToInline).join('');
}

/** Convierte un nodo JSX (estree) al subconjunto de markdown en línea. */
export function jsxToInline(n: JsxNode): string {
  switch (n.type) {
    case 'JSXText':
      return escapeMarkdownText(cleanJsxText(n.value as string));
    case 'JSXExpressionContainer': {
      const e = n.expression as JsxNode;
      if (e.type === 'JSXEmptyExpression') return '';
      if (e.type === 'Literal' && typeof e.value === 'string') return escapeMarkdownText(e.value);
      if (e.type === 'TemplateLiteral' && (e.expressions as unknown[]).length === 0) {
        return escapeMarkdownText(((e.quasis as JsxNode[])[0].value as {cooked: string}).cooked);
      }
      throw new UnsupportedJsx(`expresión no soportada: ${e.type}`);
    }
    case 'JSXFragment':
      return childrenToInline(n.children as JsxNode[]);
    case 'JSXElement': {
      const name = elementName(n);
      const inner = childrenToInline(n.children as JsxNode[]);
      if (name === 'Link' || name === 'a') {
        const to = attrString(n, name === 'Link' ? 'to' : 'href');
        if (!to) throw new UnsupportedJsx('Link sin destino');
        return `[${inner}](${canonicalUrl(to)})`;
      }
      if (name === 'em' || name === 'i') return `*${inner}*`;
      if (name === 'strong' || name === 'b') return `**${inner}**`;
      throw new UnsupportedJsx(`elemento no soportado en valor de Infobox: <${name}>`);
    }
    default:
      throw new UnsupportedJsx(`nodo no soportado: ${n.type}`);
  }
}
