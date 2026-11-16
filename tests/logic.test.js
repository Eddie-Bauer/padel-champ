import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcWinner, calcStandings, shuf, drawTeams, roundRobin, teamName, checkScore } from '../js/logic.js';

const players = n => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), name: 'P' + (i + 1), isActive: true }));

const fixture = (over = {}) => ({
  players: players(4),
  events: [{ id: 'e1', sid: 's1' }, { id: 'e2', sid: 's2' }],
  teams: [
    { id: 't1', eid: 'e1', rnd: 1, player1Id: '1', player2Id: '2' },
    { id: 't2', eid: 'e1', rnd: 1, player1Id: '3', player2Id: '4' },
  ],
  matches: [match()],
  settings: { ptsWin: 3, ptsLoss: 0 },
  ...over,
});

function match(over = {}) {
  return { id: 'm1', eid: 'e1', rnd: 1, seq: 1, team1Id: 't1', team2Id: 't2',
    t1s1: 6, t2s1: 4, t1s2: 6, t2s2: 3, t1s3: null, t2s3: null,
    winnerTeamId: 't1', status: 'completed', ...over };
}

const row = (rows, id) => rows.find(r => r.player.id === id);
const pick = (r, keys) => Object.fromEntries(keys.map(k => [k, r[k]]));

// ── calcWinner ──
const sets = (a, b, c) => ({ team1Id: 'x', team2Id: 'y',
  t1s1: a?.[0] ?? null, t2s1: a?.[1] ?? null, t1s2: b?.[0] ?? null, t2s2: b?.[1] ?? null, t1s3: c?.[0] ?? null, t2s3: c?.[1] ?? null });

test('calcWinner: two sets to one wins', () => {
  assert.equal(calcWinner(sets([6, 4], [4, 6], [10, 8])), 'x');
});
test('calcWinner: a single set decides', () => {
  assert.equal(calcWinner(sets([6, 4])), 'x');
});
test('calcWinner: 0:0 has no winner', () => {
  assert.equal(calcWinner(sets([0, 0])), null);
});
test('calcWinner: one set each has no winner', () => {
  assert.equal(calcWinner(sets([6, 4], [4, 6])), null);
});

// ── calcStandings ──
test('calcStandings: winners and losers of one match', () => {
  const rows = calcStandings(fixture(), 's1');
  const keys = ['pts', 'w', 'l', 'mp', 'sd', 'gd', 'pct'];
  for (const id of ['1', '2']) assert.deepEqual(pick(row(rows, id), keys), { pts: 3, w: 1, l: 0, mp: 1, sd: 2, gd: 5, pct: 100 });
  for (const id of ['3', '4']) assert.deepEqual(pick(row(rows, id), keys), { pts: 0, w: 0, l: 1, mp: 1, sd: -2, gd: -5, pct: 0 });
  assert.deepEqual(rows.map(r => r.rank), [1, 2, 3, 4]);
  assert.deepEqual(rows.slice(0, 2).map(r => r.player.id), ['1', '2']);
});

test('calcStandings: points per loss are applied', () => {
  const rows = calcStandings(fixture({ settings: { ptsWin: 3, ptsLoss: 1 } }), 's1');
  assert.equal(row(rows, '3').pts, 1);
});

test('calcStandings: a match of another season changes nothing', () => {
  const s = fixture();
  s.teams.push({ id: 't3', eid: 'e2', rnd: 1, player1Id: '1', player2Id: '3' }, { id: 't4', eid: 'e2', rnd: 1, player1Id: '2', player2Id: '4' });
  s.matches.push(match({ id: 'm2', eid: 'e2', team1Id: 't3', team2Id: 't4', winnerTeamId: 't4' }));
  assert.deepEqual(calcStandings(s, 's1'), calcStandings(fixture(), 's1'));
});

test('calcStandings: a scheduled match changes nothing', () => {
  const rows = calcStandings(fixture({ matches: [match({ status: 'scheduled' })] }), 's1');
  assert.ok(rows.every(r => r.mp === 0 && r.pts === 0));
});

test('a match without a winner (0:0, did not take place) counts for nobody', () => {
  const m = match({ t1s1: 0, t2s1: 0, t1s2: null, t2s2: null, winnerTeamId: null });
  const rows = calcStandings(fixture({ matches: [m] }), 's1');
  assert.ok(rows.every(r => r.mp === 0 && r.l === 0 && r.w === 0 && r.pts === 0 && r.gd === 0));
  const withLossPoints = calcStandings(fixture({ matches: [m], settings: { ptsWin: 3, ptsLoss: 1 } }), 's1');
  assert.ok(withLossPoints.every(r => r.pts === 0));
});

test('calcStandings: a team with a deleted player does not throw and gets no row', () => {
  const s = fixture();
  s.teams[1].player2Id = '99';
  const rows = calcStandings(s, 's1');
  assert.equal(row(rows, '99'), undefined);
  assert.deepEqual(rows.map(r => r.player.id).sort(), ['1', '2', '3', '4']);
  assert.equal(row(rows, '3').l, 1);
});

// ── shuf ──
test('shuf returns a copy with the same members', () => {
  const a = [1, 2, 3, 4, 5];
  const b = shuf(a);
  assert.notEqual(b, a);
  assert.deepEqual([...b].sort(), a);
});

// ── drawTeams ──
test('drawTeams: four players give two pairs and no bye', () => {
  const { pairs, bye } = drawTeams(players(4), null);
  assert.equal(pairs.length, 2);
  assert.equal(bye, null);
  assert.deepEqual(pairs.flatMap(p => [p.p1.id, p.p2.id]).sort(), ['1', '2', '3', '4']);
});

test('drawTeams: three players give one pair and a bye', () => {
  const { pairs, bye } = drawTeams(players(3), null);
  assert.equal(pairs.length, 1);
  assert.ok(bye);
  assert.deepEqual([pairs[0].p1.id, pairs[0].p2.id, bye.id].sort(), ['1', '2', '3']);
});

test('drawTeams: the previous bye player never gets the bye again', () => {
  for (let i = 0; i < 200; i++) assert.notEqual(drawTeams(players(5), '5').bye.id, '5');
});

test('drawTeams: fewer than two players give no teams', () => {
  assert.deepEqual(drawTeams(players(1), null), { pairs: [], bye: null });
  assert.deepEqual(drawTeams([], null), { pairs: [], bye: null });
});

// ── roundRobin, teamName ──
test('roundRobin pairs everyone once, in loop order', () => {
  assert.deepEqual(roundRobin(['a', 'b', 'c']), [['a', 'b'], ['a', 'c'], ['b', 'c']]);
  assert.deepEqual(roundRobin(['a']), []);
});

test('teamName joins first names', () => {
  assert.equal(teamName({ name: 'Anna Muster' }, { name: 'Ben' }), 'Anna & Ben');
});

// ── checkScore ──
const S = (...pairs) => pairs.map(([t1, t2]) => ({ t1, t2 }));

test('checkScore: 0:0 means the match did not take place', () => {
  assert.deepEqual(checkScore(S([0, 0])), { ok: true, notPlayed: true, error: null });
  assert.deepEqual(checkScore(S([0, 0], [0, 0])), { ok: true, notPlayed: true, error: null });
});

test('checkScore: a result with a winner is accepted', () => {
  assert.deepEqual(checkScore(S([6, 4])), { ok: true, notPlayed: false, error: null });
  assert.equal(checkScore(S([6, 4], [4, 6], [10, 8])).ok, true);
  assert.equal(checkScore(S([4, 6], [3, 6])).ok, true);
});

test('checkScore: a tied set is refused and named', () => {
  const r = checkScore(S([6, 4], [5, 5]));
  assert.equal(r.ok, false);
  assert.match(r.error, /Satz 2/);
  assert.equal(checkScore(S([7, 7])).ok, false);
  assert.equal(checkScore(S([6, 4], [0, 0])).ok, false);
});

test('checkScore: one set each without a decider is refused', () => {
  const r = checkScore(S([6, 4], [4, 6]));
  assert.equal(r.ok, false);
  assert.match(r.error, /Sieger/);
});

test('checkScore: no sets at all is refused', () => {
  assert.equal(checkScore([]).ok, false);
});
