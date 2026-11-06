/**
 * Carga data/snapshot.json en Supabase (usa la clave secreta: solo en tu equipo).
 *
 *   npx tsx --env-file=.env.local scripts/load-snapshot.ts [--reset] [--snapshot ruta]
 *
 * --reset borra antes todo el contenido (no toca usuarios ni administradores).
 */
import fs from 'node:fs';
import path from 'node:path';
import {createClient} from '@supabase/supabase-js';
import type {Snapshot} from '../src/lib/content/snapshot';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !secret) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SECRET_KEY en .env.local');

const db = createClient(url, secret, {auth: {persistSession: false}});
const i = process.argv.indexOf('--snapshot');
const snapPath = i === -1 ? path.join(__dirname, '..', 'data', 'snapshot.json') : process.argv[i + 1];
const snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')) as Snapshot;

async function insert(table: string, rows: object[], chunk = 50) {
  for (let k = 0; k < rows.length; k += chunk) {
    const {error} = await db.from(table).insert(rows.slice(k, k + chunk));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function main() {
  if (process.argv.includes('--reset')) {
    // Orden inverso de dependencias; la columna es cualquiera no nula (PostgREST exige un filtro en DELETE).
    const KEY: [string, string][] = [
      ['article_links', 'from_id'], ['article_revisions', 'id'], ['sidebar_items', 'id'], ['graph_configs', 'universe_id'],
      ['timeline_entries', 'id'], ['timeline_lanes', 'id'], ['books', 'id'], ['articles', 'id'], ['categories', 'id'],
      ['universes', 'id'], ['site_settings', 'id'], ['deploys', 'id'],
    ];
    for (const [t, col] of KEY) {
      const {error} = await db.from(t).delete().not(col, 'is', null);
      if (error) throw new Error(`reset ${t}: ${error.message}`);
    }
    console.log('Contenido anterior borrado.');
  }

  console.log('Cargando…');
  await insert('universes', snap.universes);
  await insert('categories', snap.categories);
  const now = new Date().toISOString();
  await insert(
    'articles',
    snap.articles.map((a) => ({...a, published_at: a.status === 'publicado' ? now : null})),
    20,
  );
  await insert('article_links', snap.article_links, 500);
  await insert('sidebar_items', snap.sidebar_items);
  await insert('books', snap.books);
  await insert('graph_configs', snap.graph_configs);
  await insert('timeline_lanes', snap.timeline_lanes);
  await insert('timeline_entries', snap.timeline_entries);
  const {error} = await db.from('site_settings').upsert({id: true, data: snap.site_settings});
  if (error) throw new Error(`site_settings: ${error.message}`);
  console.log('  site_settings: 1\nListo.');
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
