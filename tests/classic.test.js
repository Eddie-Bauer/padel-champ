import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classicOptions, drawGroups, groupMatches, groupTable, seedPlayoff, nextPlayoffRound, finalPlacing } from '../js/tournament.js';

const ids = (n, p = 't') => Array.from({ length: n }, (_, i) => p + (i + 1));
const seeded = (seed = 1) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// A finished match in the app's match shape. sets: [[6,4],[6,3]]
const played = (a, b, sets) => {
  const m = { team1Id: a, team2Id: b, status: 'completed', t1s1: null, t2s1: null, t1s2: null, t2s2: null, t1s3: null, t2s3: null };
  let w1 = 0, w2 = 0;
  sets.forEach(([x, y], i) => { m['t1s' + (i + 1)] = x; m['t2s' + (i + 1)] = y; if (x > y) w1++; else if (y > x) w2++; });
  m.winnerTeamId = w1 > w2 ? a : w2 > w1 ? b : null;
  return m;
};
const open = (a, b) => ({ team1Id: a, team2Id: b, status: 'scheduled', winnerTeamId: null, t1s1: null, t2s1: null, t1s2: null, t2s2: null, t1s3: null, t2s3: null });
const order = rows => rows.map(r => r.id);

// ── options ──
test('classicOptions: only setups whose playoff has 2, 4 or 8 teams', () => {
  const key = o => `${o.groups}g/${o.advance}a/${o.playoffSize}`;
  assert.deepEqual(classicOptions(4).map(key), ['1g/2a/2', '1g/4a/4', '2g/1a/2', '2g/2a/4']);
  assert.deepEqual(classicOptions(8).map(key), ['1g/2a/2', '1g/4a/4', '1g/8a/8', '2g/1a/2', '2g/2a/4', '2g/4a/8', '4g/1a/4', '4g/2a/8']);
  assert.deepEqual(classicOptions(6).map(key), ['1g/2a/2', '1g/4a/4', '2g/1a/2', '2g/2a/4']);
  assert.deepEqual(classicOptions(3).map(key), ['1g/2a/2']);
});

test('classicOptions: too few teams give no setup', () => {
  assert.deepEqual(classicOptions(1), []);
  assert.deepEqual(classicOptions(0), []);
});

// ── groups ──
test('drawGroups: everyone in exactly one group, sizes differ by at most one', () => {
  for (const [n, g] of [[8, 2], [7, 2], [10, 4], [5, 1], [9, 4]]) {
    const groups = drawGroups(ids(n), g, seeded(n));
    assert.equal(groups.length, g);
    assert.deepEqual(groups.flat().sort(), ids(n).sort());
    const sizes = groups.map(x => x.length);
    assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `${n}/${g}: ${sizes}`);
  }
});

test('drawGroups: the draw is random but repeatable with the same source', () => {
  assert.deepEqual(drawGroups(ids(8), 2, seeded(4)), drawGroups(ids(8), 2, seeded(4)));
  const draws = new Set([1, 2, 3, 4, 5, 6].map(s => JSON.stringify(drawGroups(ids(8), 2, seeded(s)))));
  assert.ok(draws.size > 1);
});

test('groupMatches: everyone against everyone once', () => {
  assert.deepEqual(groupMatches(['a', 'b', 'c']), [['a', 'b'], ['a', 'c'], ['b', 'c']]);
  assert.equal(groupMatches(ids(4)).length, 6);
});

// ── table ──
test('groupTable: ordered by wins, then set difference, then game difference', () => {
  const t = ids(4);
  const rows = groupTable(t, [
    played('t1', 't2', [[6, 0], [6, 0]]),
    played('t1', 't3', [[6, 4], [6, 4]]),
    played('t1', 't4', [[6, 4], [6, 4]]),
    played('t2', 't3', [[6, 4], [4, 6], [10, 8]]),   // t2 wins 2:1
    played('t2', 't4', [[6, 4], [6, 4]]),
    played('t3', 't4', [[6, 1], [6, 1]]),
  ]);
  assert.deepEqual(order(rows), ['t1', 't2', 't3', 't4']);
  assert.deepEqual({ ...rows[0] }, { id: 't1', played: 3, wins: 3, losses: 0, sd: 6, gd: 20, rank: 1, tied: false });
  assert.deepEqual(rows.map(r => r.wins), [3, 2, 1, 0]);
});

test('groupTable: unplayed matches and matches without a winner are ignored', () => {
  const rows = groupTable(ids(3), [open('t1', 't2'), played('t1', 't3', [[0, 0]])]);
  assert.ok(rows.every(r => r.played === 0 && r.wins === 0 && r.gd === 0));
});

test('groupTable: two teams level on everything: the direct match decides', () => {
  // t1 and t2 both 2 wins, same set and game difference; t2 beat t1.
  const rows = groupTable(ids(4), [
    played('t2', 't1', [[6, 4]]),
    played('t1', 't3', [[6, 4]]),
    played('t1', 't4', [[6, 2]]),
    played('t2', 't3', [[6, 2]]),
    played('t4', 't2', [[6, 4]]),
    played('t3', 't4', [[6, 4]]),
  ]);
  const r = id => rows.find(x => x.id === id);
  assert.deepEqual([r('t1').wins, r('t1').sd, r('t1').gd], [r('t2').wins, r('t2').sd, r('t2').gd]);
  assert.ok(r('t2').rank < r('t1').rank);
  assert.equal(r('t1').tied, false);
  assert.equal(r('t2').tied, false);
});

test('groupTable: three teams level in a circle are flagged as tied, and do not crash', () => {
  // t1 beats t2, t2 beats t3, t3 beats t1, all 6:4.
  const ms = [played('t1', 't2', [[6, 4]]), played('t2', 't3', [[6, 4]]), played('t3', 't1', [[6, 4]])];
  const rows = groupTable(ids(3), ms);
  assert.ok(rows.every(r => r.tied));
  assert.deepEqual(rows.map(r => r.rank), [1, 2, 3]);
});

test('groupTable: the organiser\'s draw settles a tie', () => {
  const ms = [played('t1', 't2', [[6, 4]]), played('t2', 't3', [[6, 4]]), played('t3', 't1', [[6, 4]])];
  const rows = groupTable(ids(3), ms, ['t3', 't1', 't2']);
  assert.deepEqual(order(rows), ['t3', 't1', 't2']);
  assert.ok(rows.every(r => !r.tied));
});

test('groupTable: a draw order never overrules a real difference', () => {
  const rows = groupTable(ids(2), [played('t1', 't2', [[6, 4]])], ['t2', 't1']);
  assert.deepEqual(order(rows), ['t1', 't2']);
});

test('groupTable: matches with teams outside the group are ignored', () => {
  const rows = groupTable(['t1', 't2'], [played('t1', 't9', [[6, 0]])]);
  assert.ok(rows.every(r => r.played === 0));
});

// ── playoff seeding ──
test('seedPlayoff: one group', () => {
  const g = [ids(8, 's')];
  assert.deepEqual(seedPlayoff(g, 2), { stage: 'final', pairs: [['s1', 's2']] });
  assert.deepEqual(seedPlayoff(g, 4), { stage: 'semi', pairs: [['s1', 's4'], ['s2', 's3']] });
  assert.deepEqual(seedPlayoff(g, 8), { stage: 'quarter', pairs: [['s1', 's8'], ['s4', 's5'], ['s2', 's7'], ['s3', 's6']] });
});

test('seedPlayoff: two groups are crossed', () => {
  const g = [ids(4, 'a'), ids(4, 'b')];
  assert.deepEqual(seedPlayoff(g, 1), { stage: 'final', pairs: [['a1', 'b1']] });
  assert.deepEqual(seedPlayoff(g, 2), { stage: 'semi', pairs: [['a1', 'b2'], ['b1', 'a2']] });
  assert.deepEqual(seedPlayoff(g, 4), { stage: 'quarter', pairs: [['a1', 'b4'], ['b2', 'a3'], ['b1', 'a4'], ['a2', 'b3']] });
});

test('seedPlayoff: four groups; the two from one group can only meet in the final', () => {
  const g = [ids(2, 'a'), ids(2, 'b'), ids(2, 'c'), ids(2, 'd')];
  assert.deepEqual(seedPlayoff(g, 1), { stage: 'semi', pairs: [['a1', 'b1'], ['c1', 'd1']] });
  const q = seedPlayoff(g, 2);
  assert.equal(q.stage, 'quarter');
  assert.deepEqual(q.pairs, [['a1', 'b2'], ['c1', 'd2'], ['b1', 'a2'], ['d1', 'c2']]);
  const half = id => (q.pairs.findIndex(p => p.includes(id)) < 2 ? 'top' : 'bottom');
  for (const x of ['a', 'b', 'c', 'd']) assert.notEqual(half(x + '1'), half(x + '2'));
});

test('seedPlayoff: a setup that is not offered is refused', () => {
  assert.throws(() => seedPlayoff([ids(4, 'a'), ids(4, 'b'), ids(4, 'c')], 1));
  assert.throws(() => seedPlayoff([ids(4, 'a')], 3));
  assert.throws(() => seedPlayoff([ids(1, 'a'), ids(4, 'b')], 2), /zu wenig/i);
});

// ── playoff progress ──
test('nextPlayoffRound: quarter-finals to semi-finals in bracket order', () => {
  const qs = [played('a', 'b', [[6, 4]]), played('c', 'd', [[4, 6]]), played('e', 'f', [[6, 4]]), played('g', 'h', [[6, 4]])];
  assert.deepEqual(nextPlayoffRound('quarter', qs), [
    { stage: 'semi', team1Id: 'a', team2Id: 'd' },
    { stage: 'semi', team1Id: 'e', team2Id: 'g' },
  ]);
});

test('nextPlayoffRound: semi-finals to final, with the match for third place if wanted', () => {
  const ss = [played('a', 'd', [[6, 4]]), played('e', 'g', [[3, 6]])];
  assert.deepEqual(nextPlayoffRound('semi', ss), [{ stage: 'final', team1Id: 'a', team2Id: 'g' }]);
  assert.deepEqual(nextPlayoffRound('semi', ss, { thirdPlace: true }), [
    { stage: 'third', team1Id: 'd', team2Id: 'e' },
    { stage: 'final', team1Id: 'a', team2Id: 'g' },
  ]);
});

test('nextPlayoffRound: nothing follows the final', () => {
  assert.deepEqual(nextPlayoffRound('final', [played('a', 'g', [[6, 4]])]), []);
});

test('nextPlayoffRound: no next round while a match is open or has no winner', () => {
  assert.equal(nextPlayoffRound('semi', [played('a', 'd', [[6, 4]]), open('e', 'g')]), null);
  assert.equal(nextPlayoffRound('semi', [played('a', 'd', [[6, 4]]), played('e', 'g', [[0, 0]])]), null);
  assert.equal(nextPlayoffRound('quarter', [played('a', 'b', [[6, 4]])]), null, 'too few matches');
});

// ── final placing ──
test('finalPlacing: with a match for third place', () => {
  const p = finalPlacing({ final: played('a', 'g', [[6, 4]]), third: played('d', 'e', [[2, 6]]) });
  assert.deepEqual(p, [{ place: 1, teamId: 'a' }, { place: 2, teamId: 'g' }, { place: 3, teamId: 'e' }, { place: 4, teamId: 'd' }]);
});

test('finalPlacing: without it both semi-final losers are third', () => {
  const p = finalPlacing({ final: played('a', 'g', [[4, 6]]), semis: [played('a', 'd', [[6, 4]]), played('e', 'g', [[3, 6]])] });
  assert.deepEqual(p, [{ place: 1, teamId: 'g' }, { place: 2, teamId: 'a' }, { place: 3, teamId: 'd' }, { place: 3, teamId: 'e' }]);
});

test('finalPlacing: nothing before the final is decided', () => {
  assert.equal(finalPlacing({ final: open('a', 'g') }), null);
  assert.equal(finalPlacing({}), null);
});
