# Rollout Phase 1: Supabase absichern

Reihenfolge einhalten. Bis einschliesslich Schritt 5 läuft die alte Live-App
unverändert weiter; nichts davon sperrt oder ändert bestehende Daten.

## 1. Datenbank-Funktionen anlegen

Supabase-Dashboard → **SQL Editor** → neuer Query. Den ganzen Inhalt von
`supabase/sql/01_functions.sql` einfügen und **Run**.

Erwartet: „Success. No rows returned". Kann gefahrlos mehrfach laufen.

## 2. Drei neue Keys erzeugen

Im **eigenen Terminal** (nicht in der Claude-Session, sonst landen die Keys im Chat):

```
cd ~/Developer/padelchamp-web
node scripts/make-keys.mjs https://eddie-bauer.github.io/padel-champ/
```

Ausgabe: drei Links (Zuschauer, Spieler, Admin) und drei Zeilen `PC_..._HASH = ...`.
Die Links sicher aufbewahren. Die alten Keys sind öffentlich und gelten danach nicht mehr.

## 3. Secrets setzen

Dashboard → **Edge Functions → Secrets**. Drei Secrets anlegen, Name und Wert
genau wie in der Ausgabe von Schritt 2:

- `PC_VIEWER_HASH`
- `PC_PLAYER_HASH`
- `PC_ADMIN_HASH`

`GOOGLE_AI_KEY` ist schon vorhanden und bleibt.

## 4. Funktion `api` anlegen

Dashboard → **Edge Functions → Deploy a new function → Via Editor**.

- Name: **`api`** (genau so; die App ruft `/functions/v1/api` auf).
- Den ganzen Inhalt von `supabase/functions/api/index.ts` einfügen.
- **„Verify JWT" ausschalten** (in den Einstellungen der Funktion). Die Funktion prüft stattdessen den Key selbst.
- Deploy.

Falls das Dashboard einen anderen Namen vergibt (wie damals `dynamic-endpoint`): Namen notieren und Bescheid geben, dann wird die Adresse in der App angepasst.

## 5. Lokal testen, bevor es live geht

```
cd ~/Developer/padelchamp-web
python3 -m http.server 8000
```

Im Browser `http://localhost:8000/?key=<neuer Key>` öffnen (den Key-Teil aus den Links von Schritt 2).

| Link | Erwartet |
|---|---|
| ohne `?key=` | Bildschirm „Zugangs-Key nötig" |
| mit einem erfundenen Key | „Key ungültig" |
| Zuschauer-Key | Daten sichtbar, gelber Balken „Zuschauer-Modus", nichts änderbar |
| Spieler-Key | Event anlegen, Teams ziehen, Ergebnis eintragen; nach Neuladen noch da |
| Admin-Key | zusätzlich: Spieler deaktivieren/reaktivieren, Test-Event löschen; nach Neuladen weg |

Zusätzlich:

- **Zwei Fenster** mit Spieler-Key: Ergebnis in Fenster A eintragen. Fenster B zeigt es nach spätestens 15 Sekunden von selbst.
- Ergebnis 0:0 speichern: Karte zeigt „Nicht gespielt", Rangliste unverändert.
- Ergebnis 6:4, 4:6 ohne dritten Satz: wird mit Hinweis abgelehnt.
- KI-Analyse öffnen (Spieler oder Admin).

Achtung: auch der lokale Test schreibt in die echte Datenbank.

## 6. Live schalten

Bescheid geben („merge"). Der Branch `phase-1-2-hardening` geht nach `main`,
GitHub Pages liefert die neue Version nach ein paar Minuten aus. Danach die
neuen Links verteilen; die alten Links zeigen „Key ungültig".

## 7. Datenbank schliessen

Erst wenn die Live-App mit den neuen Links funktioniert:

SQL Editor → Inhalt von `supabase/sql/02_lockdown.sql` einfügen → **Run**.

Ab jetzt kann niemand mehr ohne Key lesen oder schreiben, auch nicht mit dem
öffentlichen Schlüssel aus dem alten Seitenquelltext. Die App danach einmal
neu laden und prüfen, dass alles wie in Schritt 5 funktioniert.

## 8. Aufräumen

- Dashboard → Edge Functions → **`dynamic-endpoint` löschen** (alte KI-Funktion mit den alten Keys).
- Backup geht ab jetzt nur noch mit Key:
  `PC_KEY=<Admin-Key> node scripts/backup.mjs` (im eigenen Terminal).
- Der Keep-alive-Workflow läuft unverändert weiter.

## Wenn etwas schiefgeht

- **Vor Schritt 6** ist nichts live geändert: einfach melden.
- **Nach Schritt 6, vor Schritt 7:** `main` kann auf den vorherigen Stand zurückgesetzt werden; die alte App läuft dann wieder (mit den alten Schwächen).
- **Nach Schritt 7:** Der Notfall-Rückweg steht am Ende von `02_lockdown.sql`. Er öffnet die Datenbank wieder für alle und ist nur als kurzfristige Notlösung gedacht.
