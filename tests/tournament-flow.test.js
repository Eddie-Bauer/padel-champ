// A whole Americano and a whole classic tournament, driven through the same
// actions the screens call, against a stand-in DOM and a fake server.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { installFakeDom } from './helpers/fake-dom.js';
import { toRows } from '../js/sync.js';
import { americanoConfig, classicConfig, americanoRounds } from '../js/tournament.js';

const data = {
  players: Array.from({ length: 8 }, (_, i) => ({ id: 'p' + (i + 1), name: 'P' + (i + 1), isActive: true })),
  seasons: [{ id: 's1', name: 'Test', startDate: '2026-01-01', endDate: '2026-12-31', isActive: true }],
  events: [], evP: [], teams: [], matches: [], byeMap: {}, settings: { ptsWin: 3, ptsLoss: 0 },
};

let main, store, actions;
const sent = [];
const tick = () => new Promise(r => setTimeout(r, 0));
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
  actions = await import('../js/actions.js');
  await main.ready;
});

const open = id => { store.S.tab = 'events'; store.S.selEv = id; };
const renders = () => assert.doesNotThrow(() => main.render());
const eventMatches = id => store.S.matches.filter(m => m.eid === id).sort((a, b) => a.rnd - b.rnd || a.seq - b.seq);

// ── setup defaults ──
test('americanoConfig: sensible defaults, clamped to what the player count allows', () => {
  assert.deepEqual(americanoConfig({}, 8), { courts: 2, points: 21, rounds: 7 });
  assert.deepEqual(americanoConfig({ courts: 9, points: 24, rounds: 3 }, 8), { courts: 2, points: 24, rounds: 3 });
  assert.deepEqual(americanoConfig({ courts: 1 }, 8), { courts: 1, points: 21, rounds: americanoRounds(8, 1) });
  assert.deepEqual(americanoConfig({ points: 17, rounds: 0 }, 5), { courts: 1, points: 21, rounds: 5 });
});

test('classicConfig: picks an allowed setup, by default the one with semi-finals', () => {
  assert.deepEqual(classicConfig({}, 4), { groups: 1, advance: 4, playoffSize: 4, mode: 'playoff', sets: 'bo3', thirdPlace: false });
  assert.deepEqual(classicConfig({ groups: 2, advance: 1, sets: 'one', thirdPlace: true }, 4), { groups: 2, advance: 1, playoffSize: 2, mode: 'playoff', sets: 'one', thirdPlace: false });
  assert.deepEqual(classicConfig({ groups: 2, advance: 2, thirdPlace: true }, 8), { groups: 2, advance: 2, playoffSize: 4, mode: 'playoff', sets: 'bo3', thirdPlace: true });
  assert.deepEqual(classicConfig({ groups: 4, advance: 2 }, 4).groups, 1, 'a setup that does not fit the team count falls back');
  assert.equal(classicConfig({}, 1), null);
});

// ── Americano ──
let am;
test('Americano: created with its own name and format; setup screen renders', async () => {
  am = actions.addEvent('2026-10-04', 'americano');
  const ev = store.S.events.find(e => e.id === am);
  assert.equal(ev.format, 'americano');
  assert.equal(ev.name, 'Americano 04.10.2026');
  open(am); renders();
  store.S.players.forEach(p => actions.toggleParticipant(am, p.id));
  actions.setEventConfig(am, { points: 24 });
  renders();
  await tick();
});

test('Americano: starting creates every round up front', async () => {
  sent.length = 0;
  actions.startAmericano(am);
  await tick();
  const ev = store.S.events.find(e => e.id === am);
  assert.equal(ev.status, 'active');
  assert.deepEqual(ev.config, { courts: 2, points: 24, rounds: 7 });
  const ms = eventMatches(am);
  assert.equal(ms.length, 14);
  assert.deepEqual([...new Set(ms.map(m => m.rnd))], [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(ms.slice(0, 2).map(m => m.court), [1, 2]);
  assert.equal(store.S.teams.filter(t => t.eid === am).length, 28);
  assert.ok(sent.some(o => o.t === 'matches' && o.row.court === 2));
  renders();
});

test('Americano: a result is points per team; the ranking adds them up', async () => {
  const [m] = eventMatches(am);
  actions.saveAmericanoScore(m.id, 15, 9);
  await tick();
  assert.deepEqual([m.t1s1, m.t2s1, m.status, m.winnerTeamId], [15, 9, 'completed', m.team1Id]);
  store.S.sub = 'table'; renders();
  store.S.sub = 'plan'; renders();
  actions.saveAmericanoScore(m.id, 12, 12);
  assert.equal(m.winnerTeamId, null, 'a draw has no winner');
  actions.resetScore(m.id);
  assert.deepEqual([m.t1s1, m.status], [null, 'scheduled']);
});

test('Americano: it never touches the season ranking', () => {
  eventMatches(am).forEach(m => actions.saveAmericanoScore(m.id, 14, 10));
  assert.ok(store.standings().every(r => r.mp === 0));
  renders();
});

test('Americano: the schedule can be discarded', async () => {
  actions.resetTournament(am);
  await tick();
  assert.equal(eventMatches(am).length, 0);
  assert.equal(store.S.teams.filter(t => t.eid === am).length, 0);
  assert.equal(store.S.events.find(e => e.id === am).status, 'planned');
  renders();
});

// ── Classic ──
let cl;
const decide = (m, winnerId) => actions.saveScore(m.id, winnerId === m.team1Id ? [{ t1: 6, t2: 3 }] : [{ t1: 3, t2: 6 }]);

test('Classic: teams are drawn once for the whole tournament', async () => {
  cl = actions.addEvent('2026-10-05', 'classic');
  assert.equal(store.S.events.find(e => e.id === cl).name, 'Turnier 05.10.2026');
  open(cl); renders();
  store.S.players.forEach(p => actions.toggleParticipant(cl, p.id));
  renders();
  actions.drawClassicTeams(cl);
  await tick();
  const teams = store.S.teams.filter(t => t.eid === cl);
  assert.equal(teams.length, 4);
  assert.ok(teams.every(t => t.rnd === 0 && t.grp === null));
  renders();
});

test('Classic: starting draws the groups and creates the group matches', async () => {
  actions.setEventConfig(cl, { groups: 2, advance: 2, thirdPlace: true, sets: 'one' });
  renders();
  actions.startClassic(cl);
  await tick();
  const teams = store.S.teams.filter(t => t.eid === cl);
  assert.deepEqual(teams.map(t => t.grp).sort(), ['A', 'A', 'B', 'B']);
  const ms = eventMatches(cl);
  assert.equal(ms.length, 2);
  assert.ok(ms.every(m => m.stage === 'group' && m.rnd === 1));
  assert.equal(store.S.events.find(e => e.id === cl).status, 'active');
  renders();
});

test('Classic: a result without a winner is refused', () => {
  const [m] = eventMatches(cl);
  assert.equal(actions.saveScore(m.id, [{ t1: 0, t2: 0 }]).ok, false);
  assert.equal(m.status, 'scheduled');
});

test('Classic: the last group result creates the semi-finals by itself', async () => {
  const groups = eventMatches(cl);
  decide(groups[0], groups[0].team1Id);
  assert.equal(eventMatches(cl).length, 2, 'not yet');
  decide(groups[1], groups[1].team1Id);
  await tick();
  const semis = eventMatches(cl).filter(m => m.stage === 'semi');
  assert.equal(semis.length, 2);
  // Crossed: winner of one group against the runner-up of the other.
  const grp = id => store.S.teams.find(t => t.id === id).grp;
  for (const s of semis) assert.notEqual(grp(s.team1Id), grp(s.team2Id));
  store.S.sub = 'groups'; renders();
  store.S.sub = 'playoff'; renders();
});

test('Classic: group results are closed once the playoff has started', () => {
  const g = eventMatches(cl).find(m => m.stage === 'group');
  const before = g.winnerTeamId;
  assert.equal(actions.saveScore(g.id, [{ t1: 0, t2: 6 }]).ok, false);
  assert.equal(g.winnerTeamId, before);
});

test('Classic: semi-finals lead to third place and final; the final decides the placing', async () => {
  const semis = eventMatches(cl).filter(m => m.stage === 'semi');
  semis.forEach(m => decide(m, m.team1Id));
  await tick();
  const third = eventMatches(cl).find(m => m.stage === 'third'), final = eventMatches(cl).find(m => m.stage === 'final');
  assert.ok(third && final);
  assert.deepEqual([final.team1Id, final.team2Id], semis.map(m => m.team1Id));
  renders();
  decide(third, third.team2Id);
  decide(final, final.team1Id);
  await tick();
  assert.equal(eventMatches(cl).length, 6, 'nothing is created after the final');
  renders();
  assert.ok(store.standings().every(r => r.mp === 0), 'the season ranking stays untouched');
});

test('Classic: a circle of three is settled by the draw, then the playoff starts', async () => {
  const id = actions.addEvent('2026-10-06', 'classic');
  // Six players, three teams, one group, the first two advance to the final.
  store.S.players.slice(0, 6).forEach(p => actions.toggleParticipant(id, p.id));
  actions.drawClassicTeams(id);
  actions.setEventConfig(id, { groups: 1, advance: 2, sets: 'one' });
  actions.startClassic(id);
  const [x, y, z] = eventMatches(id);          // x: t1-t2, y: t1-t3, z: t2-t3
  actions.saveScore(x.id, [{ t1: 6, t2: 4 }]);  // t1 beats t2
  actions.saveScore(y.id, [{ t1: 4, t2: 6 }]);  // t3 beats t1
  actions.saveScore(z.id, [{ t1: 6, t2: 4 }]);  // t2 beats t3
  assert.equal(eventMatches(id).length, 3, 'tied: no final yet');
  open(id); store.S.sub = 'groups'; renders();
  actions.drawTiebreak(id, 'A');
  await tick();
  const ev = store.S.events.find(e => e.id === id);
  assert.equal(ev.config.tiebreak.A.length, 3);
  const final = eventMatches(id).find(m => m.stage === 'final');
  assert.deepEqual([final.team1Id, final.team2Id], ev.config.tiebreak.A.slice(0, 2));
  renders();
});

test('Classic with placement matches: 1st against 1st, 2nd against 2nd, then the placing', async () => {
  const id = actions.addEvent('2026-10-07', 'classic');
  store.S.players.forEach(p => actions.toggleParticipant(id, p.id));
  actions.drawClassicTeams(id);
  actions.setEventConfig(id, { groups: 2, mode: 'placement', sets: 'one' });
  open(id); renders();
  actions.startClassic(id);
  assert.equal(store.S.events.find(e => e.id === id).config.mode, 'placement');
  const groups = eventMatches(id);
  groups.forEach(m => decide(m, m.team1Id));
  await tick();
  const pm = eventMatches(id).filter(m => m.stage === 'place');
  assert.equal(pm.length, 2);
  const grp = tid => store.S.teams.find(t => t.id === tid).grp;
  // Group winners meet each other, runners-up meet each other.
  assert.deepEqual(pm[0].team1Id && [groups.map(g => g.team1Id).includes(pm[0].team1Id), groups.map(g => g.team1Id).includes(pm[0].team2Id)], [true, true]);
  for (const m of pm) assert.notEqual(grp(m.team1Id), grp(m.team2Id));
  store.S.sub = 'playoff'; renders();
  pm.forEach(m => decide(m, m.team1Id));
  await tick();
  assert.equal(eventMatches(id).length, 4);
  renders();
  store.S.sub = 'groups'; renders();
});

test('the minimum number of matches for the ranking can be changed', async () => {
  assert.equal(store.minMatches(), 10);
  sent.length = 0;
  actions.setPoints('minMatches', 6);
  await tick();
  assert.equal(store.minMatches(), 6);
  assert.deepEqual(sent, [{ t: 'settings', a: 'upsert', row: { id: 1, pts_win: 3, pts_loss: 0, min_matches: 6 } }]);
  assert.doesNotThrow(() => main.setTab('settings'));
  assert.doesNotThrow(() => main.setTab('standings'));
  assert.doesNotThrow(() => main.setTab('players'));
});

test('Start and the + button cope with tournaments', () => {
  assert.doesNotThrow(() => main.setTab('start'));
  assert.doesNotThrow(() => main.setTab('events'));
});
