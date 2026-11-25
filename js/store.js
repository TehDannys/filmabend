// Persistenz-Schicht: Server (/api/movies), statische JSON-Basis, localStorage und optionaler GitHub-Sync.

import { validateDataset } from "./logic.js";

const STORAGE_KEY = "filmabend_state_v1";
const GITHUB_CFG_KEY = "filmabend_github_sync_v1";
const THEME_KEY = "filmabend_theme_v1";
const SHORTLIST_KEY = "filmabend_shortlist_v1";

export function loadShortlist() {
  try {
    const raw = localStorage.getItem(SHORTLIST_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function saveShortlist(ids) {
  try {
    localStorage.setItem(SHORTLIST_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
  } catch {
    // ignore storage errors
  }
}

export function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "dark";
  } catch {
    return "dark";
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore storage errors
  }
}

export function loadGithubConfig() {
  try {
    const raw = localStorage.getItem(GITHUB_CFG_KEY);
    return raw ? JSON.parse(raw) : { owner: "", repo: "", branch: "main", token: "" };
  } catch {
    return { owner: "", repo: "", branch: "main", token: "" };
  }
}

export function saveGithubConfig(cfg) {
  localStorage.setItem(GITHUB_CFG_KEY, JSON.stringify({
    owner: String(cfg.owner || "").trim(),
    repo: String(cfg.repo || "").trim(),
    branch: String(cfg.branch || "main").trim() || "main",
    token: String(cfg.token || "").trim()
  }));
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function detectServer() {
  try {
    const res = await fetchJsonWithTimeout("./api/health", {}, 1500);
    if (!res.ok) return false;
    const data = await res.json();
    return Boolean(data && data.ok);
  } catch {
    return false;
  }
}

export async function loadInitialData() {
  const serverAvailable = await detectServer();

  if (serverAvailable) {
    try {
      const res = await fetch("./api/movies", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        validateDataset(data);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return { data, mode: "local-server" };
      }
    } catch {
      // fall back to static/localStorage below
    }
  }

  let localData = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      validateDataset(parsed);
      localData = parsed;
    }
  } catch {
    localData = null;
  }

  let staticData = { version: 1, items: [] };
  try {
    const res = await fetch("./data/movies.json", { cache: "no-store" });
    if (res.ok) {
      staticData = await res.json();
      validateDataset(staticData);
    }
  } catch {
    // offline without cached json
  }

  if (localData && localData.items.length > 0) {
    const staticById = new Map(staticData.items.map((i) => [i.id, i]));
    const localIds = new Set(localData.items.map((i) => i.id));
    const needsUpgrade = (staticData.version || 1) > (localData.version || 1);
    const missingCurated = staticData.items.filter((i) => !localIds.has(i.id));

    if (needsUpgrade || missingCurated.length > 0) {
      const applyV5Recalibration = (localData.version || 1) < 5 && (staticData.version || 1) >= 5;
      const updatedExisting = localData.items.map((item) => {
        if (!needsUpgrade) return item;
        const curated = staticById.get(item.id);
        if (!curated) return item;
        const upgraded = { ...item, posterUrl: curated.posterUrl };
        if (!item.watched && curated.watched) {
          upgraded.watched = true;
          upgraded.jointRating = curated.jointRating;
          upgraded.jointBalance = curated.jointBalance || "both";
          upgraded.jointNote = curated.jointNote;
          upgraded.watchedAt = curated.watchedAt;
        } else if (applyV5Recalibration && item.watched && curated.watched) {
          upgraded.jointRating = curated.jointRating;
          upgraded.jointBalance = curated.jointBalance || "both";
          upgraded.jointNote = curated.jointNote;
        }
        return upgraded;
      });
      const merged = {
        version: Math.max(localData.version || 1, staticData.version || 1),
        items: [...updatedExisting, ...missingCurated]
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return { data: merged, mode: "browser" };
    }
    return { data: localData, mode: "browser" };
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(staticData));
  return { data: staticData, mode: "browser" };
}

export async function persistData(data, mode) {
  validateDataset(data);
  const payload = { version: data.version || 1, items: data.items };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

  if (mode === "local-server") {
    const res = await fetch("./api/movies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      throw new Error(`Lokaler Server konnte nicht speichern (HTTP ${res.status}).`);
    }
    return { savedToServer: true };
  }

  return { savedToServer: false };
}

export async function resetToCuratedDefaults(mode) {
  const res = await fetch("./data/movies.json", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Kuratierte Startliste konnte nicht geladen werden.");
  }
  const fresh = await res.json();
  validateDataset(fresh);
  await persistData(fresh, mode);
  return fresh;
}

export function exportDatasetJson(data) {
  const json = JSON.stringify({ version: data.version || 1, items: data.items }, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const datePart = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `filmabend-backup-${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function parseImportedJson(text) {
  const parsed = JSON.parse(text);
  validateDataset(parsed);
  return { version: parsed.version || 1, items: parsed.items };
}

function toBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64Utf8(b64) {
  const binary = atob(b64.replace(/\s+/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function pullFromGithub(cfg) {
  if (!cfg.owner || !cfg.repo) {
    throw new Error("Bitte GitHub-Nutzer und Repository angeben.");
  }
  const branch = cfg.branch || "main";
  const url = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/data/movies.json?ref=${encodeURIComponent(branch)}`;
  const headers = { Accept: "application/vnd.github+json" };
  if (cfg.token) headers.Authorization = `Bearer ${cfg.token}`;

  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) {
    throw new Error(`GitHub-Abruf fehlgeschlagen (HTTP ${res.status}).`);
  }
  const body = await res.json();
  const decoded = fromBase64Utf8(body.content);
  return parseImportedJson(decoded);
}

export async function pushToGithub(cfg, data) {
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    throw new Error("Für das Speichern auf GitHub werden Nutzer, Repo und Token benötigt.");
  }
  validateDataset(data);
  const branch = cfg.branch || "main";
  const baseUrl = `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/data/movies.json`;
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${cfg.token}`,
    "Content-Type": "application/json"
  };

  let sha = null;
  const check = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (check.ok) {
    const existing = await check.json();
    sha = existing.sha;
  }

  const content = toBase64Utf8(JSON.stringify({ version: data.version || 1, items: data.items }, null, 2) + "\n");
  const putRes = await fetch(baseUrl, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      message: "Filmabend-Liste aktualisiert",
      content,
      branch,
      ...(sha ? { sha } : {})
    })
  });

  if (!putRes.ok) {
    throw new Error(`GitHub-Upload fehlgeschlagen (HTTP ${putRes.status}).`);
  }
  return true;
}
