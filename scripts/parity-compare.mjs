/**
 * Compara dos builds de El Códice (original vs. exportado desde la base de datos).
 *
 *   node scripts/parity-compare.mjs <build-original> <build-nuevo> [--ignore <prefijo>...]
 *
 * Por cada página compara el texto visible de <article> (o <main>), los href de los enlaces
 * y la lista de rutas. Imprime las diferencias y un resumen.
 */
import fs from 'node:fs';
import path from 'node:path';

const [a, b] = process.argv.slice(2, 4);
const ignore = process.argv.flatMap((x, i, arr) => (arr[i - 1] === '--ignore' ? [x] : []));

function pages(root) {
  const out = new Map();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'index.html') out.set(path.relative(root, dir).split(path.sep).join('/'), p);
    }
  };
  walk(root);
  return out;
}

function decode(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'");
}

function extract(html) {
  const m = /<article[\s\S]*?<\/article>/.exec(html) ?? /<main[\s\S]*?<\/main>/.exec(html);
  const chunk = m ? m[0] : html;
  const hrefs = [...chunk.matchAll(/<a [^>]*href="([^"]*)"/g)].map((x) => {
    try {
      return decodeURIComponent(decode(x[1]));
    } catch {
      return decode(x[1]);
    }
  });
  const text = decode(
    chunk
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
  const title = /<title[^>]*>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
  return {text, hrefs, title: decode(title)};
}

const A = pages(a);
const B = pages(b);
const skip = (r) => ignore.some((p) => r.startsWith(p));
const onlyA = [...A.keys()].filter((r) => !B.has(r) && !skip(r));
const onlyB = [...B.keys()].filter((r) => !A.has(r) && !skip(r));
let same = 0;
const diffs = [];
for (const [route, fa] of A) {
  if (!B.has(route) || skip(route)) continue;
  const x = extract(fs.readFileSync(fa, 'utf8'));
  const y = extract(fs.readFileSync(B.get(route), 'utf8'));
  const problems = [];
  if (x.title !== y.title) problems.push(`título: "${x.title}" ≠ "${y.title}"`);
  if (x.text !== y.text) {
    let i = 0;
    while (i < x.text.length && x.text[i] === y.text[i]) i++;
    problems.push(`texto difiere en ${i}: «…${x.text.slice(Math.max(0, i - 40), i + 60)}» vs «…${y.text.slice(Math.max(0, i - 40), i + 60)}»`);
  }
  if (x.hrefs.join('|') !== y.hrefs.join('|')) {
    const sa = new Set(x.hrefs);
    const sb = new Set(y.hrefs);
    problems.push(`enlaces: -[${[...sa].filter((h) => !sb.has(h)).join(', ')}] +[${[...sb].filter((h) => !sa.has(h)).join(', ')}] (orden/cantidad ${x.hrefs.length}→${y.hrefs.length})`);
  }
  if (problems.length) diffs.push({route, problems});
  else same++;
}

for (const d of diffs) console.log(`✗ /${d.route}\n   ${d.problems.join('\n   ')}`);
console.log(`\nSolo en original (${onlyA.length}): ${onlyA.join(', ')}`);
console.log(`Solo en nuevo (${onlyB.length}): ${onlyB.join(', ')}`);
console.log(`\nPáginas idénticas: ${same} · con diferencias: ${diffs.length}`);
