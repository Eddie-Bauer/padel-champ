# Phases 1 and 2: Harden Supabase, Small Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nobody without a key can read or change data, saving no longer overwrites other people's work, and the review findings I1-I6 are fixed.

**Architecture:** The browser talks to one Supabase Edge Function (`api`). The function checks the key, decides the role, and reads or writes the database with the service key through two database functions (`get_state`, `apply_ops`), each one transaction. The browser sends only the rows an action changed, computed by comparing the last state the server confirmed with the current one.

**Tech Stack:** Plain JS modules, one self-contained Edge Function file (Deno, no imports), PL/pgSQL, `node --test`.

**Spec:** `docs/superpowers/specs/2026-11-16-backend-and-tournaments-design.md` (sections 3 and 5)

## Global Constraints

- No Supabase CLI, Deno or Docker on this machine. Database SQL and the function are pasted into the Supabase dashboard by Mulder. Everything is written for that: one SQL file per step, one function file without imports.
- The function is developed and tested under Node (it only calls `Deno` when that exists).
- SQL is verified once against an in-memory Postgres (PGlite) in a scratch folder. That is a one-off check, not part of the repo or CI.
- No push or merge to `main` before the function is deployed: the new client cannot work without it.
- No keys, hashes or player names in the repo. Tests use `P1`, `P2`, ...
- Table columns are exactly those found in the backup (types checked, values not read): ids are text.

## Decisions

| Topic | Decision |
|---|---|
| Endpoint | `POST /functions/v1/api`, JSON body `{action}`, key in header `x-pc-key`. "Verify JWT" is switched off for this function; the function's own key check replaces it. |
| Actions | `state` (any role), `ops` (player, admin), `analyze` (player, admin) |
| Roles | From the key. Hashes live in function secrets `PC_VIEWER_HASH`, `PC_PLAYER_HASH`, `PC_ADMIN_HASH` (SHA-256 hex). The browser learns its role from the `state` answer; the hashes leave the client. |
| Who may write what | `players`, `seasons`, `settings`: admin. `events`: upsert player, delete admin. `event_players`, `teams`, `matches`, `bye_map`: player. |
| Op format | `{t, a:'upsert', row}` or `{t, a:'delete', key}`. Rows use database column names. Keys: `{id}`; `event_players` `{event_id, player_id}`; `bye_map` `{event_id, rnd}`. |
| Op order | Upserts parents first (players, seasons, events, event_players, teams, matches, bye_map, settings), then deletes children first (matches, teams, bye_map, event_players, events, seasons, players). |
| Save | One request in flight. On failure a red banner "Nicht gespeichert" and a retry every 10 s. Because the diff is always "last confirmed state vs now", a retry carries everything still unsaved. |
| Refresh | Every 15 s while the tab is visible and nothing is unsaved; re-render only if the data changed. |
| No key / wrong key | A screen "Zugangs-Key nötig" / "Key ungültig"; nothing else is shown. |
| Server unreachable | Last local copy is shown read-only with a banner "Offline". |
| AI cap | 40 requests per day, counted in a table `ai_usage`. |
| Default data | The hard-coded default players are removed from the source. |
| "Alles löschen" | Deletes all game data and players on the server and resets the points; seasons stay. |
| Script injection (I2) | `el()` call sites that insert data use `textContent`. |
| Old AI function | `supabase/functions/analyze` is removed from the repo; Mulder deletes `dynamic-endpoint` in the dashboard. |

Phase 2:

| Topic | Decision |
|---|---|
| Score check (I5) | `checkScore(sets) -> {ok, notPlayed, error}`. All sets 0:0: not played. Otherwise any tied set, or no overall winner: refused with a German message. |
| 0:0 (I4) | Stored as completed without winner, so the round can finish. The ranking skips matches without a winner. The card shows "Nicht gespielt". |
| Players (I3) | "Löschen" becomes "Deaktivieren" (admin). Inactive players are listed below with "Reaktivieren". |
| IDs | `crypto.randomUUID()`. Avatar colours keep the old rule for numeric ids and use a string hash for new ones. |

## Tasks

1. `js/sync.js`: `toRows(state)`, `fromRows(rows)`, `diffOps(prevRows, nextRows)` with tests (no change gives no ops; changed row gives one upsert; removed row gives one delete; removing the last row of a table gives a delete (C4); order as decided; settings; bye map).
2. `supabase/sql/01_functions.sql` (`get_state`, `apply_ops`, `ai_usage`, `bump_ai_usage`, execute revoked from public roles) and `supabase/sql/02_lockdown.sql` (row-level security on, existing policies dropped). Verified in PGlite: round trip, rollback of a failing batch, anon cannot call the functions.
3. `supabase/functions/api/index.ts` with tests under Node against a fake database: every role and action, forbidden ops, malformed bodies, CORS preflight, AI cap, wrong and missing key.
4. Client: `store.js` on the new API (load, role, save queue, retry, refresh), key and offline screens, I2 fix, AI call, defaults removed. Smoke test adapted with a fake `fetch` that plays the server.
5. `scripts/make-keys.mjs`, `docs/rollout-phase-1.md`, old function removed.
6. Phase 2 changes, each test first.
7. Hand over: rollout guide to Mulder; merge only after the function answers.

## Review Focus

1. Two phones: phone B is stale and saves one score. Phone A's newer matches must survive. (Task 1: diff contains only B's row.)
2. A save fails halfway on the server: nothing of that batch may be stored. (Task 2: rollback test.)
3. A player key tries an admin change through the API directly: refused, and nothing of the batch applied. (Task 3)
4. Request without key, with a wrong key, or with a body that is not JSON: 401/400, never a crash or data. (Task 3)
5. The last match of the only event is deleted: it must stay deleted after reload. (Task 1)
