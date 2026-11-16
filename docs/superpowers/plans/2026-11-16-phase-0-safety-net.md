# Phase 0: Safety Net Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back up the data, keep Supabase awake, and turn the single-file app into tested browser modules without changing what it does.

**Architecture:** `index.html` keeps the CSS and page shell and loads `js/main.js` as a native ES module. Pure logic (ranking, team draw, round schedule) moves into `js/logic.js` with no DOM and no globals, tested with `node --test`. Everything else is moved verbatim into modules; the only edits are `import`/`export` lines and the few call sites named below.

**Tech Stack:** Plain JavaScript ES modules, Node 22+ built-in test runner, GitHub Actions. No dependencies, no build step.

**Spec:** `docs/superpowers/specs/2026-11-16-backend-and-tournaments-design.md` (section 5, phase 0)

## Global Constraints

- No build step and no npm dependencies. GitHub Pages serves the files as they are.
- **Behaviour must not change in this phase.** Known bugs from the review (C1-C4, I1-I6) stay; they belong to phases 1 and 2.
- `PadelChamp.html` must stay byte-identical to `index.html`.
- Work on branch `phase-0-safety-net`. **No push and no merge to `main`**: `main` is what GitHub Pages serves. Mulder decides when it goes live.
- Commit messages carry no `Co-Authored-By` line.
- Real data: scripts that touch it print row counts only. Tests use made-up players (`P1`, `P2`, ...). Backups never enter git.
- localStorage key stays `padelchamp_v1` with the same payload shape.

## Review Focus

1. A team references a player that no longer exists: the ranking must not throw; the row is dropped. (Task 4)
2. Odd player count: the same player must not get the bye two rounds in a row; fewer than two players gives no teams and no error. (Task 4)
3. Supabase is paused or answers with an error object: the backup must exit non-zero and write **no** file, so a failed run never looks like an empty backup. (Task 2)
4. A phone that already has saved state under `padelchamp_v1`: the split app must start from it exactly as before. (Task 5)
5. The page is opened from the file system (`file://`), where browsers block modules: the user sees a German hint instead of a blank page. (Task 5)

## File Structure

| File | Responsibility |
|---|---|
| `package.json` | `"type": "module"`, `"private": true`, script `test` = `node --test` |
| `.gitignore` | `backups/`, `node_modules/` |
| `.github/workflows/test.yml` | run `npm test` on every push |
| `.github/workflows/keepalive.yml` | twice-weekly database read |
| `scripts/backup.mjs` | export all tables to `backups/`, print counts |
| `js/logic.js` | pure functions: winner, ranking, team draw, round robin |
| `js/theme.js` | `THEMES`, `C`, `setTheme`, `applyThemeCss` |
| `js/dom.js` | `el`, `div`, `span`, `txt`, `abg`, `afg`, `ini`, `mkAvatar`, `sectionHeader`, `mkRndBtn`, `fmtDate`, `fmtDateShort`, `ymd` |
| `js/store.js` | auth, Supabase load/save, localStorage, state `S`, getters, `mut`, change notification |
| `js/actions.js` | `genTeams`, `applyManualTeams`, `genMatches`, `deleteMatch`, `exportCSV`, `exportTXT` |
| `js/views/match.js` | `mkMatchCard`, `openScoreModal` |
| `js/views/teambuilder.js` | `openTeamBuilder` |
| `js/views/{detail,home,ki,standings,events,players,settings}.js` | one screen each, same function names as today |
| `js/main.js` | `render`, `setTab`, nav wiring, boot |
| `tests/*.test.js`, `tests/helpers/fake-dom.js` | tests |

---

### Task 1: Test tooling and the HTML copy check

**Files:**
- Create: `package.json`, `.gitignore`, `.github/workflows/test.yml`, `tests/html-copy.test.js`

- [ ] **Step 1:** `git switch -c phase-0-safety-net`
- [ ] **Step 2:** Create `package.json` and `.gitignore` as in the File Structure table.
- [ ] **Step 3:** Write `tests/html-copy.test.js`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL('../' + f, import.meta.url));

test('PadelChamp.html is byte-identical to index.html', () => {
  assert.ok(read('index.html').equals(read('PadelChamp.html')));
});

test('backups are ignored by git', () => {
  assert.match(read('.gitignore').toString(), /^backups\/$/m);
});
```

- [ ] **Step 4:** Run `npm test`. Expected: 2 tests pass.
- [ ] **Step 5:** Create `.github/workflows/test.yml`: on `push` and `pull_request`, `ubuntu-latest`, `actions/checkout@v4`, `actions/setup-node@v4` with `node-version: 22`, then `npm test`.
- [ ] **Step 6:** Commit: `chore: test tooling, HTML copy check, CI`

### Task 2: Data backup

**Files:**
- Create: `scripts/backup.mjs`, `tests/backup.test.js`

**Interfaces:**
- Produces: `TABLES` (array of the 8 table names: `players, seasons, events, event_players, teams, matches, bye_map, settings`), `fetchAll(fetchFn, baseUrl, key) -> Promise<Record<string, object[]>>`, `counts(data) -> Record<string, number>`.

- [ ] **Step 1:** Write `tests/backup.test.js` with a fake `fetchFn`:
  - `fetchAll` returns one array per name in `TABLES` when every response is `ok` with a JSON array.
  - `fetchAll` rejects when a response has `ok: false`.
  - `fetchAll` rejects when a response is `ok` but the body is not an array (the shape Supabase uses for errors).
  - `counts({players:[{},{}], seasons:[]})` deep-equals `{players:2, seasons:0}`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `scripts/backup.mjs`. Exports as above. When run directly (`import.meta.url` is the entry file): take URL and publishable key from the same constants the app uses (copy both values from `index.html:146-147`), call `fetchAll(fetch, ...)`, write `backups/padelchamp-YYYYMMDD-HHMMSS.json` (create the folder), print one line per table with **the count only**, then the file path. On any rejection: print the error message, write nothing, `process.exit(1)`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Run `node scripts/backup.mjs`. Expected: 8 count lines and a path; `git status` does not list `backups/`.
- [ ] **Step 6:** Commit: `feat: local data backup script (counts only)`

### Task 3: Keep-alive workflow

**Files:**
- Create: `.github/workflows/keepalive.yml`

- [ ] **Step 1:** Write the workflow: name `Supabase keep-alive`; triggers `schedule: cron '17 6 * * 1,4'` and `workflow_dispatch`; one job on `ubuntu-latest` with one step:

```bash
curl --fail --silent --show-error --max-time 30 --output /dev/null \
  -H "apikey: $SB_KEY" -H "Authorization: Bearer $SB_KEY" \
  "$SB_URL/rest/v1/settings?select=id&limit=1"
```

  `SB_URL` and `SB_KEY` are set in the workflow's `env` block with the same public values as `index.html:146-147`. Add a comment that the key is the publishable one already shipped in the page.
- [ ] **Step 2:** Run the same `curl` locally. Expected: exit code 0.
- [ ] **Step 3:** Commit: `ci: twice-weekly Supabase keep-alive`

The workflow only starts running once the branch is on `main`. After that, start it once by hand from the GitHub Actions page to confirm a green run.

### Task 4: Pure logic with tests

**Files:**
- Create: `js/logic.js`, `tests/logic.test.js`

**Interfaces:**
- Produces:
  - `calcWinner(m) -> teamId | null` (as `index.html:123`)
  - `calcStandings(state, seasonId) -> Row[]`, `state = {players, events, teams, matches, settings}`, `Row = {player, pts, w, l, mp, sd, gd, pct, rank}` (as `index.html:241-263`, with `S` and `displaySeason()` replaced by the parameters)
  - `shuf(arr, rnd = Math.random) -> arr copy`
  - `drawTeams(players, prevByeId, rnd = Math.random) -> {pairs: {p1, p2}[], bye: player | null}` (the logic duplicated at `index.html:270-275` and `:492-493`; fewer than 2 players returns `{pairs: [], bye: null}`)
  - `roundRobin(ids) -> [id, id][]` in the order of the loop at `index.html:296`
  - `teamName(p1, p2) -> string` (first names joined with `' / '`, as `index.html:279`)

- [ ] **Step 1:** Write `tests/logic.test.js`. Fixture: players `P1..P4` (ids `'1'..'4'`, active), season `s1`, event `e1` in `s1`, teams `t1` = (1,2) and `t2` = (3,4), settings `{ptsWin:3, ptsLoss:0}`, one completed match `m1` with sets 6:4, 6:3 and `winnerTeamId: 't1'`. Tests:
  - `calcWinner`: 6:4 4:6 10:8 gives `team1Id`; 6:4 alone gives `team1Id`; 0:0 gives `null`; 6:4 4:6 gives `null`.
  - `calcStandings` on the fixture: ids 1 and 2 have `{pts:3, w:1, l:0, mp:1, sd:2, gd:5, pct:100}` and ranks 1 and 2; ids 3 and 4 have `{pts:0, w:0, l:1, sd:-2, gd:-5, pct:0}`.
  - `ptsLoss: 1` gives the losers `pts: 1`.
  - A completed match in an event of another season changes nothing.
  - A match with status `scheduled` changes nothing.
  - Characterisation, named `'no-winner match counts as a loss for all four (current behaviour, changes in phase 2)'`: `m1` as 0:0 with `winnerTeamId: null` gives all four `l: 1`.
  - Review Focus 1: team `t2` references player id `'99'` that is not in `players`: no throw, no row for `'99'`, rows for the others remain.
  - `drawTeams` with 4 players: 2 pairs, `bye === null`, each player exactly once.
  - `drawTeams` with 3 players: 1 pair and a bye.
  - Review Focus 2: `drawTeams` with 5 players and `prevByeId: '5'`, 200 runs: `bye.id` is never `'5'`.
  - Review Focus 2: `drawTeams` with 1 player and with 0 players: `{pairs: [], bye: null}`.
  - `roundRobin(['a','b','c'])` deep-equals `[['a','b'],['a','c'],['b','c']]`; `roundRobin(['a'])` is `[]`.
  - `teamName({name:'Anna Muster'}, {name:'Ben'})` is `'Anna / Ben'`.
- [ ] **Step 2:** Run `npm test`. Expected: FAIL, module not found.
- [ ] **Step 3:** Implement `js/logic.js` by moving the cited code and replacing globals with parameters. No `document`, `window`, `localStorage` or `S` in this file.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: pure logic module with tests`

### Task 5: Split the app into modules

**Files:**
- Create: all `js/*.js` and `js/views/*.js` from the File Structure table except `logic.js`; `tests/helpers/fake-dom.js`, `tests/smoke.test.js`
- Modify: `index.html` (script block `:101-1105` and nav buttons `:78-94`), then copy to `PadelChamp.html`

**Interfaces:**
- Consumes: everything from Task 4.
- Produces:
  - `store.js`: `S`, `IS_ADMIN`, `IS_PLAYER` (exported `let`, assigned only inside `initAuth`), `urlKey`, `initAuth()`, `loadRemote()` (the body of the boot block `index.html:1092-1102`), `mut(fn)`, `onChange(fn)`, `notify()`, `uid`, the getters of `index.html:229-238` under their current names, and `standings()` which returns `calcStandings(S, displaySeason().id)`.
  - `main.js`: `render()`, `setTab(t)`, `ready` (a promise that resolves after the first render).

**How to move the code:** cut line ranges out of `index.html` into the new files unchanged, then add `import`/`export` lines. Do not retype or reformat function bodies. The only permitted edits inside moved code are:

1. Every call `render()` outside `main.js` becomes `notify()`. `main.js` calls `onChange(render)` once.
2. Every call `calcStandings()` in views and actions becomes `standings()`.
3. `genTeams` (`:268-282`) and the "Zufällig" button of the team builder (`:491-497`) call `drawTeams`; team names use `teamName`; `genMatches` iterates `roundRobin(et.map(t => t.id))`.
4. `_urlKey` is read from `location.search` (not `window.location`) and exported as `urlKey`.
5. The five nav buttons lose their `onclick="setTab(n)"` attribute; `main.js` adds a click listener per `.navbtn` that calls `setTab(Number(btn.dataset.tab))`.
6. `index.html` ends with `<script type="module" src="js/main.js"></script>`, preceded by this classic script (Review Focus 5):

```html
<script>
if(location.protocol==='file:'){document.getElementById('screen').textContent='Diese App muss über ihre Web-Adresse geöffnet werden, nicht als Datei.';}
</script>
```

- [ ] **Step 1:** Write `tests/helpers/fake-dom.js`:

```js
// A stand-in for the browser: every property read and every call returns
// another stand-in, so view code runs without a real DOM.
const make = () => {
  const target = function () {};
  const p = new Proxy(target, {
    get(t, k) {
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (!(k in t)) t[k] = make();
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
    apply() { return make(); },
  });
  return p;
};

export function installFakeDom({ search = '', stored = null } = {}) {
  const mem = new Map(stored ? [['padelchamp_v1', JSON.stringify(stored)]] : []);
  globalThis.document = make();
  globalThis.window = globalThis;
  globalThis.location = { search, protocol: 'https:' };
  globalThis.localStorage = {
    getItem: k => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => void mem.set(k, String(v)),
    removeItem: k => void mem.delete(k),
  };
  globalThis.fetch = async () => { throw new Error('offline in tests'); };
  globalThis.alert = () => {};
  globalThis.confirm = () => true;
}
```

- [ ] **Step 2:** Write `tests/smoke.test.js`. It calls `installFakeDom({stored})` with a made-up payload (5 players `P1..P5`, one season, one event with status `active`, two teams, one completed match), then `await import('../js/main.js')` and `await ready`. Tests:
  - Review Focus 4: `S.players.length === 5` and `S.events[0].status === 'active'`.
  - For each tab 0 to 4: `setTab(t)` does not throw.
  - With `S.selEv` set to the event id and `S.tab = 2`: `render()` does not throw.
  - `standings()` returns 5 rows.
  - Without a key, `mut(() => { S.players.push({}) })` leaves `S.players.length` at 5 (read-only guard intact).
  - Review Focus 5: `index.html` contains the string `location.protocol==='file:'` and no `onclick="setTab`.
- [ ] **Step 3:** Run `npm test`. Expected: smoke tests FAIL (no `js/main.js`).
- [ ] **Step 4:** Move the code as described and edit `index.html`.
- [ ] **Step 5:** Run `for f in js/*.js js/views/*.js; do node --check "$f" || exit 1; done`. Expected: no output.
- [ ] **Step 6:** Run `grep -n "render()" js/views/*.js js/actions.js js/store.js js/theme.js`. Expected: no matches. Run `grep -rn "calcStandings()" js/`. Expected: no matches.
- [ ] **Step 7:** `cp index.html PadelChamp.html`, then `npm test`. Expected: all tests pass.
- [ ] **Step 8:** Commit: `refactor: split app into browser modules, no behaviour change`

### Task 6: Hand over for a browser check

The smoke test proves the modules load and the screens render; it cannot prove the modals behave. Mulder checks those in a browser before anything goes to `main`.

- [ ] **Step 1:** Report to Mulder: branch name, test count, the command to serve locally (`python3 -m http.server 8000` in the repo folder), and this checklist: open with the player key; all five tabs; open an event; score modal opens and saves; team builder opens, "Zufällig" works; KI modal opens; theme switch; CSV export.
  The local page talks to the **live** database. Anything saved with a key during the check is real: use a throwaway event and delete it afterwards.
- [ ] **Step 2:** Wait for Mulder's word before any push or merge.
