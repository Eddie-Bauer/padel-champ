# Phase 4a: Design System — what was built and decided

**Goal:** The existing app looks and behaves as the design system "PadelChamp" describes. No new features, no backend change.

**Source:** https://claude.ai/artifact/Dzvv8vbPLp7WhiBHWicNEG, version 1794861925-b498, read on 2026-11-16.

## How it is wired

- `ds/` holds the design system's `tokens.css`, `bundle.css`, fonts and licences, copied unchanged. Updating the look later means copying these files again.
- `css/app.css` holds only the app shell and layout helpers. It uses tokens only and never redefines a `pc-*` class.
- Views build the design system's markup through one helper (`h` in `js/dom.js`). Text always goes in as text, never as HTML.
- Tests enforce the rules a machine can check: no emoji, no colour values outside the tokens, every `pc-*` class and icon exists, fonts are local.

## Taken from the design system as written

- Navigation: floating tab bar Start · Events · + · Rangliste · Spieler; settings behind an icon on Start.
- The + creates a Padel Day; inside a running Padel Day it opens the next open result.
- Viewers (read-only key): banner "Nur lesen", tab bar with Start and Rangliste only, nothing that edits.
- Score entry, team builder, KI-Analyse, new Padel Day, new player, new season: bottom sheets.
- Every destructive action is confirmed in a sheet whose title is a question.
- Win shown by the ball-yellow score cell, never by green and red.
- Team names with "&", real minus sign for negative differences, no emoji.
- Where README and tokens disagree on a size (score-lg, score-md), the tokens win.

## Decisions the design system left open (mine)

| Topic | Decision |
|---|---|
| Sets in a MatchCard | The card has one number per team. One set: the games. Several sets: the sets won, with the single sets in the top line. |
| Hero card on Start | No "you" in this app (access is by shared key), so the hero shows the season leader: points, lead over second place, matches, wins, win rate. |
| Per-player avatar colours | Dropped. The design system has one accent; avatars show initials on a neutral fill. |
| Season switch on Rangliste | Chips, because there can be more than four seasons (Segmented allows two to four). |
| Player-mode banner | Dropped. Banners are for warnings; being a player is the normal case. |
| Theme switch | For everyone (it was admin-only). |
| Adding players | Admin only, in line with what the server allows. |
| Third set | Counts up to 99 (it stopped at 7, too low for a super tie-break). |
| Editing results | Any round of a Padel Day that is not completed (it was the current round only). Needed because deleting a match moved into the score sheet. |
| Zoom | Pinch zoom is allowed again; inputs are 16px so iOS does not zoom by itself. |

## Not checked

The screens were never opened in a real browser during the build. Tests run the code against a stand-in DOM, which proves that every screen and sheet builds without an error, not how it looks.
