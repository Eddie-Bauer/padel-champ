// Exports every table to a local JSON file in backups/ (ignored by git).
// Prints row counts only, never row contents.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// Same public values the app ships in index.html.
const SB_URL = 'https://yldwlgeabmwdjefeerpr.supabase.co';
const SB_KEY = 'sb_publishable_mrL1kVUYLjoiyKJMtJ20KA_ZRelO6BC';

export const TABLES = ['players', 'seasons', 'events', 'event_players', 'teams', 'matches', 'bye_map', 'settings'];

export async function fetchAll(fetchFn, baseUrl, key) {
  const headers = { apikey: key, Authorization: 'Bearer ' + key };
  const data = {};
  for (const table of TABLES) {
    const res = await fetchFn(`${baseUrl}/rest/v1/${table}?select=*`, { headers });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status}`);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error(`${table}: unexpected answer, not a list of rows`);
    data[table] = rows;
  }
  return data;
}

export const counts = data => Object.fromEntries(Object.entries(data).map(([t, rows]) => [t, rows.length]));

const stamp = d => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const data = await fetchAll(fetch, SB_URL, SB_KEY);
    const dir = resolve(fileURLToPath(new URL('..', import.meta.url)), 'backups');
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `padelchamp-${stamp(new Date())}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2));
    for (const [table, n] of Object.entries(counts(data))) console.log(`${table}: ${n}`);
    console.log(file);
  } catch (e) {
    console.error('Backup failed, nothing written: ' + e.message);
    process.exit(1);
  }
}
