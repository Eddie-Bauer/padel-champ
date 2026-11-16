import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLES, fetchAll, counts } from '../scripts/backup.mjs';

const respond = (ok, body) => async () => ({ ok, status: ok ? 200 : 500, json: async () => body });

test('TABLES lists the eight tables', () => {
  assert.deepEqual(TABLES, ['players', 'seasons', 'events', 'event_players', 'teams', 'matches', 'bye_map', 'settings']);
});

test('fetchAll returns one array per table', async () => {
  const data = await fetchAll(respond(true, [{ id: 1 }]), 'https://x.test', 'k');
  assert.deepEqual(Object.keys(data), TABLES);
  for (const t of TABLES) assert.deepEqual(data[t], [{ id: 1 }]);
});

test('fetchAll sends the key and asks for the table', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push([url, opts.headers.apikey]); return { ok: true, json: async () => [] }; };
  await fetchAll(fetchFn, 'https://x.test', 'k');
  assert.deepEqual(calls[0], ['https://x.test/rest/v1/players?select=*', 'k']);
  assert.equal(calls.length, 8);
});

test('fetchAll rejects when a response is not ok', async () => {
  await assert.rejects(fetchAll(respond(false, []), 'https://x.test', 'k'));
});

test('fetchAll rejects when the body is not an array', async () => {
  await assert.rejects(fetchAll(respond(true, { message: 'paused' }), 'https://x.test', 'k'));
});

test('counts gives rows per table', () => {
  assert.deepEqual(counts({ players: [{}, {}], seasons: [] }), { players: 2, seasons: 0 });
});
