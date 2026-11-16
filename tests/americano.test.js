import { test } from 'node:test';
import assert from 'node:assert/strict';
import { americanoRounds, americanoSchedule, americanoStandings } from '../js/tournament.js';

const ids = n => Array.from({ length: n }, (_, i) => 'p' + (i + 1));
// Repeatable random numbers for tests.
const seeded = (seed = 1) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const stats = (players, schedule) => {
  const partner = {}, opponent = {}, rests = {}, games = {};
  const bump = (m, a, b) => { const k = [a, b].sort().join('|'); m[k] = (m[k] || 0) + 1; };
  players.forEach(p => { rests[p] = 0; games[p] = 0; });
  for (const r of schedule) {
    r.resting.forEach(p => rests[p]++);
    for (const m of r.matches) {
      bump(partner, ...m.team1); bump(partner, ...m.team2);
      for (const a of m.team1) for (const b of m.team2) bump(opponent, a, b);
      [...m.team1, ...m.team2].forEach(p => games[p]++);
    }
  }
  return { partner, opponent, rests, games };
};
const spread = o => Math.max(...Object.values(o)) - Math.min(...Object.values(o));

const assertValid = (players, schedule, courts) => {
  schedule.forEach((r, i) => {
    assert.equal(r.round, i + 1);
    const playing = r.matches.flatMap(m => [...m.team1, ...m.team2]);
    assert.equal(new Set(playing).size, playing.length, 'a player twice in round ' + r.round);
    assert.deepEqual([...playing, ...r.resting].sort(), [...players].sort(), 'everyone plays or rests in round ' + r.round);
    assert.ok(r.matches.length <= courts);
    assert.deepEqual(r.matches.map(m => m.court), r.matches.map((_, j) => j + 1));
    for (const m of r.matches) { assert.equal(m.team1.length, 2); assert.equal(m.team2.length, 2); }
  });
};

// ── default rounds ──
test('americanoRounds: enough rounds for everyone to partner everyone once', () => {
  assert.equal(americanoRounds(4, 1), 3);
  assert.equal(americanoRounds(8, 2), 7);
  assert.equal(americanoRounds(12, 3), 11);
  assert.equal(americanoRounds(16, 4), 15);
  assert.equal(americanoRounds(5, 1), 5);
  assert.equal(americanoRounds(8, 1), 14);
  assert.equal(americanoRounds(8, 9), 7, 'more courts than needed do not help');
});

// ── the guarantee for multiples of four ──
for (const n of [4, 8, 12, 16]) {
  test(`${n} players, enough courts: everyone partners everyone exactly once, nobody rests`, () => {
    const players = ids(n);
    const s = americanoSchedule(players, { courts: n / 4, rnd: seeded(n) });
    assert.equal(s.length, n - 1);
    assertValid(players, s, n / 4);
    const { partner, rests } = stats(players, s);
    assert.equal(Object.keys(partner).length, n * (n - 1) / 2);
    assert.ok(Object.values(partner).every(c => c === 1));
    assert.ok(Object.values(rests).every(c => c === 0));
  });
}

for (const n of [8, 16]) {
  test(`${n} players: everyone faces everyone exactly twice`, () => {
    const players = ids(n);
    for (const seed of [1, 2, 3]) {
      const { opponent } = stats(players, americanoSchedule(players, { courts: n / 4, rnd: seeded(seed) }));
      assert.equal(Object.keys(opponent).length, n * (n - 1) / 2, 'everyone meets everyone');
      assert.ok(Object.values(opponent).every(v => v === 2));
    }
  });
}

test('12 players: nobody faces the same opponent more than four times in 11 rounds', () => {
  const players = ids(12);
  for (const seed of [1, 2, 3, 4, 5]) {
    const { opponent } = stats(players, americanoSchedule(players, { courts: 3, rnd: seeded(seed) }));
    assert.ok(Math.max(...Object.values(opponent)) <= 4);
  }
});

// ── other player counts ──
for (const n of [5, 6, 7, 9, 10, 11, 13]) {
  test(`${n} players: valid rounds, fair resting, few repeated partners`, () => {
    const players = ids(n);
    const courts = Math.floor(n / 4);
    const s = americanoSchedule(players, { courts, rnd: seeded(n) });
    assert.equal(s.length, americanoRounds(n, courts));
    assertValid(players, s, courts);
    // resting stays fair after every single round
    for (let k = 1; k <= s.length; k++) assert.ok(spread(stats(players, s.slice(0, k)).rests) <= 1, 'rests after round ' + k);
    const { partner, games } = stats(players, s);
    assert.ok(spread(games) <= 1, 'games played differ by at most one');
    assert.ok(Math.max(...Object.values(partner)) <= 2, 'no pair partners more than twice');
  });
}

test('8 players on one court: four rest each round, resting stays fair', () => {
  const players = ids(8);
  const s = americanoSchedule(players, { courts: 1, rnd: seeded(5) });
  assert.equal(s.length, 14);
  assertValid(players, s, 1);
  assert.ok(s.every(r => r.matches.length === 1 && r.resting.length === 4));
  for (let k = 1; k <= s.length; k++) assert.ok(spread(stats(players, s.slice(0, k)).rests) <= 1);
  assert.ok(Math.max(...Object.values(stats(players, s).partner)) <= 2);
});

test('a chosen number of rounds is respected', () => {
  const s = americanoSchedule(ids(8), { courts: 2, rounds: 3, rnd: seeded(2) });
  assert.equal(s.length, 3);
  assert.ok(Object.values(stats(ids(8), s).partner).every(c => c === 1));
});

test('more rounds than a full rotation keep going and stay valid', () => {
  const players = ids(8);
  const s = americanoSchedule(players, { courts: 2, rounds: 10, rnd: seeded(2) });
  assert.equal(s.length, 10);
  assertValid(players, s, 2);
  assert.ok(Math.max(...Object.values(stats(players, s).partner)) <= 2);
});

test('the same random source gives the same schedule; the input is not modified', () => {
  const players = ids(9), copy = [...players];
  const a = americanoSchedule(players, { courts: 2, rnd: seeded(7) });
  const b = americanoSchedule(players, { courts: 2, rnd: seeded(7) });
  assert.deepEqual(a, b);
  assert.deepEqual(players, copy);
});

test('fewer than four players, no court or duplicate players are refused', () => {
  assert.throws(() => americanoSchedule(ids(3), { courts: 1 }), /4/);
  assert.throws(() => americanoSchedule(ids(8), { courts: 0 }));
  assert.throws(() => americanoSchedule(['a', 'a', 'b', 'c'], { courts: 1 }));
});

// ── standings ──
const M = (t1, t2, s1, s2) => ({ team1: t1, team2: t2, s1, s2 });

test('americanoStandings: each player gets the points of their team', () => {
  const rows = americanoStandings(ids(4), [M(['p1', 'p2'], ['p3', 'p4'], 14, 10)]);
  const r = id => rows.find(x => x.id === id);
  assert.deepEqual({ ...r('p1') }, { id: 'p1', played: 1, pts: 14, diff: 4, wins: 1, adjPts: 14, rank: 1 });
  assert.deepEqual({ ...r('p3') }, { id: 'p3', played: 1, pts: 10, diff: -4, wins: 0, adjPts: 10, rank: 3 });
});

test('americanoStandings: unplayed matches do not count', () => {
  const rows = americanoStandings(ids(4), [M(['p1', 'p2'], ['p3', 'p4'], null, null)]);
  assert.ok(rows.every(x => x.played === 0 && x.pts === 0 && x.adjPts === 0));
  assert.equal(rows.length, 4);
});

test('americanoStandings: a draw is a win for nobody', () => {
  const rows = americanoStandings(ids(4), [M(['p1', 'p2'], ['p3', 'p4'], 12, 12)]);
  assert.ok(rows.every(x => x.wins === 0 && x.pts === 12 && x.diff === 0));
});

test('americanoStandings: who played less gets their average for the missing matches', () => {
  // p5 rested once: 1 match with 16 points; the others played 2.
  const rows = americanoStandings(ids(5), [
    M(['p1', 'p2'], ['p3', 'p4'], 12, 12),
    M(['p1', 'p5'], ['p2', 'p3'], 16, 8),
  ]);
  const r = id => rows.find(x => x.id === id);
  assert.equal(r('p5').pts, 16);
  assert.equal(r('p5').adjPts, 32);          // 16 + average 16 for one missing match
  assert.equal(r('p4').adjPts, 24);          // 12 + average 12
  assert.equal(r('p1').adjPts, 28);          // played both
  assert.deepEqual(rows.map(x => x.id).slice(0, 2), ['p5', 'p1']);
});

test('americanoStandings: ties are ordered by point difference, then wins', () => {
  const rows = americanoStandings(ids(8), [
    M(['p1', 'p2'], ['p3', 'p4'], 20, 4),    // p1,p2: 20 (+16)
    M(['p5', 'p6'], ['p7', 'p8'], 20, 12),   // p5,p6: 20 (+8)
  ]);
  assert.deepEqual(rows.slice(0, 4).map(x => x.id), ['p1', 'p2', 'p5', 'p6']);
  assert.deepEqual(rows.map(x => x.rank), [1, 2, 3, 4, 5, 6, 7, 8]);
});
