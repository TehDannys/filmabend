#!/usr/bin/env node
// Standardisierte Prüf-Pipeline für das öffentliche GitHub-Repo "Filmabend":
// 1) JS/MJS Syntax-Prüfung
// 2) Unit-, Daten- & Server-Tests (inkl. lokaler Poster-Prüfung)
// 3) Privacy- & Public-Repo-Check (keine Klarnamen, Home-Pfade, Tokens, IPs, OS-Dateien)
// 4) Optional (--check-links): YouTube oEmbed Check aller Trailer-URLs

import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CHECK_LINKS = process.argv.includes("--check-links");

const FORBIDDEN_FILENAMES = new Set([".DS_Store", ".env", ".privacy-blocklist", "movies.json.tmp"]);
const TEXT_EXTENSIONS = new Set([".html", ".css", ".js", ".mjs", ".json", ".md", ".webmanifest", ".svg", ".txt", ".yml", ".yaml"]);

async function walkFiles(dir, relBase = "") {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const rel = relBase ? `${relBase}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(full, rel)));
    } else {
      files.push({ rel, full, name: entry.name });
    }
  }
  return files;
}

async function getGitTrackedAndUntracked() {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: ROOT });
    return stdout
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return null;
  }
}

async function loadPrivacyBlocklist() {
  const blocklistPath = path.join(ROOT, ".privacy-blocklist");
  const blocked = [];
  const allowed = [];
  try {
    const raw = await fs.readFile(blocklistPath, "utf8");
    for (const rawLine of raw.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.toLowerCase().startsWith("!allow:")) {
        const term = line.slice("!allow:".length).trim().toLowerCase();
        if (term) allowed.push(term);
      } else {
        blocked.push(line.toLowerCase());
      }
    }
  } catch {
    // Keine lokale Sperrliste vorhanden (z. B. in CI) -> Standard-Regeln laufen trotzdem
  }
  return { blocked, allowed };
}

async function checkSyntax(files) {
  const jsFiles = files.filter((f) => f.rel.endsWith(".js") || f.rel.endsWith(".mjs")).map((f) => f.full);
  for (const file of jsFiles) {
    await execFileAsync(process.execPath, ["--check", file], { cwd: ROOT });
  }
  return jsFiles.length;
}

async function checkTests() {
  const { stdout } = await execFileAsync(process.execPath, ["--test", path.join(ROOT, "tests", "store.test.mjs")], { cwd: ROOT });
  return stdout;
}

async function checkPrivacy() {
  const issues = [];
  const trackedOrNew = await getGitTrackedAndUntracked();
  const relList = trackedOrNew ?? (await walkFiles(ROOT)).map((f) => f.rel);
  const { blocked, allowed } = await loadPrivacyBlocklist();

  const patterns = [
    { name: "Absoluter Home-Pfad", regex: /(?:\/Users\/[A-Za-z0-9._-]+|\/home\/[A-Za-z0-9._-]+|C:\\Users\\[A-Za-z0-9._-]+)/g },
    { name: "Möglicher API-Key / Token", regex: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AIza[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9]{20,})\b/g },
    { name: "Private E-Mail-Adresse", regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
    { name: "Konkrete lokale IP-Adresse", regex: /\b(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g }
  ];

  for (const rel of relList) {
    const full = path.join(ROOT, rel);
    try {
      await fs.access(full);
    } catch {
      // Datei wurde im Arbeitsbaum gelöscht (z. B. beim Aufräumen alter .DS_Store)
      continue;
    }

    const base = path.basename(rel);
    if (FORBIDDEN_FILENAMES.has(base) || base.endsWith(".tmp")) {
      issues.push(`${rel}: Verbotene/temporäre Datei darf nicht ins öffentliche Repo.`);
      continue;
    }

    const ext = path.extname(rel).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext)) continue;

    // scripts/verify.mjs enthält selbst die Prüf-Regeln – nur auf Blocklist prüfen, nicht auf Regex-Literale
    const isVerifierSelf = rel === "scripts/verify.mjs";

    let content;
    try {
      content = await fs.readFile(full, "utf8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    lines.forEach((line, idx) => {
      const lineNo = idx + 1;
      if (!isVerifierSelf) {
        for (const p of patterns) {
          p.regex.lastIndex = 0;
          const matches = line.match(p.regex);
          if (matches) {
            issues.push(`${rel}:${lineNo} – ${p.name}: ${matches.join(", ")}`);
          }
        }
      }

      if (blocked.length > 0) {
        let scrubbed = line.toLowerCase();
        for (const okTerm of allowed) {
          scrubbed = scrubbed.split(okTerm).join("");
        }
        for (const term of blocked) {
          if (scrubbed.includes(term)) {
            issues.push(`${rel}:${lineNo} – Persönlicher Sperrbegriff aus .privacy-blocklist gefunden („${term}“).`);
          }
        }
      }
    });
  }

  return { scanned: relList.length, issues, blocklistActive: blocked.length > 0 };
}

async function checkYoutubeLinks() {
  const data = JSON.parse(await fs.readFile(path.join(ROOT, "data", "movies.json"), "utf8"));
  const broken = [];
  await Promise.all(
    data.items.map(async (item) => {
      if (!item.trailerUrl || !item.trailerUrl.includes("youtube.com/watch")) return;
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(item.trailerUrl)}&format=json`);
        if (!res.ok) broken.push(`${item.id}: HTTP ${res.status} (${item.trailerUrl})`);
      } catch (e) {
        broken.push(`${item.id}: Netzwerkfehler (${e.message})`);
      }
    })
  );
  return { total: data.items.length, broken };
}

async function main() {
  console.log("🔍 Starte Filmabend-Verifikation...\n");
  const files = await walkFiles(ROOT);

  const jsCount = await checkSyntax(files);
  console.log(`✅ 1/3 Syntax-Check bestanden (${jsCount} JS/MJS-Dateien)`);

  await checkTests();
  console.log("✅ 2/3 Unit-, Daten-, Poster- & Server-Tests bestanden");

  const privacy = await checkPrivacy();
  if (privacy.issues.length > 0) {
    console.error("\n❌ 3/3 Privacy- & Public-Repo-Prüfung FEHLGESCHLAGEN:");
    for (const issue of privacy.issues) {
      console.error(`   - ${issue}`);
    }
    process.exit(1);
  }
  console.log(
    `✅ 3/3 Privacy-Prüfung bestanden (${privacy.scanned} Dateien geprüft${privacy.blocklistActive ? ", inkl. lokaler .privacy-blocklist" : ""})`
  );

  if (CHECK_LINKS) {
    const links = await checkYoutubeLinks();
    if (links.broken.length > 0) {
      console.error("\n❌ 4/4 YouTube-Trailer-Prüfung FEHLGESCHLAGEN:");
      for (const b of links.broken) console.error(`   - ${b}`);
      process.exit(1);
    }
    console.log(`✅ 4/4 Alle ${links.total} YouTube-Trailer-Links erreichbar`);
  }

  console.log("\n🎉 Alle Prüfungen erfolgreich – bereit für GitHub Pages!");
}

main().catch((err) => {
  console.error("\n❌ Verifikation abgebrochen:", err.message || err);
  process.exit(1);
});
