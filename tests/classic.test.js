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

// ── the whole tournament, step by step ──
import { classicNext, classicEditable, STAGE_LABEL } from '../js/tournament.js';

const T = (id, grp) => ({ id, grp });
let seqNo = 0;
// Turns what classicNext asks for into stored matches (the app does the same).
const store = add => add.map(m => ({ ...open(m.team1Id, m.team2Id), id: 'p' + (++seqNo), stage: m.stage, rnd: m.rnd, seq: m.seq }));
const win = (m, winner) => Object.assign(m, played(m.team1Id, m.team2Id, winner === m.team1Id ? [[6, 3]] : [[3, 6]]), { id: m.id, stage: m.stage, rnd: m.rnd, seq: m.seq });
const group = (a, b, sets, seq) => ({ ...played(a, b, sets), stage: 'group', rnd: 1, seq });

const twoGroups = () => ({
  config: { groups: 2, advance: 2, thirdPlace: true },
  teams: [T('a1', 'A'), T('a2', 'A'), T('a3', 'A'), T('b1', 'B'), T('b2', 'B'), T('b3', 'B')],
  matches: [
    group('a1', 'a2', [[6, 2]], 1), group('a1', 'a3', [[6, 1]], 2), group('a2', 'a3', [[6, 4]], 3),
    group('b1', 'b2', [[6, 2]], 4), group('b1', 'b3', [[6, 1]], 5), group('b2', 'b3', [[6, 4]], 6),
  ],
});

test('classicNext: nothing while group matches are open', () => {
  const t = twoGroups();
  t.matches[2] = { ...open('a2', 'a3'), stage: 'group', rnd: 1, seq: 3 };
  assert.deepEqual(classicNext(t), { add: [], tied: [] });
});

test('classicNext: after the groups come the crossed semi-finals', () => {
  const { add, tied } = classicNext(twoGroups());
  assert.deepEqual(tied, []);
  assert.deepEqual(add, [
    { stage: 'semi', rnd: 3, seq: 1, team1Id: 'a1', team2Id: 'b2' },
    { stage: 'semi', rnd: 3, seq: 2, team1Id: 'b1', team2Id: 'a2' },
  ]);
});

test('classicNext: semi-finals lead to third place and final, then nothing more', () => {
  const t = twoGroups();
  const semis = store(classicNext(t).add);
  t.matches.push(...semis);
  assert.deepEqual(classicNext(t).add, [], 'semi-finals not played yet');
  win(semis[0], 'a1'); win(semis[1], 'a2');
  const last = classicNext(t).add;
  assert.deepEqual(last, [
    { stage: 'third', rnd: 4, seq: 1, team1Id: 'b2', team2Id: 'b1' },
    { stage: 'final', rnd: 4, seq: 2, team1Id: 'a1', team2Id: 'a2' },
  ]);
  t.matches.push(...store(last));
  assert.deepEqual(classicNext(t).add, [], 'the final exists: nothing is added twice');
});

test('classicNext: without the third-place option only the final is added', () => {
  const t = twoGroups(); t.config.thirdPlace = false;
  const semis = store(classicNext(t).add); t.matches.push(...semis);
  win(semis[0], 'a1'); win(semis[1], 'b1');
  assert.deepEqual(classicNext(t).add.map(m => m.stage), ['final']);
});

test('classicNext: a tie among the teams that advance blocks the playoff and names the group', () => {
  const t = twoGroups();
  // Group A becomes a circle: a1 beats a2, a2 beats a3, a3 beats a1, all 6:4.
  t.matches[0] = group('a1', 'a2', [[6, 4]], 1); t.matches[1] = group('a3', 'a1', [[6, 4]], 2); t.matches[2] = group('a2', 'a3', [[6, 4]], 3);
  assert.deepEqual(classicNext(t), { add: [], tied: ['A'] });
  t.config.tiebreak = { A: ['a3', 'a1', 'a2'] };
  const { add, tied } = classicNext(t);
  assert.deepEqual(tied, []);
  assert.deepEqual(add.map(m => [m.team1Id, m.team2Id]), [['a3', 'b2'], ['b1', 'a1']]);
});

test('classicNext: a tie below the cut does not block', () => {
  const t = twoGroups(); t.config.advance = 1; t.config.thirdPlace = false;
  // a1 beats both; a2 and a3 have not... make them level: they draw nothing, a2-a3 is replaced by two mirrored results is impossible,
  // so use four teams: a1 beats all, the other three form a circle.
  t.teams.push(T('a4', 'A'));
  t.matches = [
    group('a1', 'a2', [[6, 0]], 1), group('a1', 'a3', [[6, 0]], 2), group('a1', 'a4', [[6, 0]], 3),
    group('a2', 'a3', [[6, 4]], 4), group('a3', 'a4', [[6, 4]], 5), group('a4', 'a2', [[6, 4]], 6),
    group('b1', 'b2', [[6, 2]], 7), group('b1', 'b3', [[6, 1]], 8), group('b2', 'b3', [[6, 4]], 9),
  ];
  const { add, tied } = classicNext(t);
  assert.deepEqual(tied, []);
  assert.deepEqual(add, [{ stage: 'final', rnd: 4, seq: 2, team1Id: 'a1', team2Id: 'b1' }]);
});

test('classicNext: four groups go through quarter-finals and semi-finals', () => {
  const teams = [], matches = []; let s = 0;
  for (const g of ['A', 'B', 'C', 'D']) {
    const [x, y] = [g.toLowerCase() + '1', g.toLowerCase() + '2'];
    teams.push(T(x, g), T(y, g)); matches.push(group(x, y, [[6, 2]], ++s));
  }
  const t = { config: { groups: 4, advance: 2, thirdPlace: false }, teams, matches };
  const q = store(classicNext(t).add); t.matches.push(...q);
  assert.deepEqual(q.map(m => [m.stage, m.rnd, m.team1Id, m.team2Id]),
    [['quarter', 2, 'a1', 'b2'], ['quarter', 2, 'c1', 'd2'], ['quarter', 2, 'b1', 'a2'], ['quarter', 2, 'd1', 'c2']]);
  q.forEach(m => win(m, m.team1Id));
  const sf = store(classicNext(t).add); t.matches.push(...sf);
  assert.deepEqual(sf.map(m => [m.stage, m.team1Id, m.team2Id]), [['semi', 'a1', 'c1'], ['semi', 'b1', 'd1']]);
});

test('classicEditable: a result can be changed until the next stage has started', () => {
  const t = twoGroups();
  const g = t.matches[0];
  assert.equal(classicEditable(g, t.matches), true);
  const semis = store(classicNext(t).add); t.matches.push(...semis);
  assert.equal(classicEditable(g, t.matches), false, 'groups are closed once the playoff exists');
  assert.equal(classicEditable(semis[0], t.matches), true);
  win(semis[0], 'a1'); win(semis[1], 'a2');
  const last = store(classicNext(t).add); t.matches.push(...last);
  assert.equal(classicEditable(semis[0], t.matches), false);
  assert.equal(classicEditable(last[0], t.matches), true);
  assert.equal(classicEditable(last[1], t.matches), true);
});

test('STAGE_LABEL names every stage in German', () => {
  assert.deepEqual(Object.keys(STAGE_LABEL).sort(), ['final', 'group', 'quarter', 'semi', 'third']);
});
