// Loads the whole app against a stand-in DOM and a fake server. Proves the
// modules resolve and every screen renders; not what the screens look like.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from './helpers/fake-dom.js';
import { toRows } from '../js/sync.js';

const data = {
  players: [1, 2, 3, 4, 5].map(n => ({ id: String(n), name: 'P' + n, isActive: true })),
  seasons: [{ id: 's1', name: 'Test', startDate: '2026-01-01', endDate: '2026-06-30', isActive: true },
    { id: 's2', name: 'Zweite', startDate: '2026-07-01', endDate: '2026-12-31', isActive: false }],
  events: [{ id: 'e1', sid: 's1', name: 'Testtag', date: '2026-06-01', status: 'active' }],
  evP: [1, 2, 3, 4].map(n => ({ eid: 'e1', pid: String(n) })),
  teams: [
    { id: 't1', eid: 'e1', rnd: 1, player1Id: '1', player2Id: '2', name: 'P1 / P2' },
    { id: 't2', eid: 'e1', rnd: 1, player1Id: '3', player2Id: '4', name: 'P3 / P4' },
  ],
  matches: [{ id: 'm1', eid: 'e1', rnd: 1, seq: 1, team1Id: 't1', team2Id: 't2',
    t1s1: 6, t2s1: 4, t1s2: 6, t2s2: 3, t1s3: null, t2s3: null, winnerTeamId: 't1', status: 'completed' }],
  byeMap: {},
  settings: { ptsWin: 3, ptsLoss: 0 },
};

let main, store;
const sent = [];
before(async () => {
  installFakeDom({ search: '?key=test' });
  globalThis.fetch = async (url, opts) => {
    const body = JSON.parse(opts.body);
    if (body.action === 'ops') sent.push(...body.ops);
    const answer = body.action === 'state' ? { role: 'admin', state: toRows(data) } : { applied: 1 };
    return { ok: true, status: 200, json: async () => answer };
  };
  main = await import('../js/main.js');
  store = await import('../js/store.js');
  await main.ready;
});

test('starts with the data the server sent', () => {
  assert.equal(store.ACCESS, 'ok');
  assert.equal(store.S.players.length, 5);
  assert.equal(store.S.events[0].status, 'active');
});

for (const tab of ['start', 'events', 'standings', 'players', 'settings']) {
  test(`tab ${tab} renders`, () => {
    assert.doesNotThrow(() => main.setTab(tab));
  });
}

test('event detail renders', () => {
  store.S.tab = 'events';
  store.S.selEv = 'e1';
  assert.doesNotThrow(() => main.render());
  store.S.selEv = null;
});

test('the sheets open: score, team builder, KI, new event, confirm', async () => {
  const { openScoreSheet } = await import('../js/views/match.js');
  const { openNewEvent } = await import('../js/views/events.js');
  const { confirmSheet } = await import('../js/sheet.js');
  const { openTeamBuilder } = await import('../js/views/teambuilder.js');
  const { openKiAnalyse } = await import('../js/views/ki.js');
  assert.doesNotThrow(() => openScoreSheet(store.S.matches[0]));
  assert.doesNotThrow(() => openNewEvent());
  assert.doesNotThrow(() => confirmSheet({ title: 'T?', text: 'x', action: 'Ok', onConfirm() {} }).close());
  assert.doesNotThrow(() => openTeamBuilder('e1', 2));
  assert.doesNotThrow(() => openKiAnalyse());
});

test('standings has a row per active player', () => {
  assert.equal(store.standings().length, 5);
});

test('drawing teams for a new round sends only the new rows', async () => {
  const { genTeams } = await import('../js/actions.js');
  genTeams('e1', 2);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(store.S.teams.filter(t => t.rnd === 2).length, 2);
  assert.deepEqual(sent.map(o => o.a + ' ' + o.t), ['upsert teams', 'upsert teams']);
  assert.match(sent[0].row.id, /^[0-9a-f-]{36}$/);
});

test('deactivating a player keeps the player and sends one change', async () => {
  const { setPlayerActive } = await import('../js/actions.js');
  sent.length = 0;
  setPlayerActive('5', false);
  await new Promise(r => setTimeout(r, 0));
  assert.equal(store.S.players.length, 5);
  assert.equal(store.S.players.find(p => p.id === '5').isActive, false);
  assert.equal(store.standings().length, 4);
  assert.deepEqual(sent, [{ t: 'players', a: 'upsert', row: { id: '5', name: 'P5', is_active: false } }]);
  setPlayerActive('5', true);
  assert.equal(store.standings().length, 5);
  assert.doesNotThrow(() => main.setTab('players'));
});

test('moving an event to another season sends exactly that event', async () => {
  const { moveEvent, addEvent } = await import('../js/actions.js');
  sent.length = 0;
  moveEvent('e1', 's2');
  await new Promise(r => setTimeout(r, 0));
  assert.equal(store.S.events[0].sid, 's2');
  assert.deepEqual(sent.map(o => [o.t, o.a, o.row.id, o.row.season_id]), [['events', 'upsert', 'e1', 's2']]);
  moveEvent('e1', 'nope');
  assert.equal(store.S.events[0].sid, 's2', 'an unknown season is ignored');
  moveEvent('e1', 's1');
  await new Promise(r => setTimeout(r, 0));
  // A new Padel Day goes to the season its date belongs to, not the active one.
  const id = addEvent('2026-10-04');
  assert.equal(store.S.events.find(e => e.id === id).sid, 's2');
  const { openMoveEvent } = await import('../js/views/event-parts.js');
  assert.doesNotThrow(() => openMoveEvent(store.S.events[0]).close());
});

test('index.html warns when opened as a file and has no inline nav handlers', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes("location.protocol==='file:'"));
  assert.ok(!html.includes('onclick="setTab'));
  assert.ok(html.includes('<script type="module" src="js/main.js"></script>'));
});

test('no keys, key hashes or old backend calls are left in the client', () => {
  const files = ['js/store.js', 'js/main.js', 'js/views/ki.js', 'js/views/settings.js', 'js/actions.js', 'index.html'];
  const all = files.map(f => readFileSync(new URL('../' + f, import.meta.url), 'utf8')).join('\n');
  assert.ok(!/[0-9a-f]{64}/.test(all), 'hash found');
  assert.ok(!all.includes('sb_publishable_'), 'publishable key found');
  assert.ok(!all.includes('/rest/v1/'), 'direct database call found');
  assert.ok(!all.includes('dynamic-endpoint'), 'old AI function found');
});
