#!/usr/bin/env node
// Standardisierter Publish-Workflow:
// 1) Führt scripts/verify.mjs aus (Syntax, Tests, Poster, Privacy-Check)
// 2) Prüft Git-Status & verbotene Dateien
// 3) Führt git add -A, git commit und git push aus -> GitHub Pages aktualisiert automatisch

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const checkLinks = args.includes("--check-links");
const dryRun = args.includes("--dry-run");
const msgArgs = args.filter((a) => !a.startsWith("--"));
const commitMessage = msgArgs.join(" ").trim();

if (!commitMessage && !dryRun) {
  console.error("Verwendung: npm run publish -- \"Kurze Beschreibung der Änderung\" [--check-links] [--dry-run]");
  process.exit(1);
}

async function run(cmd, cmdArgs, label) {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, { cwd: ROOT });
    if (stdout && stdout.trim()) console.log(stdout.trim());
    if (stderr && stderr.trim() && !stderr.includes("To https://")) console.error(stderr.trim());
    return stdout;
  } catch (err) {
    console.error(`\n❌ Fehler bei "${label}":`);
    if (err.stdout) console.error(err.stdout.trim());
    if (err.stderr) console.error(err.stderr.trim());
    process.exit(1);
  }
}

async function main() {
  const verifyArgs = [path.join(ROOT, "scripts", "verify.mjs")];
  if (checkLinks) verifyArgs.push("--check-links");
  await run(process.execPath, verifyArgs, "verify");

  const status = (await run("git", ["status", "--porcelain"], "git status")).trim();
  if (!status) {
    console.log("ℹ️ Keine offenen Änderungen zum Committen vorhanden.");
    return;
  }

  console.log("\n📦 Geänderte Dateien:\n" + status);
  if (dryRun) {
    console.log("\n✅ Dry-Run abgeschlossen (kein Commit/Push durchgeführt).");
    return;
  }

  await run("git", ["add", "-A"], "git add");

  const staged = (await run("git", ["diff", "--cached", "--name-only", "--diff-filter=ACMRT"], "git diff --cached"))
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const forbidden = staged.filter((f) =>
    [".DS_Store", ".env", ".privacy-blocklist"].includes(path.basename(f)) || f.endsWith(".tmp")
  );
  if (forbidden.length > 0) {
    await run("git", ["reset"], "git reset");
    console.error(`\n❌ Abgebrochen: Verbotene Datei im Staging entdeckt: ${forbidden.join(", ")}`);
    process.exit(1);
  }

  await run("git", ["commit", "-m", commitMessage], "git commit");
  await run("git", ["push"], "git push");

  console.log("\n🚀 Erfolgreich gepusht! GitHub Pages aktualisiert die Live-Seite in ca. 30–60 Sekunden.");
}

main();
