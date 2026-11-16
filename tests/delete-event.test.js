import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toRows, diffOps } from '../js/sync.js';
import { withoutEvent } from '../js/logic.js';

const state = () => ({
  events: [{ id: 'e1' }, { id: 'e2' }],
  evP: [{ eid: 'e1', pid: '1' }, { eid: 'e2', pid: '1' }],
  teams: [{ id: 't1', eid: 'e1' }, { id: 't2', eid: 'e2' }],
  matches: [{ id: 'm1', eid: 'e1' }, { id: 'm2', eid: 'e2' }],
  byeMap: { e1: { 1: '5' }, e2: { 1: '4' } },
});

test('withoutEvent removes the event and everything that belongs to it', () => {
  const s = state();
  const r = withoutEvent(s, 'e1');
  assert.deepEqual(r.events, [{ id: 'e2' }]);
  assert.deepEqual(r.evP, [{ eid: 'e2', pid: '1' }]);
  assert.deepEqual(r.teams, [{ id: 't2', eid: 'e2' }]);
  assert.deepEqual(r.matches, [{ id: 'm2', eid: 'e2' }]);
  assert.deepEqual(r.byeMap, { e2: { 1: '4' } });
});

test('withoutEvent leaves the input untouched', () => {
  const s = state();
  withoutEvent(s, 'e1');
  assert.deepEqual(s, state());
});

test('withoutEvent with an unknown id changes nothing', () => {
  assert.deepEqual(withoutEvent(state(), 'nope'), state());
});

// ── server side: rows of a removed event go before the event itself ──
const full = () => ({
  players: [{ id: '1', name: 'P1', isActive: true }], seasons: [], settings: { ptsWin: 3, ptsLoss: 0 },
  events: [{ id: 'e1', sid: 's1' }, { id: 'e2', sid: 's1' }],
  evP: [{ eid: 'e1', pid: '1' }],
  teams: [{ id: 't1', eid: 'e1' }],
  matches: [{ id: 'm1', eid: 'e1' }],
  byeMap: { e1: { 1: '1' } },
});

test('removing an event sends deletes for its rows first, the event last', () => {
  const before = full();
  const after = { ...before, ...withoutEvent(before, 'e1') };
  const ops = diffOps(toRows(before), toRows(after)).map(o => o.a + ' ' + o.t);
  assert.deepEqual(ops, ['delete matches', 'delete teams', 'delete bye_map', 'delete event_players', 'delete events']);
});
