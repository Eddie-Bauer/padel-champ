// Exports every table to a local JSON file in backups/ (ignored by git).
// Prints row counts only, never row contents.
//
// Usage:  PC_KEY=<your admin or player key> node scripts/backup.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const API_URL = 'https://yldwlgeabmwdjefeerpr.supabase.co/functions/v1/api';

export const TABLES = ['players', 'seasons', 'events', 'event_players', 'teams', 'matches', 'bye_map', 'settings'];

// Reads the whole database through the api function.
export async function fetchAll(fetchFn, apiUrl, key) {
  const res = await fetchFn(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-pc-key': key },
    body: JSON.stringify({ action: 'state' }),
  });
  if (res.status === 401) throw new Error('Key wurde abgelehnt (HTTP 401)');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const state = body && body.state;
  const data = {};
  for (const table of TABLES) {
    if (!state || !Array.isArray(state[table])) throw new Error(`${table}: unexpected answer, not a list of rows`);
    data[table] = state[table];
  }
  return data;
}

export const counts = data => Object.fromEntries(Object.entries(data).map(([t, rows]) => [t, rows.length]));

// "fetch failed" alone says nothing; the reason sits in err.cause.
export const describeError = err => {
  const code = err?.cause?.code || err?.cause?.message;
  if (!code) return err.message;
  return `${err.message} (${code}). Der Server ist nicht erreichbar. ` +
    'Häufigster Grund: das Supabase-Projekt ist pausiert. Im Supabase-Dashboard prüfen.';
};

const stamp = d => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const key = process.env.PC_KEY;
    if (!key) throw new Error('Kein Key. Aufruf: PC_KEY=<dein Key> node scripts/backup.mjs');
    const data = await fetchAll(fetch, API_URL, key);
    const dir = resolve(fileURLToPath(new URL('..', import.meta.url)), 'backups');
    mkdirSync(dir, { recursive: true });
    const file = resolve(dir, `padelchamp-${stamp(new Date())}.json`);
    writeFileSync(file, JSON.stringify(data, null, 2));
    for (const [table, n] of Object.entries(counts(data))) console.log(`${table}: ${n}`);
    console.log(file);
  } catch (e) {
    console.error('Backup failed, nothing written: ' + describeError(e));
    process.exit(1);
  }
}
