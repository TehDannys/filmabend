# Filmabend – Schnelle, stressfreie Filmauswahl

Eine schlanke, mobile-first Web-App (PWA) für entspannte Film- und Serienabende zu zweit – ohne langes Suchen oder Überforderung.

## Features
- **In 30 Sekunden entscheiden:** 1-Tap-Stimmungsfilter (*Witzig & clever*, *Warmherzig*, *Packend & ernst*, *Kurzweilig*, *Frei / Mediathek*), **⚡ Schnell-Entscheid** (2 Fragen → Top 3) sowie **🎲 Zufallsvorschlag**.
- **Merken für heute:** Beim Stöbern 2–3 Favoriten anpinnen (`📌 Merken`), direkt vergleichen oder zwischen ihnen auswürfeln.
- **Auf euren Geschmack zugeschnitten:** Passungs-Einordnung (*★ Passt super*, *◐ Je nach Stimmung*, *⚠ Passt eher nicht*), Laufzeit auf einen Blick, eigene Kurzbeschreibungen, Empfehlungsgeber & deutsche YouTube-Trailer.
- **Persönliche Liste vs. Externe Ideen:** Empfehlungen von euch, Freunden und Familie bleiben sauber getrennt im Tab **`Offen`** – externe & KI-Tipps landen separat im Tab **`Ideen`** (mit 1-Klick **`+ Übernehmen`**).
- **Gemeinsam bewerten & Geschmacksprofil kopieren:** Filme/Serien hinzufügen, bearbeiten, entfernen, mit **„Unser gemeinsames Urteil“** abhaken und das Geschmacksprofil im Tab *Gesehen* (oder unter *⚙️*) für künftige Empfehlungen in die Zwischenablage kopieren.

---

## Start auf Mac & iPhone / iPad (im Heim-WLAN)

1. Im Terminal starten:
   ```bash
   cd ~/Documents/filmabend
   node server.mjs
   ```
2. Im Terminal erscheinen zwei Adressen – z. B.:
   - Mac: `http://localhost:3000`
   - iPhone / iPad (im selben WLAN): `http://192.168.x.x:3000`
3. Auf dem iPhone in Safari über **Teilen → „Zum Home-Bildschirm“** speichern. Alle Änderungen werden direkt in `data/movies.json` auf dem Mac gesichert.

---

## Optional: Dauerhaft von überall nutzen (GitHub Pages in 2 Minuten)

1. Neues Repository auf GitHub anlegen (z. B. `filmabend`) und den Inhalt dieses Ordners hochladen (`git init && git add . && git commit -m "Initial" && git push`).
2. In den Repository-Einstellungen unter **Pages → Source: Deploy from a branch (`main` / `/ (root)`)** aktivieren.
3. Die fertige URL am Handy öffnen und auf den Home-Bildschirm legen. Über das Zahnrad (**⚙️ Backup & Sync**) könnt ihr bei Bedarf einen GitHub-Sync zwischen Mac und Handy aktivieren oder per JSON sichern.

## Standard-Workflow für Änderungen & Updates
Alle Änderungen (neue Filme, Bewertungen, UI-Updates) laufen über den eingebauten Prüf- und Publish-Workflow (siehe [WORKFLOW.md](./WORKFLOW.md)):
```bash
npm run verify              # Syntax, Unit-Tests, Poster-Check & Privacy-Prüfung
npm run verify:links        # zusätzlich alle YouTube-Trailer-Links prüfen
npm run publish -- "Update" # prüft alles, committet und pusht zu GitHub Pages
```

## Antigravity-Workspace
Um künftig direkt in diesem Projektordner weiterzuarbeiten, öffne einfach `~/Documents/filmabend` als Workspace.
