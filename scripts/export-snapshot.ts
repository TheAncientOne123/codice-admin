/**
 * Escribe los artículos publicados de una instantánea como árbol docs/ (igual que el sync del CI).
 *
 *   npx tsx scripts/export-snapshot.ts --out <carpeta> [--snapshot data/snapshot.json] [--rerender]
 *
 * --rerender vuelve a generar el MDX desde los campos (prueba el renderizador actual).
 */
import fs from 'node:fs';
import path from 'node:path';
import {renderMdx} from '../src/lib/content/render';
import type {Snapshot} from '../src/lib/content/snapshot';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i === -1 ? undefined : process.argv[i + 1];
}

const out = arg('--out');
if (!out) throw new Error('Falta --out <carpeta>');
const snapPath = arg('--snapshot') ?? path.join(__dirname, '..', 'data', 'snapshot.json');
const rerender = process.argv.includes('--rerender');

const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as Snapshot;
let n = 0;
for (const a of snap.articles) {
  if (a.status !== 'publicado' || !a.published) continue;
  const file = path.join(out, a.published.path);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, rerender ? renderMdx(a.published) : a.published.mdx);
  n++;
}
console.log(`${n} artículos escritos en ${out}`);
