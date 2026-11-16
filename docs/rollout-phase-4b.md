# Rollout Phase 4b: Turniere

Reihenfolge einhalten. Bis einschliesslich Schritt 3 läuft die Live-App
unverändert weiter; bestehende Daten werden nicht verändert.

## 1. Neue Spalten und Schreibfunktion

Supabase-Dashboard → **SQL Editor** → neuer Query. Den ganzen Inhalt von
`supabase/sql/03_tournaments.sql` einfügen und **Run**.

Erwartet: „Success. No rows returned". Kann gefahrlos mehrfach laufen.

Was es tut: Events bekommen ein Format und ein Setup, Teams eine Gruppe,
Matches eine Runde (Gruppe, Halbfinal …) und einen Platz. Alle bestehenden
Events werden zu „Padel Day".

## 2. Funktion `api` aktualisieren

Dashboard → **Edge Functions → `api`** → Code bearbeiten. Den gesamten Inhalt
durch den aktuellen Stand von `supabase/functions/api/index.ts` ersetzen und
deployen.

Danach prüfen: **„Verify JWT" ist weiterhin aus.** Sonst zeigt die App mit
gültigem Link „Key ungültig".

Die Secrets (die drei Hash-Werte, der Google-Key) bleiben, wie sie sind.

## 3. Lokal testen

```
cd ~/Developer/padelchamp-web
python3 -m http.server 8000
```

`http://localhost:8000/?key=<Admin-Key>` öffnen. Der Test arbeitet auf der
echten Datenbank; Test-Events am Ende mit „Event löschen" entfernen.

**Bestehendes**
- Ein vorhandener Padel Day öffnet sich und lässt sich bearbeiten wie bisher.

**Americano** (Plus-Knopf → Format „Americano")
- Mindestens 4 Spieler wählen; Plätze, Punkte pro Match und Runden einstellen.
- „Spielplan erstellen": alle Runden erscheinen, mit „Pause: …", wenn die Spielerzahl nicht aufgeht.
- Ergebnis eintragen: eine Zahl tippen, die andere füllt sich von selbst.
- Reiter „Rangliste": Punkte addieren sich.
- Saison-Rangliste (Tab Rangliste): bleibt unverändert.

**Turnier** (Plus-Knopf → Format „Turnier")
- Gerade Zahl Spieler wählen → „Teams auslosen".
- Modus wählen (zum Beispiel 2 Gruppen, 2 weiter) → „Gruppen auslosen und starten".
- Alle Gruppenspiele eintragen: Das Halbfinal erscheint von selbst im Reiter „Playoff".
- Ein Gruppenergebnis lässt sich danach nicht mehr ändern.
- Halbfinals eintragen: Final (und Spiel um Platz 3) erscheinen.
- Final eintragen: oben steht der Turniersieger mit den Plätzen.

**Zweites Fenster** mit Spieler-Key: Ergebnisse aus dem einen Fenster
erscheinen im anderen nach spätestens 15 Sekunden.

## 3b. Nachtrag: einstellbare Mindestspiele und Platzierungsspiele

Nötig, auch wenn die Schritte 1 bis 3 schon gemacht sind.

1. SQL Editor → Inhalt von `supabase/sql/04_min_matches.sql` einfügen → **Run**.
   Erwartet: „Success. No rows returned".
2. Funktion `api` noch einmal mit dem aktuellen Stand von
   `supabase/functions/api/index.ts` ersetzen und deployen. „Verify JWT" bleibt aus.
3. Lokal testen:
   - **Einstellungen → Wertung:** „Mindestspiele pro Saison" ändern, Seite neu laden: Der Wert ist noch da, und die Rangliste trennt entsprechend.
   - **Turnier → Modus „2 Gruppen · Platzierungsspiele":** Nach dem letzten Gruppenspiel erscheinen im Reiter „Platzierung" das Final (Erster gegen Erster) und die Spiele um Platz 3, 5 und so weiter. Nach dem Final steht oben der Sieger.

## 4. Live schalten

Bescheid geben („merge"). Der Branch `phase-4b-tournaments` geht nach `main`.

## Wenn etwas schiefgeht

- Nach Schritt 1 oder 2 ist an der Live-App nichts anders. Die alte App-Version arbeitet mit den neuen Spalten und der neuen Funktion weiter.
- Schritt 2 lässt sich zurücknehmen, indem der vorherige Code der Funktion wieder eingefügt wird (er steht in der Git-Historie).
- Die neuen Spalten können bleiben, auch wenn die Turniere nie live gehen.
