# PadelChamp Web: code review, Supabase hardening, tournament formats

Date: 2026-11-16 (revised the same day: stay on Supabase)
Status: **signed off by Mulder on 2026-11-16** (decisions in section 7; nothing has been built yet)

## 1. Why

Three things were asked for:

1. A review of the current code.
2. A way around the Supabase free-plan pausing.
3. New event types: a classic tournament (groups, then playoffs) and Americano.

**Decided:** the app stays on Supabase. A scheduled GitHub Actions job keeps
the project active so it is not paused. Cloudflare Workers + D1 is the fallback
if that ever stops working (section 3, last part).

The review changes the shape of the rest. The current way of saving data is
unsafe and loses data when several people enter results at once, which is
exactly what a tournament does. Those problems are fixed on Supabase before
the tournament formats are built.

## 2. Code review

Scope: `index.html` (1107 lines, the whole app), `supabase/functions/analyze/index.ts`.
`PadelChamp.html` is a byte-identical copy of `index.html`.

### Critical

| # | Finding | Where |
|---|---|---|
| C1 | **The access keys are public.** The player and admin keys stand in plain text in the Edge Function source, and the GitHub repository is public. The SHA-256 hashes in the app protect nothing while the originals are readable next to them. | `supabase/functions/analyze/index.ts:1` |
| C2 | **Roles exist only in the browser.** The app writes to the database with the publishable key that ships in the page. Since those writes work, the database accepts writes from anyone. Viewer, player and admin are a UI convention; anyone who opens the page source can change or delete everything. (Inferred from the code; I did not probe the live database.) | `index.html:146-148`, `:266` |
| C3 | **Saving overwrites other people's work.** Every change uploads the full local state and then deletes every server row that is not in it. A phone with a stale page that saves one score deletes the matches someone else created in the meantime. | `index.html:174-203` |
| C4 | **Deleting the last item never reaches the server.** When a list is empty, the delete step is skipped. "Spieldaten löschen" empties everything locally, sends no delete, and the data returns on the next load. "Alles löschen" only clears the browser storage, with the same result. | `index.html:179`, `:1031`, `:1033` |

### Important

| # | Finding | Where |
|---|---|---|
| I1 | Save errors are invisible. `fetch` does not fail on HTTP 4xx/5xx and the result is never checked, so a rejected save looks like a successful one. Saves are also not queued, so two quick changes can interleave. | `index.html:177-202`, `:209` |
| I2 | Stored script injection. Season names are inserted as HTML. Combined with C2, anyone can plant a script that runs for every visitor. | `index.html:127`, `:859` |
| I3 | Deleting a player is a hard delete. Old matches then show "?" and the player's past results drop out of the ranking retroactively. The `isActive` field exists but is never used for this. | `index.html:947` |
| I4 | A match saved without a winner (0:0, or 1:1 in sets) counts as a **loss for all four players**. The iOS app treats 0:0 as "did not take place". With points per loss above zero this also hands out points. | `index.html:255-257`, `:467` |
| I5 | No score validation: 7:7 or a tied set can be saved. In a playoff this would leave a match without a winner. | `index.html:440-444` |
| I6 | The AI endpoint forwards any prompt to Gemini for anyone holding the (public) key, with no rate limit. | `supabase/functions/analyze/index.ts` |

### Quality

- One 88 KB file with no tests. Scheduling and ranking are pure logic and easy to test once separated from the DOM code.
- `PadelChamp.html` duplicates `index.html`; the two will drift.
- IDs come from a millisecond counter (`index.html:120`); two devices can produce the same ID. `crypto.randomUUID()` avoids this.
- Events are created with status `planned`, while the save path defaults to `scheduled` (`:185`, `:900`). Harmless today, confusing later.
- The deployed function is called `dynamic-endpoint`, the folder `analyze`.

## 3. Backend: stay on Supabase, keep it awake, harden it

### Keep-alive job

- A workflow file `.github/workflows/keepalive.yml` in the existing repo.
- Runs twice a week (Monday and Thursday morning) and can also be started by hand.
- It makes one small read against the database (the `settings` table) with the publishable key, which is public in the page anyway, so no secret is needed. Once the database is closed to that key the read returns nothing, but it is still a database request, which is what counts.
- If the answer is not a success, the run fails and GitHub emails you. That is the signal that the project was paused or the rule changed.

Known limits of this workaround:

- GitHub switches off scheduled workflows in public repos after 60 days without repository activity. It emails you first; any commit or one click turns it back on.
- Supabase does not promise that a keep-alive counts forever. If the project does pause, it is restored from the dashboard without data loss.

### Hardening

Reading and writing both require a key and both go through one new Edge Function:

- **The database is closed to the public key.** Row-level security is switched on for all eight tables with no public rule at all, neither read nor write.
- **Reading:** the function returns the full dataset to anyone who sends a valid key (viewer, player or admin). Without a key the app shows a "key needed" screen and nothing else.
- **Three keys instead of two:** a new read-only viewer key, so a link that only shows results can still be shared. (My call; the viewer role had no key before.)
- **Writing:** the function takes a list of small changes ("upsert match X", "delete team Y"), checks the key from a request header against hashes stored as function secrets (not in the repo), and allows each change by role: players may change events, teams, matches and scores; admin may also change players, seasons, settings and reset data.
- **One request, one transaction.** The function hands the checked list to a database function that applies it in a single transaction, so a save is never half-applied.
- **The AI function** reads its allowed keys from secrets as well and gets a simple per-day cap (I6).

In the app, the existing actions stay as they are. Only the save step changes:
after each action the app compares the state before and after and sends just
the rows that changed or were removed **by this action**. That removes C3 and
C4 without rewriting the action code. Failed saves show a visible warning and
are retried (I1). While an event is running, the app re-reads the state every
15 seconds and when the tab regains focus, so several phones stay in step.

### Rollout steps

1. Export all Supabase data to a local JSON file as a backup. It stays on your machine; the script reports row counts only.
2. Add the keep-alive workflow (independent of everything else, can go first).
3. Build the write function and the new save step; test against a local Supabase with made-up data.
4. Deploy the function, switch the app over, check on two devices.
5. Switch on row-level security. From here the old direct writes are refused.
6. **New access keys** (C1): the old ones are public and must not be reused. The old keys also remain in the public git history; rotating them makes that harmless, rewriting history is not planned.

Database changes and function deploys need your Supabase login. I prepare the
SQL and the function code in the repo (`supabase/migrations/`,
`supabase/functions/`); you run the deploy, or start it from the session.

### Fallback: Cloudflare Workers + D1

Kept on file in case the keep-alive stops working. It was the best free
alternative found: it does not pause, stores the data (SQLite, 5 M rows
read/day, 100k rows written/day, 5 GB), checks keys on the server and hosts
the Gemini proxy in the same place. Firebase's free plan cannot host the AI
proxy; Neon and Turso need a separate server for the key check. The write
design above (list of small changes, checked by role) moves over unchanged.

## 4. Tournament formats

An event gets a **format**, chosen when it is created:

- **Padel Day** (today's behaviour, unchanged): new random or manual teams per round, everyone against everyone.
- **Americano**
- **Classic tournament** (groups, then playoffs)

**Tournaments never count towards the season ranking.** Only Padel Day matches
do. Each tournament has its own ranking or final placing.

### Americano

- Played by individuals. Partners and opponents rotate every round.
- Setup: participants, number of courts, points per match (16, 21, 24 or 32), number of rounds (default: enough that everyone partners with everyone once where the player count allows it).
- The whole schedule is generated up front and shown per round and court.
- If the player count is not a multiple of four, or exceeds the courts, players sit out in turn; nobody sits out twice before everyone has sat out once.
- Pairing rule: avoid repeating a partner first, then avoid repeating opponents.
- Score entry: one number per team; entering one side fills the other from the match total.
- Ranking: sum of own points; ties by point difference, then wins. Players who sat out more get the average of their played matches for the missing ones (the usual Americano rule).

### Classic tournament

- Played by **fixed pairs** for the whole tournament, drawn at random or built by hand with the existing team builder.
- Setup: 1, 2 or 4 groups; how many pairs advance per group; match length (best of three as today, or one set); third-place match yes/no.
- Group stage: everyone against everyone inside the group. Table order: points, set difference, game difference, direct encounter, then a draw the organiser confirms.
- Playoffs: generated when the last group match is saved. Crossed seeding (winner of A against runner-up of B, and so on). Each next round appears when the previous one is complete.
- The setup only offers combinations that give 2, 4 or 8 playoff pairs, so the bracket never needs byes.
- Playoff matches must have a winner (fixes I5 for this case).
- Screens: group tables, match list per group, a bracket view, a final placing.

### What this changes underneath

- Event: new fields `format` and `config` (the setup choices).
- Team: optional `group`; for classic tournaments a team belongs to the whole event, not to a round.
- Match: new fields `stage` (group, quarter-final, semi-final, final, third place), `court`, and a scoring kind (sets or points).
- Existing events become format "Padel Day"; nothing else about them changes.
- The schedule, table and bracket logic lives in its own files without any DOM code, covered by tests (`node --test`, no build step, no dependencies).
- The single HTML file is split into a handful of plain browser modules. Still no build step; GitHub Pages serves them as they are.

## 5. Order of work

Each phase ends in a working app and is reviewed by you before the next starts.

| Phase | Content | Fixes |
|---|---|---|
| 0. Safety net | Data backup; keep-alive workflow; split the file into modules; tests for the existing ranking and round logic; a check that `PadelChamp.html` equals `index.html` | Pausing, quality |
| 1. Harden Supabase | Read/write function, new save step, row-level security, three new keys, capped AI function | C1-C4, I1, I2, I6 |
| 2. Small fixes | Deactivate players instead of deleting (I3); 0:0 means "did not take place" and counts for nobody, other results without a winner are refused (I4, I5); random IDs | I3-I5 |
| 3. Tournament logic | Americano schedule, group tables, bracket, all tested without UI | |
| 4. Tournament screens | Format choice, setup, Americano view, groups and bracket views, points score entry | |

After sign-off, phase by phase gets a detailed step plan before code is written.

## 6. Not included

- Moving away from Supabase (fallback only, see section 3).
- The iOS app (it does not use Supabase). Tournament formats on iOS would be a separate project.
- Mexicano (pairing by current ranking) and team Americano. The Americano design leaves room for them.
- Personal accounts and logins. Access stays key-based.
- Live push updates. Re-reading every 15 seconds is enough for this size.
- Brackets with byes, double elimination, consolation rounds.

## 7. Decisions

Decided:

- **Backend:** stay on Supabase, keep-alive via GitHub Actions (2026-11-16).

- **Season ranking:** tournaments do not count, neither classic nor Americano.
- **0:0 result:** means "did not take place", as on iOS. It counts for nobody.
- **`PadelChamp.html`:** stays and must remain identical to `index.html`.
- **Reading:** always requires a key.

Nothing is open.

## 8. Choices I made that you may want to overrule

- Splitting the single file into modules, with tests but no build step.
- Phase order: hardening before tournaments, because tournaments make C3 much worse.
- Keep-alive twice a week, reading one row with the public key.
- A third, read-only viewer key, so results can still be shared without giving write access.
- `PadelChamp.html` stays an identical copy, checked by a test. After the split into modules both files load the same module files, so the copy no longer works as a single file sent around on its own. If you need that, the split has to be dropped; say so before phase 0.
- Results without a winner other than 0:0 (for example 1:1 in sets) are refused at entry.
- Americano match lengths offered (16/21/24/32) and the sit-out average rule.
- Group tie-break order, and that playoffs are created only after the group stage ends.
- Old keys are rotated, git history is left alone.
- Polling every 15 seconds instead of live updates.
