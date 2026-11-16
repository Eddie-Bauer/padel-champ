// Loads the whole app against a stand-in DOM. Proves the modules resolve and
// every screen renders; it does not prove what the screens look like.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installFakeDom } from './helpers/fake-dom.js';

const stored = {
  players: [1, 2, 3, 4, 5].map(n => ({ id: String(n), name: 'P' + n, isActive: true })),
  seasons: [{ id: 's1', name: 'Test', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true }],
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
before(async () => {
  installFakeDom({ stored });
  main = await import('../js/main.js');
  store = await import('../js/store.js');
  await main.ready;
});

test('starts from the state already saved on the device', () => {
  assert.equal(store.S.players.length, 5);
  assert.equal(store.S.events[0].status, 'active');
});

for (const tab of [0, 1, 2, 3, 4]) {
  test(`tab ${tab} renders`, () => {
    assert.doesNotThrow(() => main.setTab(tab));
  });
}

test('event detail renders', () => {
  store.S.tab = 2;
  store.S.selEv = 'e1';
  assert.doesNotThrow(() => main.render());
  store.S.selEv = null;
});

test('score modal, team builder and KI modal open', async () => {
  const { openScoreModal } = await import('../js/views/match.js');
  const { openTeamBuilder } = await import('../js/views/teambuilder.js');
  const { openKiAnalyse } = await import('../js/views/ki.js');
  assert.doesNotThrow(() => openScoreModal(store.S.matches[0]));
  assert.doesNotThrow(() => openTeamBuilder('e1', 2));
  await assert.doesNotReject(openKiAnalyse());
});

test('standings has a row per active player', () => {
  assert.equal(store.standings().length, 5);
});

test('without a key nothing can be changed', () => {
  assert.equal(store.IS_PLAYER, false);
  store.mut(() => { store.S.players.push({}); });
  assert.equal(store.S.players.length, 5);
});

test('index.html warns when opened as a file and has no inline nav handlers', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes("location.protocol==='file:'"));
  assert.ok(!html.includes('onclick="setTab'));
  assert.ok(html.includes('<script type="module" src="js/main.js"></script>'));
});
