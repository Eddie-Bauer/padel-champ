import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TABLES, fetchAll, counts, describeError } from '../scripts/backup.mjs';

const stateOf = rows => Object.fromEntries(TABLES.map(t => [t, rows]));
const respond = (status, body) => async () => ({ ok: status === 200, status, json: async () => body });

test('TABLES lists the eight tables', () => {
  assert.deepEqual(TABLES, ['players', 'seasons', 'events', 'event_players', 'teams', 'matches', 'bye_map', 'settings']);
});

test('fetchAll returns one array per table', async () => {
  const data = await fetchAll(respond(200, { role: 'admin', state: stateOf([{ id: 1 }]) }), 'https://x.test/api', 'k');
  assert.deepEqual(Object.keys(data), TABLES);
  for (const t of TABLES) assert.deepEqual(data[t], [{ id: 1 }]);
});

test('fetchAll asks the api function for the state, with the key in the header', async () => {
  const calls = [];
  const fetchFn = async (url, opts) => { calls.push([url, opts.method, opts.headers['x-pc-key'], opts.body]); return { ok: true, status: 200, json: async () => ({ state: stateOf([]) }) }; };
  await fetchAll(fetchFn, 'https://x.test/api', 'k');
  assert.deepEqual(calls, [['https://x.test/api', 'POST', 'k', '{"action":"state"}']]);
});

test('fetchAll rejects a refused key', async () => {
  await assert.rejects(fetchAll(respond(401, { error: 'unauthorized' }), 'https://x.test/api', 'k'), /401/);
});

test('fetchAll rejects when a response is not ok', async () => {
  await assert.rejects(fetchAll(respond(500, {}), 'https://x.test/api', 'k'));
});

test('fetchAll rejects when a table is missing or not a list', async () => {
  await assert.rejects(fetchAll(respond(200, { state: { players: [] } }), 'https://x.test/api', 'k'));
  await assert.rejects(fetchAll(respond(200, { message: 'paused' }), 'https://x.test/api', 'k'));
});

test('describeError names the network cause and hints at a paused project', () => {
  const err = Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  const text = describeError(err);
  assert.match(text, /ENOTFOUND/);
  assert.match(text, /pausiert|paused/i);
});

test('describeError passes other errors through', () => {
  assert.equal(describeError(new Error('players: HTTP 500')), 'players: HTTP 500');
});

test('counts gives rows per table', () => {
  assert.deepEqual(counts({ players: [{}, {}], seasons: [] }), { players: 2, seasons: 0 });
});
