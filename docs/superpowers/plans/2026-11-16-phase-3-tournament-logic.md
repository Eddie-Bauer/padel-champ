# Phase 3: Tournament Logic — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Everything a tournament needs to compute (schedules, tables, brackets), as pure functions with tests. No screens, no database changes; those are phase 4.

**Architecture:** One new module `js/tournament.js` without DOM, storage or global state, like `js/logic.js`. Randomness comes in as a parameter so tests are repeatable.

**Spec:** `docs/superpowers/specs/2026-11-16-backend-and-tournaments-design.md` (section 4)

## Global Constraints

- Pure functions only. Nothing in the live app changes in this phase.
- Tests use made-up ids (`p1`, `t1`, ...).
- Classic matches use the existing match shape (`team1Id`, `team2Id`, `t1s1` ... `winnerTeamId`, `status`), so score entry and storage need no second format.

## Americano

| Function | Rule |
|---|---|
| `americanoRounds(n, courts)` | Default number of rounds: enough for everyone to partner everyone once, `ceil(n·(n−1) / (4·matchesPerRound))`, with `matchesPerRound = min(courts, floor(n/4))`. |
| `americanoSchedule(playerIds, {courts, rounds, rnd})` | Returns `[{round, matches: [{court, team1: [a,b], team2: [c,d]}], resting: [ids]}]`. Needs at least 4 players. |
| Who rests | Players with the fewest rests so far rest next, so nobody rests twice before everyone has rested once. |
| Partners | When the player count is a multiple of four and there are enough courts, a fixed rotation guarantees that everyone partners everyone exactly once. Otherwise each round picks the pairing with the fewest repeated partners. |
| Opponents | Within a round, pairs are matched so that repeated opponents are as few as possible. |
| `americanoStandings(playerIds, matches)` | `matches`: schedule matches with `s1`, `s2` (points per team, `null` while unplayed). Row: `{id, played, pts, diff, wins, adjPts, rank}`. A player who played fewer matches than the most active player gets their own average for each missing match (`adjPts`, one decimal). Order: `adjPts`, `diff`, `wins`. |

## Classic (groups, then playoffs)

| Function | Rule |
|---|---|
| `classicOptions(nTeams)` | The setups that are allowed: groups 1, 2 or 4; balanced sizes of at least 2; teams advancing per group such that the playoff has 2, 4 or 8 teams. Returns `[{groups, advance, playoffSize}]`. |
| `drawGroups(teamIds, groups, rnd)` | Random, sizes differ by at most one. |
| `groupTable(teamIds, matches, tiebreak?)` | Row: `{id, played, wins, losses, sd, gd, rank, tied}`. Order: wins, set difference, game difference, direct encounter among the teams still level. Teams that are still level share `tied: true`; an optional `tiebreak` list of ids (the draw the organiser confirmed) settles them. Matches without a winner are ignored. |
| `seedPlayoff(tables, advance)` | First playoff round, crossed: with two groups A1–B2 and B1–A2; with four groups A1–B2, C1–D2, B1–A2, D1–C2; teams from the same group can meet again only as late as possible. One group: 1–4, 2–3 (or 1–2 as final; 1–8, 4–5, 2–7, 3–6). Returns `{stage, pairs}`; `stage` is `quarter`, `semi` or `final`. |
| `nextPlayoffRound(stage, matches, {thirdPlace})` | From the finished matches of one stage (in bracket order) to the next: winners 1–2, 3–4, ... After the semi-finals also the match for third place if wanted. Returns `[{stage, team1Id, team2Id}]`, or `null` while a match has no winner. |
| `finalPlacing({final, third, semis})` | Places 1 to 4; without a third-place match both semi-final losers are third. |

## Tasks

1. Americano schedule and default rounds, tests first: structure, rest fairness, the perfect-rotation guarantee for 4, 8, 12, 16 players, partner repeats bounded otherwise, court limits.
2. Americano standings, tests first.
3. Classic: options, group draw, table with tie handling, tests first.
4. Classic: playoff seeding, next round, final placing, tests first.

## Review Focus

1. Player counts that are not a multiple of four (5, 6, 7, 9, 10): every round must still be valid and resting fair.
2. Fewer courts than the player count allows (8 players, 1 court).
3. Three teams level on everything in a group: must not crash, must be flagged as tied, and the organiser's order must settle it.
4. A playoff match without a winner: the next round must not be created.
5. Fewer than 4 players, or a team count with no valid setup: a clear refusal, not a broken schedule.
