# Projektregeln: Filmabend (Öffentliches GitHub-Pages-Repo)

Dieses Repository ist **öffentlich** auf GitHub gehostet und wird direkt über **GitHub Pages** ausgeliefert. Alle zukünftigen Änderungen und Erweiterungen müssen diesen verbindlichen Regeln folgen:

1. **Privacy First (Öffentliches Repo):**
   - Niemals echte Klarnamen, private Adressen, E-Mail-Adressen, Telefonnummern, API-Tokens, konkrete lokale IP-Adressen oder absolute Home-Verzeichnispfade in getrackte Dateien schreiben.
   - Persönliche Notizen zu Filmen neutral und ohne identifizierende Details formulieren.
   - `.privacy-blocklist`, `.env` und `.DS_Store` dürfen niemals committet werden.
2. **Poster & Trailer:**
   - Neue Film-/Serienposter immer lokal optimiert (JPEG, max. 640px) unter `posters/<id>.jpg` ablegen und **visuell kontrollieren**, ob Motiv und (möglichst deutscher) Titel exakt stimmen.
   - Deutsche YouTube-Trailer-Links immer über YouTube oEmbed verifizieren (niemals Video-IDs raten).
3. **Daten-Versionierung:**
   - Nach Änderungen an `data/movies.json` die Versionsnummer (`"version"`) hochzählen, damit bestehende Browser-Caches sauber aktualisiert werden, ohne lokale Nutzerbewertungen zu überschreiben.
4. **Verbindliche Prüf- & Publish-Pipeline:**
   - Vor jedem Commit/Push zwingend `npm run verify` (bzw. `npm run verify:links` bei neuen Trailern) ausführen.
   - Zum Veröffentlichen `npm run publish -- "Kurze Commit-Nachricht"` nutzen, sodass Verifikation, Privacy-Check, Commit und Push atomar durchlaufen und GitHub Pages sofort aktualisiert wird.
5. **Schlanke Architektur beibehalten:**
   - Zero-Dependency Static PWA (relative `./`-Pfade, volle GitHub-Pages-Kompatibilität) und klarer Fokus auf schnelle, stressfreie Filmauswahl am Abend.
