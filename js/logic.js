// Reine, DOM-freie Logik für Filterung, Sortierung, Zufallsvorschlag und Datenmutation.

export const MOOD_OPTIONS = [
  { id: "witzig-clever", label: "Witzig & clever" },
  { id: "warmherzig", label: "Warmherzig" },
  { id: "packend-ernst", label: "Packend & ernst" }
];

export const QUICK_FILTER_CHIPS = [
  { id: "all", label: "Alle" },
  { id: "witzig-clever", label: "Witzig & clever" },
  { id: "warmherzig", label: "Warmherzig" },
  { id: "packend-ernst", label: "Packend & ernst" },
  { id: "kurzweilig", label: "Kurzweilig (< 100 Min. / Serie)" },
  { id: "free", label: "Frei (Mediathek)" }
];

export const FIT_LEVELS = {
  high: { id: "high", label: "Passt super", shortLabel: "★ Passt super", rank: 0 },
  medium: { id: "medium", label: "Je nach Stimmung", shortLabel: "◐ Je nach Stimmung", rank: 1 },
  low: { id: "low", label: "Passt eher nicht", shortLabel: "⚠ Passt eher nicht", rank: 2 }
};

export const TYPE_LABELS = {
  film: "Film",
  series: "Serie",
  doc: "Doku"
};

export const JOINT_VERDICTS = [
  { rating: 5, label: "Absoluter Volltreffer – besser geht’s kaum!" },
  { rating: 4.5, label: "Herausragend – richtig starker Abend" },
  { rating: 4, label: "Sehr schöner gemeinsamer Abend" },
  { rating: 3.5, label: "Echt gut – passte super, kleine Abstriche" },
  { rating: 3, label: "Solide & unterhaltsam – ganz nett" },
  { rating: 2.5, label: "Geht so – gute Ansätze, spürbare Schwächen" },
  { rating: 2, label: "Eher durchwachsen für uns zusammen" },
  { rating: 1.5, label: "Ziemlich schwach für uns" },
  { rating: 1, label: "War zusammen nichts für uns" }
];

export const JOINT_BALANCE_OPTIONS = [
  { id: "both", label: "Beide ähnlich", shortLabel: "" },
  { id: "mine", label: "Eher für mich", shortLabel: "Eher für mich" },
  { id: "hers", label: "Eher für sie", shortLabel: "Eher für sie" }
];

export const RECOMMENDERS = [
  "Arbeitskollegen",
  "Selbst notiert",
  "Mutter (ARD Mediathek)",
  "KI-Empfehlung"
];

export const SOURCE_CATEGORIES = {
  personal: { id: "personal", label: "Persönliche Liste (Selbst / Freunde / Familie)" },
  external: { id: "external", label: "Externe Empfehlung / KI-Idee" }
};

export function isExternalIdea(item) {
  return item?.sourceCategory === "external";
}

export function isValidHalfStepRating(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1 || num > 5) return false;
  return Math.abs(num * 2 - Math.round(num * 2)) < 1e-9;
}

export function formatRating(rating) {
  const num = Number(rating);
  if (!Number.isFinite(num)) return "";
  return num.toFixed(1).replace(".", ",");
}

export function getVerdictMeta(rating) {
  const num = Number(rating);
  if (!Number.isFinite(num)) return null;
  return JOINT_VERDICTS.find((v) => Math.abs(v.rating - num) < 1e-9) || null;
}

export function getBalanceMeta(balance) {
  const key = balance || "both";
  return JOINT_BALANCE_OPTIONS.find((b) => b.id === key) || JOINT_BALANCE_OPTIONS[0];
}

export function getUniqueRecommenders(items) {
  const seen = new Set();
  for (const item of items) {
    if (item.recommendedBy && item.recommendedBy.trim()) {
      seen.add(item.recommendedBy.trim());
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b, "de"));
}

export function isShortFriendly(item) {
  if (item.type === "series") {
    return typeof item.runtimeMinutes === "number" ? item.runtimeMinutes <= 45 : true;
  }
  return typeof item.runtimeMinutes === "number" && item.runtimeMinutes < 100;
}

export function computeTabCounts(items) {
  let open = 0;
  let ideas = 0;
  let watched = 0;
  let avoid = 0;
  for (const item of items) {
    if (item.watched) {
      watched += 1;
    } else if (item.fit === "low") {
      avoid += 1;
    } else if (isExternalIdea(item)) {
      ideas += 1;
    } else {
      open += 1;
    }
  }
  return { open, ideas, watched, avoid };
}

export function filterItems(items, filters = {}) {
  const {
    tab = "open",
    mood = "all",
    type = "all",
    recommender = "all",
    search = ""
  } = filters;

  const query = search.trim().toLowerCase();

  return items.filter((item) => {
    // 1. Tab filter
    if (tab === "open") {
      if (item.watched || item.fit === "low" || isExternalIdea(item)) return false;
    } else if (tab === "ideas") {
      if (item.watched || item.fit === "low" || !isExternalIdea(item)) return false;
    } else if (tab === "watched") {
      if (!item.watched) return false;
    } else if (tab === "avoid") {
      if (item.watched || item.fit !== "low") return false;
    }

    // 2. Quick mood / convenience filter
    if (mood && mood !== "all") {
      if (mood === "kurzweilig") {
        if (!isShortFriendly(item)) return false;
      } else if (mood === "free") {
        if (!item.freeSource || !item.freeSource.trim()) return false;
      } else {
        const moods = Array.isArray(item.moods) ? item.moods : [];
        if (!moods.includes(mood)) return false;
      }
    }

    // 3. Media type filter
    if (type && type !== "all") {
      if (type === "film") {
        if (item.type !== "film" && item.type !== "doc") return false;
      } else if (item.type !== type) {
        return false;
      }
    }

    // 4. Recommender filter
    if (recommender && recommender !== "all") {
      if ((item.recommendedBy || "").trim() !== recommender) return false;
    }

    // 5. Text search
    if (query) {
      const haystack = [
        item.title,
        item.originalTitle,
        item.summary,
        item.recommendedBy,
        item.recommendationNote,
        item.freeSource,
        ...(Array.isArray(item.moodLabels) ? item.moodLabels : [])
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }

    return true;
  });
}

export function sortItems(items, tab = "open") {
  const copy = [...items];
  if (tab === "watched") {
    copy.sort((a, b) => {
      const dateA = a.watchedAt ? Date.parse(a.watchedAt) : 0;
      const dateB = b.watchedAt ? Date.parse(b.watchedAt) : 0;
      if (dateB !== dateA) return dateB - dateA;
      const rA = Number(a.jointRating) || 0;
      const rB = Number(b.jointRating) || 0;
      if (rB !== rA) return rB - rA;
      return (a.title || "").localeCompare(b.title || "", "de");
    });
    return copy;
  }

  copy.sort((a, b) => {
    const rankA = FIT_LEVELS[a.fit]?.rank ?? 9;
    const rankB = FIT_LEVELS[b.fit]?.rank ?? 9;
    if (rankA !== rankB) return rankA - rankB;
    return (a.title || "").localeCompare(b.title || "", "de");
  });
  return copy;
}

export function pickRandomItem(filteredItems, lastId = null, rng = Math.random) {
  if (!Array.isArray(filteredItems) || filteredItems.length === 0) return null;
  if (filteredItems.length === 1) return filteredItems[0];
  const pool = lastId ? filteredItems.filter((item) => item.id !== lastId) : filteredItems;
  const candidates = pool.length > 0 ? pool : filteredItems;
  const idx = Math.floor(rng() * candidates.length);
  return candidates[Math.min(idx, candidates.length - 1)];
}

export function slugifyId(title, year) {
  const base = String(title || "titel")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = year ? `-${year}` : "";
  return `${base || "eintrag"}${suffix}`;
}

export function upsertItem(items, payload) {
  const cleanTitle = String(payload.title || "").trim();
  if (!cleanTitle) {
    throw new Error("Bitte einen Titel angeben.");
  }

  const cleanYear = payload.year ? Number(payload.year) : null;
  const existingIdx = payload.id ? items.findIndex((i) => i.id === payload.id) : -1;

  if (existingIdx >= 0) {
    const prev = items[existingIdx];
    const updated = {
      ...prev,
      ...payload,
      title: cleanTitle,
      year: cleanYear,
      runtimeMinutes: payload.runtimeMinutes !== "" && payload.runtimeMinutes !== null && payload.runtimeMinutes !== undefined
        ? Number(payload.runtimeMinutes)
        : null,
      moods: Array.isArray(payload.moods) ? [...new Set(payload.moods)] : prev.moods || [],
      moodLabels: Array.isArray(payload.moodLabels) ? payload.moodLabels : prev.moodLabels || []
    };
    const next = [...items];
    next[existingIdx] = updated;
    return next;
  }

  let newId = payload.id ? String(payload.id).trim() : slugifyId(cleanTitle, cleanYear);
  const existingIds = new Set(items.map((i) => i.id));
  if (existingIds.has(newId)) {
    let counter = 2;
    while (existingIds.has(`${newId}-${counter}`)) counter += 1;
    newId = `${newId}-${counter}`;
  }

  const created = {
    id: newId,
    title: cleanTitle,
    originalTitle: String(payload.originalTitle || "").trim(),
    year: cleanYear,
    type: payload.type || "film",
    runtimeMinutes: payload.runtimeMinutes !== "" && payload.runtimeMinutes !== null && payload.runtimeMinutes !== undefined
      ? Number(payload.runtimeMinutes)
      : null,
    runtimeLabel: String(payload.runtimeLabel || "").trim() || (payload.runtimeMinutes ? `${payload.runtimeMinutes} Min.` : "k. A."),
    moods: Array.isArray(payload.moods) ? [...new Set(payload.moods)] : [],
    moodLabels: Array.isArray(payload.moodLabels) ? payload.moodLabels : [],
    fit: payload.fit || "high",
    fitReason: String(payload.fitReason || "").trim(),
    summary: String(payload.summary || "").trim(),
    recommendedBy: String(payload.recommendedBy || "").trim() || "Selbst notiert",
    sourceCategory: payload.sourceCategory === "external" ? "external" : "personal",
    recommendationNote: String(payload.recommendationNote || "").trim(),
    freeSource: String(payload.freeSource || "").trim(),
    trailerUrl: String(payload.trailerUrl || "").trim(),
    trailerNote: String(payload.trailerNote || "").trim(),
    posterUrl: String(payload.posterUrl || "").trim(),
    watched: Boolean(payload.watched),
    jointRating: payload.watched && isValidHalfStepRating(payload.jointRating) ? Number(payload.jointRating) : null,
    jointBalance: payload.watched ? getBalanceMeta(payload.jointBalance).id : null,
    jointNote: payload.watched ? String(payload.jointNote || "").trim() : "",
    watchedAt: payload.watched ? payload.watchedAt || new Date().toISOString() : null
  };

  return [created, ...items];
}

export function deleteItem(items, id) {
  return items.filter((item) => item.id !== id);
}

export function markWatched(
  items,
  id,
  { jointRating, jointBalance = "both", jointNote = "", watchedAt = new Date().toISOString() } = {}
) {
  const ratingNum = Number(jointRating);
  if (!isValidHalfStepRating(ratingNum)) {
    throw new Error("Bitte wählt eine gemeinsame Bewertung von 1,0 bis 5,0 in 0,5er-Schritten.");
  }
  const cleanBalance = getBalanceMeta(jointBalance).id;
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          watched: true,
          jointRating: ratingNum,
          jointBalance: cleanBalance,
          jointNote: String(jointNote || "").trim(),
          watchedAt
        }
      : item
  );
}

export function unmarkWatched(items, id) {
  return items.map((item) =>
    item.id === id
      ? {
          ...item,
          watched: false,
          jointRating: null,
          jointBalance: null,
          jointNote: "",
          watchedAt: null
        }
      : item
  );
}

export function moveItemFit(items, id, nextFit) {
  if (!FIT_LEVELS[nextFit]) return items;
  return items.map((item) => (item.id === id ? { ...item, fit: nextFit } : item));
}

export function promoteIdeaToPersonal(items, id) {
  return items.map((item) =>
    item.id === id ? { ...item, sourceCategory: "personal" } : item
  );
}

export function validateDataset(data) {
  if (!data || typeof data !== "object" || !Array.isArray(data.items)) {
    throw new Error("Ungültiges Datenformat: 'items'-Array fehlt.");
  }
  const validBalances = new Set(JOINT_BALANCE_OPTIONS.map((b) => b.id));
  const ids = new Set();
  for (const item of data.items) {
    if (!item || typeof item !== "object") {
      throw new Error("Ungültiger Eintrag im Datensatz.");
    }
    if (!item.id || typeof item.id !== "string") {
      throw new Error(`Eintrag ohne gültige ID: ${item.title || "unbekannt"}`);
    }
    if (ids.has(item.id)) {
      throw new Error(`Doppelte ID im Datensatz: ${item.id}`);
    }
    ids.add(item.id);
    if (!item.title || typeof item.title !== "string") {
      throw new Error(`Eintrag ohne Titel: ${item.id}`);
    }
    if (!["film", "series", "doc"].includes(item.type)) {
      throw new Error(`Ungültiger Typ bei ${item.id}: ${item.type}`);
    }
    if (!FIT_LEVELS[item.fit]) {
      throw new Error(`Ungültige Passung bei ${item.id}: ${item.fit}`);
    }
    if (item.jointRating !== null && item.jointRating !== undefined && !isValidHalfStepRating(item.jointRating)) {
      throw new Error(`Ungültige Bewertung bei ${item.id}: ${item.jointRating}`);
    }
    if (item.jointBalance !== null && item.jointBalance !== undefined && item.jointBalance !== "" && !validBalances.has(item.jointBalance)) {
      throw new Error(`Ungültige Paar-Balance bei ${item.id}: ${item.jointBalance}`);
    }
  }
  return true;
}

export function toggleShortlistId(shortlistIds = [], id) {
  if (!id) return [...shortlistIds];
  const exists = shortlistIds.includes(id);
  return exists ? shortlistIds.filter((entry) => entry !== id) : [...shortlistIds, id];
}

export function pruneShortlist(shortlistIds = [], items = []) {
  const openIds = new Set(items.filter((i) => !i.watched).map((i) => i.id));
  const seen = new Set();
  const result = [];
  for (const id of shortlistIds) {
    if (openIds.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function getQuickDecisionMatches(
  items = [],
  { time = "any", vibe = "any", freeOnly = false, includeIdeas = false, excludeIds = [] } = {}
) {
  const basePool = items.filter((item) => {
    if (item.watched || item.fit === "low") return false;
    if (!includeIdeas && isExternalIdea(item)) return false;

    if (time === "short") {
      if (!isShortFriendly(item)) return false;
    } else if (time === "medium") {
      if (typeof item.runtimeMinutes === "number" && item.runtimeMinutes > 125) return false;
    }

    if (vibe && vibe !== "any") {
      const moods = Array.isArray(item.moods) ? item.moods : [];
      if (!moods.includes(vibe)) return false;
    }

    if (freeOnly && (!item.freeSource || !item.freeSource.trim())) {
      return false;
    }

    return true;
  });

  const sortedAll = sortItems(basePool, "open");
  const excludeSet = new Set(excludeIds);
  const filtered = excludeSet.size > 0 ? sortedAll.filter((i) => !excludeSet.has(i.id)) : sortedAll;
  const effective = filtered.length > 0 ? filtered : sortedAll;

  return {
    top: effective.slice(0, 3),
    total: sortedAll.length,
    wrappedAround: excludeSet.size > 0 && filtered.length === 0 && sortedAll.length > 0
  };
}

export function buildTasteProfileText(items = []) {
  const watched = [...items.filter((i) => i.watched)].sort((a, b) => {
    const rA = Number(a.jointRating) || 0;
    const rB = Number(b.jointRating) || 0;
    if (rB !== rA) return rB - rA;
    const dateA = a.watchedAt ? Date.parse(a.watchedAt) : 0;
    const dateB = b.watchedAt ? Date.parse(b.watchedAt) : 0;
    if (dateB !== dateA) return dateB - dateA;
    return (a.title || "").localeCompare(b.title || "", "de");
  });
  const liked = watched.filter((i) => Number(i.jointRating) >= 4);
  const okay = watched.filter((i) => Number(i.jointRating) >= 3 && Number(i.jointRating) < 4);
  const disliked = watched.filter((i) => i.jointRating && Number(i.jointRating) < 3);
  const openTitles = sortItems(items.filter((i) => !i.watched && i.fit !== "low" && !isExternalIdea(i)), "open");
  const ideaTitles = sortItems(items.filter((i) => !i.watched && i.fit !== "low" && isExternalIdea(i)), "ideas");
  const avoided = items.filter((i) => !i.watched && i.fit === "low");

  const formatWatchedLine = (item) => {
    const yearPart = item.year ? ` (${item.year})` : "";
    const ratingPart = item.jointRating ? ` – ${formatRating(item.jointRating)}/5` : "";
    const balanceMeta = getBalanceMeta(item.jointBalance);
    const balancePart = balanceMeta && balanceMeta.shortLabel ? ` (${balanceMeta.shortLabel})` : "";
    const notePart = item.jointNote ? ` · Fazit: „${item.jointNote}“` : "";
    return `- ${item.title}${yearPart}${ratingPart}${balancePart}${notePart}`;
  };

  const lines = [
    "Unser gemeinsames Film- & Serien-Geschmacksprofil",
    "",
    "Rahmenbedingungen:",
    "- Sprache: Hauptsächlich auf Deutsch (synchronisiert oder deutschsprachiges Original)",
    "- Klare No-Gos: Kein Fantasy, kein Sci-Fi, kein Horror",
    "- Stil & Anspruch: Weder zu platt/vorhersehbar (kein klischeehaftes US-Formelkino) noch zu überkomplex, anstrengend oder zu düster/ernst",
    "- Vorlieben: Kluge Komödien, spielerisch-clevere & überraschende Unterhaltung, ein bisschen Krimi-Spannung ist okay, sowie echte, un-klischeehafte Charakter-Dramedys",
    ""
  ];

  if (watched.length === 0) {
    lines.push("Gemeinsam gesehen & bewertet: Noch keine Einträge in der App markiert.", "");
  } else {
    lines.push("Gemeinsam gesehen & bewertet (Skala 1,0–5,0 in 0,5er-Schritten):");
    if (liked.length > 0) {
      lines.push("Highlights (4,0–5,0/5):");
      liked.forEach((i) => lines.push(formatWatchedLine(i)));
    }
    if (okay.length > 0) {
      lines.push("Gut bis solide (3,0–3,5/5):");
      okay.forEach((i) => lines.push(formatWatchedLine(i)));
    }
    if (disliked.length > 0) {
      lines.push("Eher durchwachsen / schwach (1,0–2,5/5):");
      disliked.forEach((i) => lines.push(formatWatchedLine(i)));
    }
    lines.push("");
  }

  if (openTitles.length > 0) {
    lines.push(`Aktuell schon auf unserer persönlichen Liste (${openTitles.length}, bitte nicht doppelt vorschlagen):`);
    lines.push(openTitles.map((i) => i.title).join(", "), "");
  }

  if (ideaTitles.length > 0) {
    lines.push(`Bereits als externe/KI-Ideen vorgemerkt (${ideaTitles.length}, bitte nicht doppelt vorschlagen):`);
    lines.push(ideaTitles.map((i) => i.title).join(", "), "");
  }

  if (avoided.length > 0) {
    lines.push(`Aussortiert („Eher nicht“): ${avoided.map((i) => i.title).join(", ")}`, "");
  }

  lines.push(
    "Bitte empfiehl uns auf dieser Basis 5 neue Filme (auf Deutsch verfügbar), die zu uns beiden passen – jeweils kurz begründet mit Laufzeit und Stimmung."
  );

  return lines.join("\n");
}

