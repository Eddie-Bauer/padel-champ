import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, fromRows, diffOps } from '../js/sync.js';

const state = () => ({
  players: [{ id: '1', name: 'P1', isActive: true }, { id: '2', name: 'P2', isActive: false }],
  seasons: [{ id: 's1', name: 'Test', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true }],
  events: [{ id: 'e1', sid: 's1', date: '2026-06-01', name: 'Tag', status: 'active', format: 'padel_day', config: {} }],
  evP: [{ eid: 'e1', pid: '1' }, { eid: 'e1', pid: '2' }],
  teams: [{ id: 't1', eid: 'e1', rnd: 1, player1Id: '1', player2Id: '2', name: 'P1 / P2', grp: null }],
  matches: [{ id: 'm1', eid: 'e1', team1Id: 't1', team2Id: 't2', rnd: 1, seq: 1,
    t1s1: 6, t2s1: 4, t1s2: null, t2s2: null, t1s3: null, t2s3: null, winnerTeamId: 't1', status: 'completed', stage: null, court: null }],
  byeMap: { e1: { 1: '2', 2: null } },
  settings: { ptsWin: 3, ptsLoss: 0 },
});
const rows = (change) => { const s = state(); change?.(s); return toRows(s); };

test('toRows uses database column names', () => {
  const r = toRows(state());
  assert.deepEqual(r.players[1], { id: '2', name: 'P2', is_active: false });
  assert.deepEqual(r.events[0], { id: 'e1', season_id: 's1', date: '2026-06-01', name: 'Tag', status: 'active', format: 'padel_day', config: {} });
  assert.deepEqual(r.event_players[0], { event_id: 'e1', player_id: '1' });
  assert.deepEqual(r.bye_map, [{ event_id: 'e1', rnd: 1, player_id: '2' }]);
  assert.deepEqual(r.settings, [{ id: 1, pts_win: 3, pts_loss: 0 }]);
  assert.equal(r.matches[0].winner_team_id, 't1');
});

test('fromRows(toRows(state)) gives the state back', () => {
  const s = state();
  s.byeMap = { e1: { 1: '2' } }; // empty byes are not stored
  assert.deepEqual(fromRows(toRows(s)), s);
});

test('fromRows falls back to default points when settings are missing', () => {
  assert.deepEqual(fromRows({ ...toRows(state()), settings: [] }).settings, { ptsWin: 3, ptsLoss: 0 });
});

test('no change gives no ops', () => {
  assert.deepEqual(diffOps(rows(), rows()), []);
});

test('one changed score gives exactly one upsert of that match', () => {
  const ops = diffOps(rows(), rows(s => { s.matches[0].t1s1 = 7; }));
  assert.equal(ops.length, 1);
  assert.equal(ops[0].t, 'matches');
  assert.equal(ops[0].a, 'upsert');
  assert.equal(ops[0].row.t1s1, 7);
});

test('a stale phone does not delete rows it never knew', () => {
  // Phone B's last confirmed state and its current state both lack match m2
  // that phone A created meanwhile. B saves one score: only that row is sent.
  const ops = diffOps(rows(), rows(s => { s.matches[0].t2s1 = 5; }));
  assert.deepEqual(ops.map(o => o.a), ['upsert']);
});

test('removing the last match gives a delete', () => {
  const ops = diffOps(rows(), rows(s => { s.matches = []; }));
  assert.deepEqual(ops, [{ t: 'matches', a: 'delete', key: { id: 'm1' } }]);
});

test('participants and byes are keyed by their pair of columns', () => {
  const ops = diffOps(rows(), rows(s => { s.evP = [{ eid: 'e1', pid: '1' }]; s.byeMap = { e1: { 1: '1' } }; }));
  assert.deepEqual(ops, [
    { t: 'bye_map', a: 'upsert', row: { event_id: 'e1', rnd: 1, player_id: '1' } },
    { t: 'event_players', a: 'delete', key: { event_id: 'e1', player_id: '2' } },
  ]);
});

test('settings change gives one upsert', () => {
  const ops = diffOps(rows(), rows(s => { s.settings.ptsWin = 2; }));
  assert.deepEqual(ops, [{ t: 'settings', a: 'upsert', row: { id: 1, pts_win: 2, pts_loss: 0 } }]);
});

test('upserts come parents first, deletes children first, deletes after upserts', () => {
  const empty = toRows({ players: [], seasons: [], events: [], evP: [], teams: [], matches: [], byeMap: {}, settings: { ptsWin: 3, ptsLoss: 0 } });
  const up = diffOps(empty, rows()).map(o => o.a + ' ' + o.t);
  assert.deepEqual([...new Set(up)], ['upsert players', 'upsert seasons', 'upsert events', 'upsert event_players', 'upsert teams', 'upsert matches', 'upsert bye_map']);
  const down = diffOps(rows(), empty).map(o => o.a + ' ' + o.t);
  assert.deepEqual([...new Set(down)], ['delete matches', 'delete teams', 'delete bye_map', 'delete event_players', 'delete events', 'delete seasons', 'delete players']);
  const mixed = diffOps(rows(), rows(s => { s.teams = [{ ...s.teams[0], id: 't9' }]; })).map(o => o.a);
  assert.deepEqual(mixed, ['upsert', 'delete']);
});

// ── tournament fields ──
test('rows from before tournaments existed get the defaults', () => {
  const r = toRows(state());
  const old = { ...r, events: [{ id: 'e1', season_id: 's1', date: '2026-06-01', name: 'Tag', status: 'active' }],
    teams: [{ id: 't1', event_id: 'e1', rnd: 1, player1_id: '1', player2_id: '2', name: 'x' }],
    matches: [{ id: 'm1', event_id: 'e1', team1_id: 't1', team2_id: 't2', rnd: 1, seq: 1 }] };
  const s = fromRows(old);
  assert.equal(s.events[0].format, 'padel_day');
  assert.deepEqual(s.events[0].config, {});
  assert.equal(s.teams[0].grp, null);
  assert.equal(s.matches[0].stage, null);
  assert.equal(s.matches[0].court, null);
});

test('format, config, group, stage and court travel to the database and back', () => {
  const s = state();
  Object.assign(s.events[0], { format: 'classic', config: { groups: 2, advance: 2, tiebreak: { A: ['t1'] } } });
  s.teams[0].grp = 'A';
  Object.assign(s.matches[0], { stage: 'semi', court: 2 });
  const r = toRows(s);
  assert.equal(r.events[0].format, 'classic');
  assert.deepEqual(r.events[0].config, { groups: 2, advance: 2, tiebreak: { A: ['t1'] } });
  assert.equal(r.teams[0].grp, 'A');
  assert.deepEqual([r.matches[0].stage, r.matches[0].court], ['semi', 2]);
  s.byeMap = { e1: { 1: '2' } };
  assert.deepEqual(fromRows(toRows(s)), s);
});

test('a changed config is one upsert; the same config in another key order is no change', () => {
  const a = rows(s => { s.events[0].config = { courts: 2, points: 21 }; });
  const b = rows(s => { s.events[0].config = { points: 21, courts: 2 }; });
  assert.deepEqual(diffOps(a, b), []);
  const c2 = rows(s => { s.events[0].config = { courts: 2, points: 24 }; });
  const ops = diffOps(a, c2);
  assert.equal(ops.length, 1);
  assert.deepEqual(ops[0].row.config, { courts: 2, points: 24 });
});

test('the rows keep their own copy of the config: changing the state later is still seen as a change', () => {
  const s = state();
  s.events[0].config = { courts: 2 };
  const before = toRows(s);
  s.events[0].config.courts = 3;            // changed in place
  assert.equal(diffOps(before, toRows(s)).length, 1);
});
