// The client's side of the server contract: roles, saving, retry, refresh.
// Each scenario loads a fresh copy of store.js against a fake server.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { toRows } from '../js/sync.js';

const data = () => ({
  players: [1, 2, 3, 4].map(n => ({ id: 'p' + n, name: 'P' + n, isActive: true })),
  seasons: [{ id: 's1', name: 'Test', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true }],
  events: [{ id: 'e1', sid: 's1', date: '2026-06-01', name: 'Tag', status: 'active' }],
  evP: [],
  teams: [{ id: 't1', eid: 'e1', rnd: 1, player1Id: 'p1', player2Id: 'p2', name: 'a' }, { id: 't2', eid: 'e1', rnd: 1, player1Id: 'p3', player2Id: 'p4', name: 'b' }],
  matches: [{ id: 'm1', eid: 'e1', team1Id: 't1', team2Id: 't2', rnd: 1, seq: 1, t1s1: null, t2s1: null, t1s2: null, t2s2: null, t1s3: null, t2s3: null, winnerTeamId: null, status: 'scheduled' }],
  byeMap: {},
  settings: { ptsWin: 3, ptsLoss: 0 },
});

let n = 0;
// handler(body) -> {status, data} | throws (server unreachable)
const boot = async ({ key = 'k', stored = null, handler }) => {
  installFakeDom({ search: key ? '?key=' + key : '', stored });
  const calls = [], alerts = [];
  globalThis.alert = m => alerts.push(m);
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    calls.push({ url, key: opts.headers['x-pc-key'], body });
    const r = await handler(body, calls.length);
    return { ok: r.status === 200, status: r.status, json: async () => r.data };
  };
  const store = await import('../js/store.js?scenario=' + (++n));
  await store.loadRemote();
  return { store, calls, alerts };
};
const asRole = (role, rows = toRows(data())) => body =>
  body.action === 'state' ? { status: 200, data: { role, state: rows } } : { status: 200, data: { applied: body.ops.length } };
const opsCalls = calls => calls.filter(c => c.body.action === 'ops');
const tick = () => new Promise(r => setTimeout(r, 0));

test('no key: key screen, the server is never asked', async () => {
  const { store, calls } = await boot({ key: '', handler: asRole('admin') });
  assert.equal(store.ACCESS, 'nokey');
  assert.equal(calls.length, 0);
});

test('wrong key: rejected', async () => {
  const { store } = await boot({ handler: () => ({ status: 401, data: { error: 'unauthorized' } }) });
  assert.equal(store.ACCESS, 'badkey');
  assert.equal(store.IS_PLAYER, false);
});

test('the key travels in the x-pc-key header to the api function', async () => {
  const { calls } = await boot({ key: 'abc', handler: asRole('viewer') });
  assert.equal(calls[0].key, 'abc');
  assert.match(calls[0].url, /\/functions\/v1\/api$/);
  assert.deepEqual(calls[0].body, { action: 'state' });
});

test('server unreachable: local copy is shown, read-only', async () => {
  const { store, alerts } = await boot({ stored: data(), handler: () => { throw new Error('down'); } });
  assert.equal(store.ACCESS, 'offline');
  assert.equal(store.S.players.length, 4);
  store.mut(() => { store.S.players.pop(); });
  assert.equal(store.S.players.length, 4);
  assert.equal(alerts.length, 1);
});

test('viewer: sees data, cannot change it, sends nothing', async () => {
  const { store, calls } = await boot({ handler: asRole('viewer') });
  assert.equal(store.ACCESS, 'ok');
  assert.equal(store.S.players.length, 4);
  assert.equal(store.IS_PLAYER, false);
  store.mut(() => { store.S.players.pop(); });
  await tick();
  assert.equal(store.S.players.length, 4);
  assert.equal(opsCalls(calls).length, 0);
});

test('admin role sets both flags', async () => {
  const { store } = await boot({ handler: asRole('admin') });
  assert.equal(store.IS_ADMIN, true);
  assert.equal(store.IS_PLAYER, true);
});

test('player saves one score: exactly that row is sent', async () => {
  const { store, calls } = await boot({ handler: asRole('player') });
  store.mut(() => { const m = store.S.matches[0]; m.t1s1 = 6; m.t2s1 = 4; m.status = 'completed'; m.winnerTeamId = 't1'; });
  await tick();
  const ops = opsCalls(calls);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].body.ops.length, 1);
  assert.equal(ops[0].body.ops[0].t, 'matches');
  assert.equal(ops[0].body.ops[0].row.t1s1, 6);
  assert.equal(store.hasUnsaved(), false);
  assert.equal(JSON.parse(localStorage.getItem('padelchamp_v1')).matches[0].t1s1, 6);
});

test('a stale device never deletes what another device added', async () => {
  // The device loaded before match m2 existed on the server. It saves a score.
  const { store, calls } = await boot({ handler: asRole('player') });
  store.mut(() => { store.S.matches[0].t1s1 = 6; });
  await tick();
  const sent = opsCalls(calls).flatMap(c => c.body.ops);
  assert.deepEqual(sent.map(o => o.a), ['upsert']);
});

test('deleting the last match is sent as a delete', async () => {
  const { store, calls } = await boot({ handler: asRole('player') });
  store.mut(() => { store.S.matches = []; });
  await tick();
  assert.deepEqual(opsCalls(calls)[0].body.ops, [{ t: 'matches', a: 'delete', key: { id: 'm1' } }]);
});

test('save fails (network): banner, change kept, next attempt carries everything', async () => {
  let down = true;
  const ok = asRole('player');
  const { store, calls } = await boot({ handler: body => { if (body.action === 'ops' && down) throw new Error('down'); return ok(body); } });
  store.mut(() => { store.S.matches[0].t1s1 = 6; });
  await tick();
  assert.ok(store.SAVE_ERROR);
  assert.equal(store.hasUnsaved(), true);
  store.mut(() => { store.S.matches[0].t2s1 = 4; });
  await tick();
  down = false;
  await store.flush();
  assert.equal(store.SAVE_ERROR, null);
  assert.equal(store.hasUnsaved(), false);
  const last = opsCalls(calls).at(-1).body.ops;
  assert.equal(last.length, 1);
  assert.deepEqual([last[0].row.t1s1, last[0].row.t2s1], [6, 4]);
});

test('server refuses the change (403): it is dropped and the server state shown', async () => {
  const ok = asRole('player');
  const { store, alerts } = await boot({ handler: body => body.action === 'ops' ? { status: 403, data: { error: 'not allowed for this key' } } : ok(body) });
  store.mut(() => { store.S.players.pop(); });
  await tick(); await tick();
  assert.equal(store.S.players.length, 4);
  assert.equal(store.hasUnsaved(), false);
  assert.equal(store.SAVE_ERROR, null);
  assert.equal(alerts.length, 1);
});

test('refresh picks up changes from other devices', async () => {
  let rows = toRows(data());
  const { store } = await boot({ handler: body => asRole('player', rows)(body) });
  const next = data(); next.matches[0].t1s1 = 5;
  rows = toRows(next);
  let renders = 0; store.onChange(() => renders++);
  await store.refresh();
  assert.equal(store.S.matches[0].t1s1, 5);
  assert.equal(renders, 1);
  await store.refresh();
  assert.equal(renders, 1, 'no re-render when nothing changed');
});

test('refresh does not overwrite unsaved changes', async () => {
  const ok = asRole('player');
  const { store, calls } = await boot({ handler: body => { if (body.action === 'ops') throw new Error('down'); return ok(body); } });
  store.mut(() => { store.S.matches[0].t1s1 = 6; });
  await tick();
  const before = calls.length;
  await store.refresh();
  assert.equal(calls.length, before);
  assert.equal(store.S.matches[0].t1s1, 6);
});

test('offline at start recovers on refresh', async () => {
  let down = true;
  const ok = asRole('player');
  const { store } = await boot({ stored: data(), handler: body => { if (down) throw new Error('down'); return ok(body); } });
  assert.equal(store.ACCESS, 'offline');
  down = false;
  await store.refresh();
  assert.equal(store.ACCESS, 'ok');
  assert.equal(store.IS_PLAYER, true);
});

test('empty database: the app still has a season to show', async () => {
  const empty = toRows({ players: [], seasons: [], events: [], evP: [], teams: [], matches: [], byeMap: {}, settings: { ptsWin: 3, ptsLoss: 0 } });
  const { store } = await boot({ handler: asRole('admin', empty) });
  assert.equal(typeof store.activeSeason().name, 'string');
  assert.deepEqual(store.standings(), []);
});
