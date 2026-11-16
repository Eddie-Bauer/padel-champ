import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
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
let calls;
before(async () => {
  installFakeDom();
  calls = [];
  globalThis.fetch = async (url, opts = {}) => { calls.push((opts.method || 'GET') + ' ' + url.split('/rest/v1/')[1]); return { ok: true, json: async () => [] }; };
  const { _sbSave } = await import('../js/store.js');
  const s = withoutEvent(state(), 'e1');
  await _sbSave({ players: [{ id: '1', name: 'P1', isActive: true }], seasons: [], settings: { ptsWin: 3, ptsLoss: 0 }, ...s });
});

test('saving deletes the rows of removed events before the events', () => {
  const at = q => { const i = calls.indexOf(q); assert.notEqual(i, -1, 'missing call: ' + q); return i; };
  const ev = at('DELETE events?id=not.in.(e2)');
  for (const t of ['matches', 'teams', 'event_players', 'bye_map']) {
    assert.ok(at(`DELETE ${t}?event_id=not.in.(e2)`) < ev, t + ' must be cleared first');
  }
});

test('saving still writes the remaining event before its teams and matches', () => {
  const i = calls.indexOf('POST events');
  assert.ok(i !== -1 && i < calls.indexOf('POST teams') && i < calls.indexOf('POST matches'));
});
