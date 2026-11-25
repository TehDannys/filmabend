import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import {
  buildTasteProfileText,
  computeTabCounts,
  deleteItem,
  filterItems,
  getQuickDecisionMatches,
  markWatched,
  pickRandomItem,
  pruneShortlist,
  sortItems,
  toggleShortlistId,
  unmarkWatched,
  upsertItem,
  validateDataset
} from "../js/logic.js";
import { createAppServer } from "../server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data", "movies.json");

test("data/movies.json ist vollständig, valide und enthält alle 33 kuratierten Titel", async () => {
  const raw = await fs.readFile(DATA_PATH, "utf8");
  const data = JSON.parse(raw);

  assert.equal(validateDataset(data), true);
  assert.equal(data.items.length, 33);

  for (const item of data.items) {
    assert.ok(item.title && item.title.trim().length > 0, `Titel fehlt bei ${item.id}`);
    assert.ok(item.runtimeLabel && item.runtimeLabel.trim().length > 0, `Laufzeit fehlt bei ${item.id}`);
    assert.ok(Array.isArray(item.moods) && item.moods.length > 0, `Moods fehlen bei ${item.id}`);
    assert.ok(item.summary && item.summary.trim().length >= 40, `Beschreibung zu kurz bei ${item.id}`);
    assert.ok(item.recommendedBy && item.recommendedBy.trim().length > 0, `Empfehlungsgeber fehlt bei ${item.id}`);
    assert.ok(item.trailerUrl && item.trailerUrl.startsWith("https://"), `Trailer-URL ungültig bei ${item.id}`);
    assert.ok(item.posterUrl && item.posterUrl.startsWith("./posters/"), `Lokale Poster-URL fehlt bei ${item.id}`);
    const posterFile = path.join(__dirname, "..", item.posterUrl.replace(/^\.\//, ""));
    const posterStat = await fs.stat(posterFile);
    assert.ok(posterStat.size > 2000, `Poster-Datei zu klein bei ${item.id}: ${posterStat.size} Bytes`);
  }

  const counts = computeTabCounts(data.items);
  assert.equal(counts.open, 19);
  assert.equal(counts.avoid, 2);
  assert.equal(counts.watched, 12);
});

test("filterItems trennt Tabs, Stimmungen, Kurzweilig, Frei (Mediathek) und Quellen sauber", async () => {
  const data = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
  const items = data.items;

  const openItems = filterItems(items, { tab: "open" });
  assert.equal(openItems.length, 19);
  assert.ok(!openItems.some((i) => i.fit === "low"));

  const avoidItems = filterItems(items, { tab: "avoid" });
  assert.equal(avoidItems.length, 2);
  assert.deepEqual(avoidItems.map((i) => i.id).sort(), ["der-schacht-2019", "pans-labyrinth-2006"]);

  const freeItems = filterItems(items, { tab: "open", mood: "free" });
  assert.equal(freeItems.length, 5);
  assert.ok(freeItems.every((i) => i.freeSource === "ARD Mediathek"));

  const shortItems = filterItems(items, { tab: "open", mood: "kurzweilig" });
  assert.ok(shortItems.some((i) => i.id === "die-discounter-2021"));
  assert.ok(shortItems.some((i) => i.id === "empatia-2017"));
  assert.ok(!shortItems.some((i) => i.id === "die-verurteilten-1994"));

  const seriesOnly = filterItems(items, { tab: "open", type: "series" });
  assert.equal(seriesOnly.length, 2);

  const sortedOpen = sortItems(openItems, "open");
  assert.equal(sortedOpen[0].fit, "high");
  assert.equal(sortedOpen[sortedOpen.length - 1].fit, "medium");
});

test("CRUD, gemeinsame Bewertung und Zufallsvorschlag funktionieren zuverlässig", () => {
  const base = [
    {
      id: "film-a-2020",
      title: "Film A",
      type: "film",
      runtimeMinutes: 90,
      runtimeLabel: "90 Min.",
      moods: ["witzig-clever"],
      moodLabels: ["Witzig & clever"],
      fit: "high",
      summary: "Ein kurzer Testfilm.",
      recommendedBy: "Selbst notiert",
      watched: false
    }
  ];

  // Hinzufügen
  const added = upsertItem(base, {
    title: "Film B",
    year: 2022,
    type: "film",
    runtimeMinutes: 105,
    runtimeLabel: "105 Min.",
    moods: ["warmherzig"],
    moodLabels: ["Warmherzig"],
    fit: "high",
    summary: "Noch ein Testfilm.",
    recommendedBy: "Arbeitskollegen"
  });
  assert.equal(added.length, 2);
  const filmB = added.find((i) => i.title === "Film B");
  assert.ok(filmB);

  // Zufallsvorschlag vermeidet direkte Wiederholung
  const picked = pickRandomItem(added, "film-a-2020", () => 0);
  assert.equal(picked.id, filmB.id);

  // Gemeinsame Bewertung
  const watched = markWatched(added, filmB.id, {
    jointRating: 5,
    jointNote: "Beide sehr gelacht!",
    watchedAt: "2026-11-24T20:00:00.000Z"
  });
  const watchedTab = filterItems(watched, { tab: "watched" });
  assert.equal(watchedTab.length, 1);
  assert.equal(watchedTab[0].jointRating, 5);
  assert.equal(watchedTab[0].jointNote, "Beide sehr gelacht!");

  // Zurücksetzen auf Offen
  const unwatched = unmarkWatched(watched, filmB.id);
  assert.equal(filterItems(unwatched, { tab: "watched" }).length, 0);

  // Entfernen
  const removed = deleteItem(unwatched, filmB.id);
  assert.equal(removed.length, 1);
});

test("server.mjs liefert statische Dateien, Health-Check und speichert /api/movies", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmabend-test-"));
  const tmpDataPath = path.join(tmpDir, "movies.json");
  await fs.copyFile(DATA_PATH, tmpDataPath);

  const server = createAppServer({ dataPath: tmpDataPath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;

  try {
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.equal(health.ok, true);

    const htmlRes = await fetch(`${baseUrl}/`);
    assert.equal(htmlRes.status, 200);
    const html = await htmlRes.text();
    assert.ok(html.includes("Filmabend"));

    const moviesRes = await fetch(`${baseUrl}/api/movies`);
    assert.equal(moviesRes.status, 200);
    const movies = await moviesRes.json();
    assert.equal(movies.items.length, 33);

    const updated = { version: 1, items: movies.items.slice(0, 2) };
    const putRes = await fetch(`${baseUrl}/api/movies`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated)
    });
    assert.equal(putRes.status, 200);

    const afterRes = await fetch(`${baseUrl}/api/movies`);
    const after = await afterRes.json();
    assert.equal(after.items.length, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
});

test("Shortlist, Schnell-Entscheid und Geschmacksprofil-Export arbeiten korrekt", async () => {
  const data = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));

  // Shortlist: hinzufügen, entfernen, und nach Gesehen-Markierung bereinigen
  let list = toggleShortlistId([], "der-vorname-2012");
  list = toggleShortlistId(list, "der-perfekte-chef-2021");
  assert.deepEqual(list, ["der-vorname-2012", "der-perfekte-chef-2021"]);
  list = toggleShortlistId(list, "der-vorname-2012");
  assert.deepEqual(list, ["der-perfekte-chef-2021"]);

  const itemsAfterWatch = markWatched(data.items, "der-perfekte-chef-2021", {
    jointRating: 5,
    jointNote: "Genialer Humor"
  });
  assert.deepEqual(pruneShortlist(["der-perfekte-chef-2021", "unbekannt"], itemsAfterWatch), []);

  // Schnell-Entscheid: max. 3, schließt fit=low und watched aus, Rotation funktioniert
  const quick1 = getQuickDecisionMatches(itemsAfterWatch, {
    time: "short",
    vibe: "witzig-clever",
    freeOnly: false
  });
  assert.ok(quick1.top.length >= 1 && quick1.top.length <= 3);
  assert.ok(quick1.top.every((i) => !i.watched && i.fit !== "low"));

  const quickFree = getQuickDecisionMatches(data.items, {
    time: "any",
    vibe: "any",
    freeOnly: true
  });
  assert.equal(quickFree.total, 5);
  assert.equal(quickFree.top.length, 3);

  const quickNext = getQuickDecisionMatches(data.items, {
    time: "any",
    vibe: "any",
    freeOnly: true,
    excludeIds: quickFree.top.map((i) => i.id)
  });
  assert.equal(quickNext.top.length, 2);
  assert.notDeepEqual(
    quickNext.top.map((i) => i.id),
    quickFree.top.map((i) => i.id)
  );

  // Geschmacksprofil-Export mit echten gesehenen Daten
  const profile = buildTasteProfileText(data.items);
  assert.ok(profile.includes("auf Deutsch"));
  assert.ok(profile.includes("Ungeschminkt"));
  assert.ok(profile.includes("Guter Film!"));
  assert.ok(profile.includes("CODA"));
  assert.ok(profile.includes("USA-klischeehaft"));
  assert.ok(profile.includes("Pans Labyrinth"));
});

