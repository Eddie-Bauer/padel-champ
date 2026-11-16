// The Edge Function, run under Node against a fake database.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, sha256Hex, checkOps, makeDb } from '../supabase/functions/api/index.ts';

const KEYS = { viewer: 'key-viewer', player: 'key-player', admin: 'key-admin' };
const envMap = {
  PC_VIEWER_HASH: await sha256Hex(KEYS.viewer),
  PC_PLAYER_HASH: await sha256Hex(KEYS.player),
  PC_ADMIN_HASH: await sha256Hex(KEYS.admin),
  GOOGLE_AI_KEY: 'g-key',
};
const env = (over = {}) => { const m = { ...envMap, ...over }; return { get: k => m[k] }; };

const fakeDb = (over = {}) => {
  const calls = [];
  const answers = { get_state: { players: [] }, apply_ops: 1, bump_ai_usage: true, ...over };
  return { calls, rpc: async (name, args) => { calls.push([name, args]); const a = answers[name]; if (a instanceof Error) throw a; return a; } };
};

const call = async (body, { key, method = 'POST', db = fakeDb(), e = env(), fetchFn, raw } = {}) => {
  const headers = { 'content-type': 'application/json' };
  if (key) headers['x-pc-key'] = key;
  const req = new Request('https://x.test/functions/v1/api', { method, headers, body: method === 'POST' ? (raw ?? JSON.stringify(body)) : undefined });
  const res = await handle(req, { env: e, db, fetchFn });
  let data = null; try { data = await res.json(); } catch {}
  return { status: res.status, data, db, res };
};

const upMatch = { t: 'matches', a: 'upsert', row: { id: 'm1', event_id: 'e1', t1s1: 6, t2s1: 4 } };

// ── access ──
test('OPTIONS answers the CORS preflight and allows the key header', async () => {
  const { status, res } = await call(null, { method: 'OPTIONS' });
  assert.equal(status, 200);
  assert.match(res.headers.get('access-control-allow-headers'), /x-pc-key/);
});

test('GET is refused', async () => {
  assert.equal((await call(null, { method: 'GET', key: KEYS.admin })).status, 405);
});

test('no key: 401 and the database is never asked', async () => {
  const r = await call({ action: 'state' });
  assert.equal(r.status, 401);
  assert.equal(r.db.calls.length, 0);
});

test('wrong key: 401', async () => {
  assert.equal((await call({ action: 'state' }, { key: 'nope' })).status, 401);
});

test('a missing or malformed hash secret never matches, not even an empty key', async () => {
  const e = env({ PC_ADMIN_HASH: undefined, PC_PLAYER_HASH: '', PC_VIEWER_HASH: 'abc' });
  for (const key of ['', 'abc', KEYS.admin]) assert.equal((await call({ action: 'state' }, { key, e })).status, 401);
});

test('body that is not JSON: 400', async () => {
  assert.equal((await call(null, { key: KEYS.admin, raw: '{nope' })).status, 400);
});

test('unknown action: 400', async () => {
  assert.equal((await call({ action: 'drop' }, { key: KEYS.admin })).status, 400);
});

// ── state ──
for (const role of ['viewer', 'player', 'admin']) {
  test(`${role} reads the state and learns the role`, async () => {
    const r = await call({ action: 'state' }, { key: KEYS[role] });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data, { role, state: { players: [] } });
    assert.deepEqual(r.db.calls, [['get_state', {}]]);
  });
}

// ── ops ──
test('viewer cannot write', async () => {
  const r = await call({ action: 'ops', ops: [upMatch] }, { key: KEYS.viewer });
  assert.equal(r.status, 403);
  assert.equal(r.db.calls.length, 0);
});

test('player writes a match', async () => {
  const r = await call({ action: 'ops', ops: [upMatch] }, { key: KEYS.player });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { applied: 1 });
  assert.deepEqual(r.db.calls, [['apply_ops', { ops: [upMatch] }]]);
});

test('player with one admin change in the batch: 403 and nothing is applied', async () => {
  const ops = [upMatch, { t: 'players', a: 'upsert', row: { id: 'p1', name: 'P1', is_active: true } }];
  const r = await call({ action: 'ops', ops }, { key: KEYS.player });
  assert.equal(r.status, 403);
  assert.equal(r.db.calls.length, 0);
});

test('player may create an event but not delete one', async () => {
  const up = { t: 'events', a: 'upsert', row: { id: 'e1', season_id: 's1', date: '2026-06-01', name: 'Tag', status: 'planned' } };
  assert.equal((await call({ action: 'ops', ops: [up] }, { key: KEYS.player })).status, 200);
  assert.equal((await call({ action: 'ops', ops: [{ t: 'events', a: 'delete', key: { id: 'e1' } }] }, { key: KEYS.player })).status, 403);
  assert.equal((await call({ action: 'ops', ops: [{ t: 'events', a: 'delete', key: { id: 'e1' } }] }, { key: KEYS.admin })).status, 200);
});

test('admin changes players, seasons and settings', async () => {
  const ops = [
    { t: 'players', a: 'upsert', row: { id: 'p1', name: 'P1', is_active: true } },
    { t: 'seasons', a: 'delete', key: { id: 's1' } },
    { t: 'settings', a: 'upsert', row: { id: 1, pts_win: 2, pts_loss: 0 } },
  ];
  assert.equal((await call({ action: 'ops', ops }, { key: KEYS.admin })).status, 200);
});

test('checkOps refuses malformed ops', () => {
  const bad = [
    'x',
    [{}],
    [{ t: 'pg_authid', a: 'delete', key: { id: '1' } }],
    [{ t: 'matches', a: 'truncate' }],
    [{ t: 'matches', a: 'upsert' }],
    [{ t: 'matches', a: 'upsert', row: { event_id: 'e1' } }],                 // key column missing
    [{ t: 'matches', a: 'upsert', row: { id: 'm1', evil: 1 } }],              // unknown column
    [{ t: 'matches', a: 'upsert', row: { id: 'm1', status: { x: 1 } } }],     // nested value
    [{ t: 'matches', a: 'delete', key: {} }],
    [{ t: 'matches', a: 'delete', key: { id: 'm1', extra: 1 } }],
    [{ t: 'bye_map', a: 'delete', key: { event_id: 'e1' } }],
    [{ t: 'settings', a: 'delete', key: { id: 1 } }],
  ];
  for (const ops of bad) {
    const r = checkOps('admin', ops);
    assert.equal(r.ok, false, JSON.stringify(ops));
    assert.equal(r.status, 400, JSON.stringify(ops));
  }
  assert.equal(checkOps('admin', []).ok, true);
});

test('malformed ops over HTTP: 400 and nothing is applied', async () => {
  const r = await call({ action: 'ops', ops: [{ t: 'matches', a: 'upsert', row: { id: 'm1', evil: 1 } }] }, { key: KEYS.admin });
  assert.equal(r.status, 400);
  assert.equal(r.db.calls.length, 0);
});

test('database failure: 500 with a message, no crash', async () => {
  const r = await call({ action: 'ops', ops: [upMatch] }, { key: KEYS.player, db: fakeDb({ apply_ops: new Error('foreign key') }) });
  assert.equal(r.status, 500);
  assert.equal(typeof r.data.error, 'string');
});

// ── analyze ──
const gemini = () => { const seen = []; const fetchFn = async (url, opts) => { seen.push([url, JSON.parse(opts.body)]); return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'hi' }] } }] }) }; }; return { seen, fetchFn }; };

test('viewer cannot use the AI analysis', async () => {
  assert.equal((await call({ action: 'analyze', prompt: 'x' }, { key: KEYS.viewer, fetchFn: gemini().fetchFn })).status, 403);
});

test('player gets the AI answer; the Google key stays on the server', async () => {
  const g = gemini();
  const r = await call({ action: 'analyze', prompt: 'Hallo' }, { key: KEYS.player, fetchFn: g.fetchFn });
  assert.equal(r.status, 200);
  assert.equal(r.data.candidates[0].content.parts[0].text, 'hi');
  assert.match(g.seen[0][0], /generativelanguage\.googleapis\.com.*key=g-key$/);
  assert.equal(g.seen[0][1].contents[0].parts[0].text, 'Hallo');
  assert.ok(!JSON.stringify(r.data).includes('g-key'));
  assert.deepEqual(r.db.calls, [['bump_ai_usage', { max_per_day: 40 }]]);
});

test('over the daily AI limit: 429 and Google is not called', async () => {
  const g = gemini();
  const r = await call({ action: 'analyze', prompt: 'x' }, { key: KEYS.player, db: fakeDb({ bump_ai_usage: false }), fetchFn: g.fetchFn });
  assert.equal(r.status, 429);
  assert.equal(g.seen.length, 0);
});

test('empty or oversized prompt: 400', async () => {
  const g = gemini();
  assert.equal((await call({ action: 'analyze', prompt: '' }, { key: KEYS.player, fetchFn: g.fetchFn })).status, 400);
  assert.equal((await call({ action: 'analyze', prompt: 'x'.repeat(20001) }, { key: KEYS.player, fetchFn: g.fetchFn })).status, 400);
});

// ── database client ──
test('makeDb calls the database function with the service key', async () => {
  const seen = [];
  const fetchFn = async (url, opts) => { seen.push([url, opts]); return { ok: true, json: async () => 7 }; };
  const db = makeDb({ get: k => ({ SUPABASE_URL: 'https://p.test', SUPABASE_SERVICE_ROLE_KEY: 'svc' })[k] }, fetchFn);
  assert.equal(await db.rpc('apply_ops', { ops: [] }), 7);
  assert.equal(seen[0][0], 'https://p.test/rest/v1/rpc/apply_ops');
  assert.equal(seen[0][1].headers.apikey, 'svc');
  assert.equal(seen[0][1].headers.Authorization, 'Bearer svc');
  assert.equal(seen[0][1].body, '{"ops":[]}');
});

test('makeDb throws when the database answers with an error', async () => {
  const fetchFn = async () => ({ ok: false, status: 409, json: async () => ({ message: 'violates foreign key' }) });
  const db = makeDb({ get: () => 'x' }, fetchFn);
  await assert.rejects(db.rpc('apply_ops', { ops: [] }), /violates foreign key/);
});
