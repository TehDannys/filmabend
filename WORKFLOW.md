# Standard-Workflow für Änderungen & Updates (GitHub Pages)

Da das Repository öffentlich auf GitHub liegt und direkt über **GitHub Pages** ausgeliefert wird, läuft jede Änderung nach demselben 4-Schritte-Standard ab:

## 1. Änderungen einpflegen
- **Neue Filme / Bewertungen:** In `data/movies.json` eintragen (und bei Änderungen an bestehenden Einträgen ggf. `"version"` um 1 erhöhen, damit Browser-Caches im statischen Modus das Update sauber übernehmen).
- **Poster-Regel:** Jedes neue Cover lokal unter `posters/<id>.jpg` speichern (max. 640px, JPEG) und **einmal visuell prüfen**, damit Motiv und Titel garantiert stimmen.
- **Trailer-Regel:** Echten deutschen YouTube-Trailer-Link (`https://www.youtube.com/watch?v=...`) eintragen.

## 2. Automatische Prüfung (inkl. Datenschutz-Check)
```bash
npm run verify
# oder zusätzlich mit Live-Prüfung aller YouTube-Trailer-Links:
npm run verify:links
```
Dabei wird automatisch geprüft:
1. **JS-Syntax** aller Skripte (`node --check`).
2. **Unit-, Daten-, Poster- & Server-Tests** (`node --test tests/store.test.mjs`) – stellt sicher, dass `movies.json` valide ist, jede ID eindeutig ist und alle lokalen Poster-Dateien vorhanden sind.
3. **Privacy- & Public-Repo-Schutz:** Blockiert den Publish-Vorgang sofort, falls irgendwo Klarnamen aus der lokalen `.privacy-blocklist`, absolute Home-Pfade, E-Mail-Adressen, Tokens/API-Keys, konkrete lokale IPs oder OS-Dateien (`.DS_Store`, `.env`) auftauchen.
   - *Hinweis:* `.privacy-blocklist` liegt in `.gitignore` und wird selbst **niemals** auf GitHub hochgeladen. Dort kannst du jederzeit weitere Begriffe ergänzen (und mit `!allow:...` Ausnahmen wie Schauspielernamen definieren).

## 3. Veröffentlichen (Commit & Push)
```bash
npm run publish -- "Kurze Beschreibung der Änderung"
```
Das Skript führt zuerst automatisch `npm run verify` aus, stagt die Änderungen, prüft das Staging nochmals gegen verbotene Dateien, committet und pusht auf `origin/main`.

## 4. Live-Aktualisierung
Nach dem Push baut **GitHub Pages** die Seite automatisch neu (meist in 30–60 Sekunden). Einmal im Browser / auf dem Handy neu laden – fertig!
