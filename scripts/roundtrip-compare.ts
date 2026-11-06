/**
 * Compara cuerpos originales con su versión re-serializada por MDXEditor (ida y vuelta).
 * Si el árbol mdast (sin posiciones, espacios normalizados) coincide, el sitio renderiza igual.
 *
 *   npx tsx scripts/roundtrip-compare.ts <roundtrip.json> [snapshot.json]
 */
import fs from 'node:fs';
import path from 'node:path';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import {unified} from 'unified';
import type {Snapshot} from '../src/lib/content/snapshot';

const [resultsPath, snapPath = path.join(__dirname, '..', 'data', 'snapshot.json')] = process.argv.slice(2);
const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as {id: string; slug: string; out: string}[];
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as Snapshot;
const parser = unified().use(remarkParse).use(remarkMdx);

type N = {type: string; [k: string]: unknown};

/**
 * *[x](u)* y [*x*](u) se ven igual (cursiva enlazada); MDXEditor escribe la segunda forma.
 * Se reescribe énfasis/negrita que envuelve un único enlace como enlace que envuelve el énfasis.
 */
function swapEmphasisLink(node: N): N {
  const kids = node.children as N[] | undefined;
  if ((node.type === 'emphasis' || node.type === 'strong') && kids?.length === 1 && kids[0].type === 'link') {
    const link = kids[0];
    return {...link, children: [{type: node.type, children: link.children}]};
  }
  return node;
}

/**
 * Contenido en línea como secuencia de tramos (texto + marcas). Es lo que ve el lector:
 * **[a](u):** y [**a**](u)**:** producen los mismos tramos (a: negrita+enlace, ":": negrita).
 */
type Run = {t?: string; marks?: string; jsx?: string};
function inlineRuns(nodes: N[], marks: string[] = [], out: Run[] = []): Run[] {
  for (const n of nodes) {
    if (n.type === 'text' || n.type === 'inlineCode') {
      const m = [...marks, ...(n.type === 'inlineCode' ? ['code'] : [])].sort().join('+');
      const prev = out[out.length - 1];
      if (prev && prev.t !== undefined && prev.marks === m) prev.t += String(n.value);
      else out.push({t: String(n.value), marks: m});
    } else if (n.type === 'emphasis' || n.type === 'strong' || n.type === 'delete') {
      inlineRuns(n.children as N[], [...marks, n.type], out);
    } else if (n.type === 'link') {
      inlineRuns(n.children as N[], [...marks, `link:${decodeURI(String(n.url))}`], out);
    } else {
      // JSX en línea (<br />, <Link>…), imágenes, etc.: se comparan por nombre y atributos.
      out.push({jsx: JSON.stringify(normalize(n))});
    }
  }
  for (const r of out) if (r.t !== undefined) r.t = r.t.replace(/\s+/g, ' ');
  return out;
}

/** Árbol comparable: sin posiciones/estree, texto con espacios colapsados, textos contiguos fusionados. */
function normalize(input: N): unknown {
  const node = swapEmphasisLink(input);
  if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'tableCell') {
    const runs = inlineRuns(node.children as N[]);
    if (runs[0]?.t !== undefined) runs[0].t = runs[0].t.trimStart();
    const last = runs[runs.length - 1];
    if (last?.t !== undefined) last.t = last.t.trimEnd();
    // Por carácter visible: cada carácter con sus marcas; los espacios sin marcas
    // (un espacio en negrita se ve igual que uno normal).
    const glyphs: string[] = [];
    for (const r of runs) {
      if (r.jsx !== undefined) {
        glyphs.push(r.jsx);
        continue;
      }
      for (const ch of r.t ?? '') {
        if (/\s/.test(ch)) {
          if (glyphs[glyphs.length - 1] !== ' ') glyphs.push(' ');
        } else glyphs.push(`${ch}·${r.marks}`);
      }
    }
    while (glyphs[0] === ' ') glyphs.shift();
    while (glyphs[glyphs.length - 1] === ' ') glyphs.pop();
    return {type: node.type, depth: node.depth, glyphs: glyphs.join('|')};
  }
  const out: Record<string, unknown> = {type: node.type};
  for (const [k, v] of Object.entries(node)) {
    if (k === 'position' || k === 'data' || k === 'type' || k === 'spread') continue;
    if (k === 'children') continue;
    if (k === 'value' && typeof v === 'string') out.value = v.replace(/\s+/g, ' ').trim();
    else if (k === 'attributes' && Array.isArray(v))
      out.attributes = v.map((a: N) => ({
        name: a.name,
        value: typeof a.value === 'object' && a.value ? String((a.value as {value: string}).value).replace(/\s+/g, ' ').trim() : a.value,
      }));
    else out[k] = v;
  }
  if (Array.isArray(node.children)) {
    const kids: unknown[] = [];
    for (const c of node.children as N[]) {
      const n = normalize(c) as {type: string; value?: string};
      const prev = kids[kids.length - 1] as {type: string; value?: string} | undefined;
      if (n.type === 'text' && prev?.type === 'text') prev.value = `${prev.value} ${n.value}`.replace(/\s+/g, ' ').trim();
      else if (!(n.type === 'text' && !n.value)) kids.push(n);
    }
    out.children = kids;
  }
  return out;
}

function firstDiff(a: unknown, b: unknown, p = ''): string | null {
  if (JSON.stringify(a) === JSON.stringify(b)) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return `${p}: ${JSON.stringify(a)?.slice(0, 120)} ≠ ${JSON.stringify(b)?.slice(0, 120)}`;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const d = firstDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${p}.${k}`);
    if (d) return d;
  }
  return `${p}: distinto`;
}

const byId = new Map(results.map((r) => [r.id, r]));
let same = 0;
const diffs: string[] = [];
for (const a of snap.articles.filter((x) => x.status === 'publicado')) {
  const r = byId.get(a.id);
  if (!r) {
    diffs.push(`${a.slug}: sin resultado`);
    continue;
  }
  const x = normalize(parser.parse(a.body) as unknown as N);
  const y = normalize(parser.parse(r.out) as unknown as N);
  const d = firstDiff(x, y);
  if (d) diffs.push(`${a.slug}: ${d}`);
  else same++;
}
console.log(diffs.join('\n'));
console.log(`\nIdénticos (mdast): ${same} · distintos: ${diffs.length}`);
