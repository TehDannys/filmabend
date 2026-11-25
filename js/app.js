// Hauptsteuerung für die Filmabend-App.

import {
  MOOD_OPTIONS,
  buildTasteProfileText,
  computeTabCounts,
  deleteItem,
  filterItems,
  getQuickDecisionMatches,
  getUniqueRecommenders,
  markWatched,
  pickRandomItem,
  promoteIdeaToPersonal,
  pruneShortlist,
  sortItems,
  toggleShortlistId,
  unmarkWatched,
  upsertItem
} from "./logic.js";
import {
  exportDatasetJson,
  loadGithubConfig,
  loadInitialData,
  loadShortlist,
  loadTheme,
  parseImportedJson,
  persistData,
  pullFromGithub,
  pushToGithub,
  resetToCuratedDefaults,
  saveGithubConfig,
  saveShortlist,
  saveTheme
} from "./store.js";
import {
  renderBalanceOptions,
  renderCard,
  renderCardsGrid,
  renderMoodCheckboxes,
  renderQuickChips,
  renderQuickResultCards,
  renderRecommenderOptions,
  renderVerdictOptions,
  renderVerdictPreview
} from "./ui.js";

const state = {
  data: { version: 1, items: [] },
  mode: "browser",
  shortlist: [],
  filters: {
    tab: "open",
    mood: "all",
    type: "all",
    recommender: "all",
    search: ""
  },
  quick: {
    time: "any",
    vibe: "any",
    freeOnly: false,
    includeIdeas: false,
    shownIds: []
  },
  lastRandomId: null,
  ratingTargetId: null
};

const els = {
  themeToggleBtn: document.getElementById("theme-toggle-btn"),
  themeColorMeta: document.getElementById("theme-color-meta"),
  syncBtn: document.getElementById("sync-btn"),
  addBtn: document.getElementById("add-btn"),
  tabBtns: Array.from(document.querySelectorAll(".tab-btn")),
  countOpen: document.getElementById("count-open"),
  countIdeas: document.getElementById("count-ideas"),
  countWatched: document.getElementById("count-watched"),
  countAvoid: document.getElementById("count-avoid"),
  moodChips: document.getElementById("mood-chips"),
  typeFilter: document.getElementById("type-filter"),
  recommenderFilter: document.getElementById("recommender-filter"),
  searchInput: document.getElementById("search-input"),
  quickBtn: document.getElementById("quick-btn"),
  randomBtn: document.getElementById("random-btn"),
  shortlistBar: document.getElementById("shortlist-bar"),
  shortlistCount: document.getElementById("shortlist-count"),
  shortlistOpenBtn: document.getElementById("shortlist-open-btn"),
  shortlistClearBtn: document.getElementById("shortlist-clear-btn"),
  ideasInfoBanner: document.getElementById("ideas-info-banner"),
  watchedProfileBanner: document.getElementById("watched-profile-banner"),
  exportProfileBtn: document.getElementById("export-profile-btn"),
  resultsSummary: document.getElementById("results-summary"),
  resetFiltersBtn: document.getElementById("reset-filters-btn"),
  cardsGrid: document.getElementById("cards-grid"),

  randomDialog: document.getElementById("random-dialog"),
  randomDialogBody: document.getElementById("random-dialog-body"),
  randomTrailerLink: document.getElementById("random-trailer-link"),
  rerollBtn: document.getElementById("reroll-btn"),

  rateDialog: document.getElementById("rate-dialog"),
  rateForm: document.getElementById("rate-form"),
  rateMovieName: document.getElementById("rate-movie-name"),
  verdictPreview: document.getElementById("verdict-preview"),
  verdictOptions: document.getElementById("verdict-options"),
  verdictBalanceOptions: document.getElementById("verdict-balance-options"),
  rateNoteInput: document.getElementById("rate-note-input"),

  editDialog: document.getElementById("edit-dialog"),
  editForm: document.getElementById("edit-form"),
  editDialogEyebrow: document.getElementById("edit-dialog-eyebrow"),
  editDialogTitle: document.getElementById("edit-dialog-title"),
  editId: document.getElementById("edit-id"),
  editTitle: document.getElementById("edit-title"),
  editOriginalTitle: document.getElementById("edit-original-title"),
  editType: document.getElementById("edit-type"),
  editYear: document.getElementById("edit-year"),
  editRuntimeMinutes: document.getElementById("edit-runtime-minutes"),
  editRuntimeLabel: document.getElementById("edit-runtime-label"),
  editMoodBoxes: document.getElementById("edit-mood-boxes"),
  editFit: document.getElementById("edit-fit"),
  editFreeSource: document.getElementById("edit-free-source"),
  editFitReason: document.getElementById("edit-fit-reason"),
  editSummary: document.getElementById("edit-summary"),
  editSourceCategory: document.getElementById("edit-source-category"),
  editRecommendedBy: document.getElementById("edit-recommended-by"),
  editRecNote: document.getElementById("edit-rec-note"),
  editTrailerUrl: document.getElementById("edit-trailer-url"),
  editPosterUrl: document.getElementById("edit-poster-url"),
  editDeleteBtn: document.getElementById("edit-delete-btn"),

  syncDialog: document.getElementById("sync-dialog"),
  storageStatusBox: document.getElementById("storage-status-box"),
  exportJsonBtn: document.getElementById("export-json-btn"),
  importJsonInput: document.getElementById("import-json-input"),
  githubSyncForm: document.getElementById("github-sync-form"),
  ghOwner: document.getElementById("gh-owner"),
  ghRepo: document.getElementById("gh-repo"),
  ghBranch: document.getElementById("gh-branch"),
  ghToken: document.getElementById("gh-token"),
  ghPullBtn: document.getElementById("gh-pull-btn"),
  ghPushBtn: document.getElementById("gh-push-btn"),
  ghSyncFeedback: document.getElementById("gh-sync-feedback"),
  syncExportProfileBtn: document.getElementById("sync-export-profile-btn"),
  resetDefaultBtn: document.getElementById("reset-default-btn"),

  quickDialog: document.getElementById("quick-dialog"),
  quickTimePills: document.getElementById("quick-time-pills"),
  quickVibePills: document.getElementById("quick-vibe-pills"),
  quickFreeOnly: document.getElementById("quick-free-only"),
  quickIncludeIdeas: document.getElementById("quick-include-ideas"),
  quickResultsMeta: document.getElementById("quick-results-meta"),
  quickResultsList: document.getElementById("quick-results-list"),
  quickRerollBtn: document.getElementById("quick-reroll-btn"),

  shortlistDialog: document.getElementById("shortlist-dialog"),
  shortlistDialogBody: document.getElementById("shortlist-dialog-body"),
  shortlistDialogClearBtn: document.getElementById("shortlist-dialog-clear-btn"),
  shortlistRandomBtn: document.getElementById("shortlist-random-btn"),

  profileDialog: document.getElementById("profile-dialog"),
  profileExportText: document.getElementById("profile-export-text"),
  profileCopyBtn: document.getElementById("profile-copy-btn"),

  toast: document.getElementById("toast")
};

let toastTimer = null;

function showToast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 2800);
}

function applyTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  els.themeToggleBtn.textContent = next === "light" ? "☀️" : "🌙";
  els.themeColorMeta.setAttribute("content", next === "light" ? "#f6f4ef" : "#111216");
  saveTheme(next);
}

function getFilteredSortedItems() {
  const filtered = filterItems(state.data.items, state.filters);
  return sortItems(filtered, state.filters.tab);
}

function hasActiveFilters() {
  return (
    state.filters.mood !== "all" ||
    state.filters.type !== "all" ||
    state.filters.recommender !== "all" ||
    state.filters.search.trim() !== ""
  );
}

function renderAll() {
  state.shortlist = pruneShortlist(state.shortlist, state.data.items);
  saveShortlist(state.shortlist);

  const counts = computeTabCounts(state.data.items);
  els.countOpen.textContent = String(counts.open);
  els.countIdeas.textContent = String(counts.ideas);
  els.countWatched.textContent = String(counts.watched);
  els.countAvoid.textContent = String(counts.avoid);

  for (const btn of els.tabBtns) {
    btn.classList.toggle("is-active", btn.dataset.tab === state.filters.tab);
  }

  renderQuickChips(els.moodChips, state.filters.mood);
  renderRecommenderOptions(
    els.recommenderFilter,
    getUniqueRecommenders(state.data.items),
    state.filters.recommender
  );

  els.shortlistBar.hidden = state.shortlist.length === 0;
  els.shortlistCount.textContent = String(state.shortlist.length);
  els.ideasInfoBanner.hidden = state.filters.tab !== "ideas";
  els.watchedProfileBanner.hidden = state.filters.tab !== "watched";

  const visible = getFilteredSortedItems();
  renderCardsGrid(els.cardsGrid, visible, state.filters.tab, state.shortlist);

  const label = visible.length === 1 ? "1 Vorschlag" : `${visible.length} Vorschläge`;
  els.resultsSummary.textContent = label;
  els.resetFiltersBtn.hidden = !hasActiveFilters();
  els.randomBtn.disabled = visible.length === 0;
}

function getShortlistItems() {
  const byId = new Map(state.data.items.map((i) => [i.id, i]));
  return state.shortlist.map((id) => byId.get(id)).filter((i) => i && !i.watched);
}

function renderShortlistDialog() {
  const items = getShortlistItems();
  if (items.length === 0) {
    els.shortlistDialogBody.innerHTML = `<div class="empty-state"><h3>Shortlist leer</h3><p>Merkt euch auf der Startseite einfach 2–3 spannende Filme mit 📌 Merken.</p></div>`;
    els.shortlistRandomBtn.disabled = true;
    return;
  }
  els.shortlistDialogBody.innerHTML = items
    .map((item) => renderCard(item, { shortlistIds: state.shortlist, inShortlistDialog: true }))
    .join("");
  els.shortlistRandomBtn.disabled = items.length < 2;
}

function renderQuickDialogResults() {
  for (const btn of els.quickTimePills.querySelectorAll("[data-quick-time]")) {
    btn.classList.toggle("is-active", btn.dataset.quickTime === state.quick.time);
  }
  for (const btn of els.quickVibePills.querySelectorAll("[data-quick-vibe]")) {
    btn.classList.toggle("is-active", btn.dataset.quickVibe === state.quick.vibe);
  }
  els.quickFreeOnly.checked = state.quick.freeOnly;
  els.quickIncludeIdeas.checked = state.quick.includeIdeas;

  const { top, total, wrappedAround } = getQuickDecisionMatches(state.data.items, {
    time: state.quick.time,
    vibe: state.quick.vibe,
    freeOnly: state.quick.freeOnly,
    includeIdeas: state.quick.includeIdeas,
    excludeIds: state.quick.shownIds
  });

  if (wrappedAround) {
    state.quick.shownIds = [];
  }

  els.quickResultsMeta.textContent =
    total === 0
      ? "0 passende Titel"
      : total <= 3
      ? `${total} passende Titel`
      : `Top ${top.length} von ${total} passenden Titeln`;
  els.quickRerollBtn.disabled = total <= 3;

  renderQuickResultCards(els.quickResultsList, top, state.shortlist);
  return top;
}

function openQuickDialog() {
  state.quick.shownIds = [];
  renderQuickDialogResults();
  els.quickDialog.showModal();
}

function openShortlistDialog() {
  renderShortlistDialog();
  els.shortlistDialog.showModal();
}

async function exportTasteProfile() {
  const text = buildTasteProfileText(state.data.items);
  els.profileExportText.value = text;
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Geschmacksprofil in die Zwischenablage kopiert!");
      return;
    } catch {
      // fall through to dialog fallback
    }
  }
  els.profileDialog.showModal();
  els.profileExportText.focus();
  els.profileExportText.select();
}

function togglePin(id) {
  state.shortlist = pruneShortlist(toggleShortlistId(state.shortlist, id), state.data.items);
  saveShortlist(state.shortlist);
  const pinned = state.shortlist.includes(id);
  renderAll();
  if (els.shortlistDialog.open) renderShortlistDialog();
  if (els.quickDialog.open) {
    const currentQuickIds = Array.from(
      els.quickResultsList.querySelectorAll("[data-id]")
    ).map((el) => el.dataset.id);
    const byId = new Map(state.data.items.map((i) => [i.id, i]));
    renderQuickResultCards(
      els.quickResultsList,
      currentQuickIds.map((qid) => byId.get(qid)).filter(Boolean),
      state.shortlist
    );
  }
  showToast(pinned ? "Für heute gemerkt 📌" : "Von Shortlist entfernt.");
}

async function saveAndRender(toastMsg) {
  try {
    await persistData(state.data, state.mode);
    renderAll();
    if (toastMsg) showToast(toastMsg);
  } catch (err) {
    renderAll();
    showToast(err.message || "Speichern fehlgeschlagen");
  }
}

function openRandomSuggestion() {
  const visible = getFilteredSortedItems();
  const picked = pickRandomItem(visible, state.lastRandomId);
  if (!picked) {
    showToast("Keine passenden Titel im aktuellen Filter.");
    return;
  }
  state.lastRandomId = picked.id;
  els.randomDialogBody.innerHTML = renderCard(picked, { compactForModal: true });
  const trailer =
    picked.trailerUrl && picked.trailerUrl.trim()
      ? picked.trailerUrl.trim()
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${picked.title} Trailer Deutsch`)}`;
  els.randomTrailerLink.href = trailer;
  if (!els.randomDialog.open) els.randomDialog.showModal();
}

function openRateDialog(id) {
  const item = state.data.items.find((i) => i.id === id);
  if (!item) return;
  state.ratingTargetId = id;
  els.rateMovieName.textContent = item.title;
  const initialRating = item.jointRating ?? 3.5;
  const initialBalance = item.jointBalance || "both";
  renderVerdictPreview(els.verdictPreview, initialRating);
  renderVerdictOptions(els.verdictOptions, initialRating);
  renderBalanceOptions(els.verdictBalanceOptions, initialBalance);
  els.rateNoteInput.value = item.jointNote || "";
  els.rateDialog.showModal();
}

function openEditDialog(id = null) {
  const item = id ? state.data.items.find((i) => i.id === id) : null;
  if (item) {
    els.editDialogEyebrow.textContent = "Eintrag bearbeiten";
    els.editDialogTitle.textContent = item.title;
    els.editId.value = item.id;
    els.editTitle.value = item.title || "";
    els.editOriginalTitle.value = item.originalTitle || "";
    els.editType.value = item.type || "film";
    els.editYear.value = item.year || "";
    els.editRuntimeMinutes.value = item.runtimeMinutes ?? "";
    els.editRuntimeLabel.value = item.runtimeLabel || "";
    renderMoodCheckboxes(els.editMoodBoxes, item.moods || []);
    els.editFit.value = item.fit || "high";
    els.editFreeSource.value = item.freeSource || "";
    els.editFitReason.value = item.fitReason || "";
    els.editSummary.value = item.summary || "";
    els.editSourceCategory.value = item.sourceCategory === "external" ? "external" : "personal";
    els.editRecommendedBy.value = item.recommendedBy || "Selbst notiert";
    els.editRecNote.value = item.recommendationNote || "";
    els.editTrailerUrl.value = item.trailerUrl || "";
    els.editPosterUrl.value = item.posterUrl || "";
    els.editDeleteBtn.hidden = false;
  } else {
    els.editDialogEyebrow.textContent = "Neuer Eintrag";
    els.editDialogTitle.textContent = "Film oder Serie hinzufügen";
    els.editForm.reset();
    els.editId.value = "";
    els.editType.value = "film";
    els.editFit.value = "high";
    els.editSourceCategory.value = state.filters.tab === "ideas" ? "external" : "personal";
    els.editRecommendedBy.value = state.filters.tab === "ideas" ? "KI-Empfehlung" : "Selbst notiert";
    renderMoodCheckboxes(els.editMoodBoxes, ["witzig-clever"]);
    els.editDeleteBtn.hidden = true;
  }
  els.editDialog.showModal();
}

function openSyncDialog() {
  const modeText =
    state.mode === "local-server"
      ? "<strong>Aktiv: Lokaler WLAN-Server</strong> — Änderungen werden direkt in <code>data/movies.json</code> auf deinem Mac gespeichert."
      : "<strong>Aktiv: Browser-Speicher</strong> — Änderungen sind lokal auf diesem Gerät gespeichert. Für Abgleich zwischen Geräten nutzt ihr Export/Import oder GitHub-Sync.";
  els.storageStatusBox.innerHTML = modeText;

  const cfg = loadGithubConfig();
  els.ghOwner.value = cfg.owner || "";
  els.ghRepo.value = cfg.repo || "";
  els.ghBranch.value = cfg.branch || "main";
  els.ghToken.value = cfg.token || "";
  els.ghSyncFeedback.textContent = "";
  els.syncDialog.showModal();
}

function bindEvents() {
  els.themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });

  els.addBtn.addEventListener("click", () => openEditDialog(null));
  els.syncBtn.addEventListener("click", openSyncDialog);
  els.quickBtn.addEventListener("click", openQuickDialog);
  els.randomBtn.addEventListener("click", openRandomSuggestion);
  els.rerollBtn.addEventListener("click", openRandomSuggestion);
  els.shortlistOpenBtn.addEventListener("click", openShortlistDialog);
  els.shortlistClearBtn.addEventListener("click", () => {
    state.shortlist = [];
    saveShortlist([]);
    renderAll();
    showToast("Shortlist geleert.");
  });
  els.shortlistDialogClearBtn.addEventListener("click", () => {
    state.shortlist = [];
    saveShortlist([]);
    renderAll();
    renderShortlistDialog();
    els.shortlistDialog.close();
  });
  els.shortlistRandomBtn.addEventListener("click", () => {
    const items = getShortlistItems();
    const picked = pickRandomItem(items, state.lastRandomId);
    if (!picked) return;
    state.lastRandomId = picked.id;
    els.shortlistDialog.close();
    els.randomDialogBody.innerHTML = renderCard(picked, { compactForModal: true });
    els.randomTrailerLink.href =
      picked.trailerUrl && picked.trailerUrl.trim()
        ? picked.trailerUrl.trim()
        : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${picked.title} Trailer Deutsch`)}`;
    els.randomDialog.showModal();
  });
  els.exportProfileBtn.addEventListener("click", exportTasteProfile);
  els.syncExportProfileBtn.addEventListener("click", () => {
    els.syncDialog.close();
    exportTasteProfile();
  });
  els.profileCopyBtn.addEventListener("click", async () => {
    const text = els.profileExportText.value;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        els.profileExportText.focus();
        els.profileExportText.select();
        document.execCommand("copy");
      }
      showToast("Geschmacksprofil kopiert!");
    } catch {
      els.profileExportText.focus();
      els.profileExportText.select();
      showToast("Text markiert – einfach manuell kopieren.");
    }
  });

  els.quickTimePills.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-quick-time]");
    if (!btn) return;
    state.quick.time = btn.dataset.quickTime;
    state.quick.shownIds = [];
    renderQuickDialogResults();
  });

  els.quickVibePills.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-quick-vibe]");
    if (!btn) return;
    state.quick.vibe = btn.dataset.quickVibe;
    state.quick.shownIds = [];
    renderQuickDialogResults();
  });

  els.quickFreeOnly.addEventListener("change", () => {
    state.quick.freeOnly = els.quickFreeOnly.checked;
    state.quick.shownIds = [];
    renderQuickDialogResults();
  });

  els.quickIncludeIdeas.addEventListener("change", () => {
    state.quick.includeIdeas = els.quickIncludeIdeas.checked;
    state.quick.shownIds = [];
    renderQuickDialogResults();
  });

  els.quickRerollBtn.addEventListener("click", () => {
    const currentlyShown = Array.from(
      els.quickResultsList.querySelectorAll("[data-id]")
    ).map((el) => el.dataset.id);
    state.quick.shownIds = [...new Set([...state.quick.shownIds, ...currentlyShown])];
    renderQuickDialogResults();
  });

  els.quickResultsList.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-quick-pin]");
    if (!btn) return;
    togglePin(btn.dataset.quickPin);
  });

  els.shortlistDialogBody.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "pin") {
      togglePin(id);
    } else if (action === "rate") {
      els.shortlistDialog.close();
      openRateDialog(id);
    }
  });

  for (const btn of els.tabBtns) {
    btn.addEventListener("click", () => {
      state.filters.tab = btn.dataset.tab;
      renderAll();
    });
  }

  els.moodChips.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mood-chip]");
    if (!btn) return;
    state.filters.mood = btn.dataset.moodChip;
    renderAll();
  });

  els.typeFilter.addEventListener("change", () => {
    state.filters.type = els.typeFilter.value;
    renderAll();
  });

  els.recommenderFilter.addEventListener("change", () => {
    state.filters.recommender = els.recommenderFilter.value;
    renderAll();
  });

  els.searchInput.addEventListener("input", () => {
    state.filters.search = els.searchInput.value;
    renderAll();
  });

  els.resetFiltersBtn.addEventListener("click", () => {
    state.filters.mood = "all";
    state.filters.type = "all";
    state.filters.recommender = "all";
    state.filters.search = "";
    els.typeFilter.value = "all";
    els.recommenderFilter.value = "all";
    els.searchInput.value = "";
    renderAll();
  });

  els.cardsGrid.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "rate") {
      openRateDialog(id);
    } else if (action === "edit") {
      openEditDialog(id);
    } else if (action === "pin") {
      togglePin(id);
    } else if (action === "promote") {
      state.data.items = promoteIdeaToPersonal(state.data.items, id);
      await saveAndRender("In eure persönliche „Offen“-Liste übernommen!");
    } else if (action === "unwatch") {
      state.data.items = unmarkWatched(state.data.items, id);
      await saveAndRender("Wieder auf „Offen“ gesetzt.");
    }
  });

  els.verdictOptions.addEventListener("change", (e) => {
    const radio = e.target.closest('input[name="jointRating"]');
    if (!radio) return;
    for (const label of els.verdictOptions.querySelectorAll(".rating-tile")) {
      label.classList.toggle("is-selected", label.contains(radio));
    }
    renderVerdictPreview(els.verdictPreview, Number(radio.value));
  });

  els.verdictBalanceOptions.addEventListener("change", (e) => {
    const radio = e.target.closest('input[name="jointBalance"]');
    if (!radio) return;
    for (const label of els.verdictBalanceOptions.querySelectorAll(".balance-pill")) {
      label.classList.toggle("is-selected", label.contains(radio));
    }
  });

  els.rateForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selected = els.rateForm.querySelector('input[name="jointRating"]:checked');
    if (!selected || !state.ratingTargetId) return;
    const balanceEl = els.rateForm.querySelector('input[name="jointBalance"]:checked');
    state.data.items = markWatched(state.data.items, state.ratingTargetId, {
      jointRating: Number(selected.value),
      jointBalance: balanceEl ? balanceEl.value : "both",
      jointNote: els.rateNoteInput.value
    });
    els.rateDialog.close();
    await saveAndRender("Gemeinsames Urteil gespeichert ♥");
  });

  els.editRuntimeMinutes.addEventListener("input", () => {
    if (!els.editRuntimeLabel.value.trim() && els.editRuntimeMinutes.value) {
      els.editRuntimeLabel.value = `${els.editRuntimeMinutes.value} Min.`;
    }
  });

  els.editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const selectedMoods = Array.from(
      els.editMoodBoxes.querySelectorAll('input[name="moods"]:checked')
    ).map((el) => el.value);
    const moodLabels = selectedMoods.map(
      (id) => MOOD_OPTIONS.find((m) => m.id === id)?.label || id
    );

    const payload = {
      id: els.editId.value || undefined,
      title: els.editTitle.value,
      originalTitle: els.editOriginalTitle.value,
      type: els.editType.value,
      year: els.editYear.value ? Number(els.editYear.value) : null,
      runtimeMinutes: els.editRuntimeMinutes.value ? Number(els.editRuntimeMinutes.value) : null,
      runtimeLabel: els.editRuntimeLabel.value,
      moods: selectedMoods,
      moodLabels,
      fit: els.editFit.value,
      freeSource: els.editFreeSource.value,
      fitReason: els.editFitReason.value,
      summary: els.editSummary.value,
      sourceCategory: els.editSourceCategory.value,
      recommendedBy: els.editRecommendedBy.value,
      recommendationNote: els.editRecNote.value,
      trailerUrl: els.editTrailerUrl.value,
      posterUrl: els.editPosterUrl.value
    };

    const isUpdate = Boolean(els.editId.value);
    state.data.items = upsertItem(state.data.items, payload);
    els.editDialog.close();
    await saveAndRender(isUpdate ? "Eintrag aktualisiert." : "Neuer Eintrag hinzugefügt.");
  });

  els.editDeleteBtn.addEventListener("click", async () => {
    const id = els.editId.value;
    const title = els.editTitle.value;
    if (!id) return;
    if (!window.confirm(`„${title}“ wirklich aus der Liste entfernen?`)) return;
    state.data.items = deleteItem(state.data.items, id);
    els.editDialog.close();
    await saveAndRender("Eintrag entfernt.");
  });

  document.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-close-dialog]");
    if (!closeBtn) return;
    const dlg = document.getElementById(closeBtn.dataset.closeDialog);
    if (dlg && dlg.open) dlg.close();
  });

  els.exportJsonBtn.addEventListener("click", () => {
    exportDatasetJson(state.data);
    showToast("Backup heruntergeladen.");
  });

  els.importJsonInput.addEventListener("change", async () => {
    const file = els.importJsonInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      state.data = parseImportedJson(text);
      await saveAndRender("Backup importiert.");
      els.syncDialog.close();
    } catch (err) {
      showToast(err.message || "Backup ungültig.");
    } finally {
      els.importJsonInput.value = "";
    }
  });

  els.githubSyncForm.addEventListener("submit", (e) => {
    e.preventDefault();
    saveGithubConfig({
      owner: els.ghOwner.value,
      repo: els.ghRepo.value,
      branch: els.ghBranch.value,
      token: els.ghToken.value
    });
    els.ghSyncFeedback.textContent = "GitHub-Einstellungen im Browser gespeichert.";
  });

  els.ghPullBtn.addEventListener("click", async () => {
    const cfg = {
      owner: els.ghOwner.value,
      repo: els.ghRepo.value,
      branch: els.ghBranch.value,
      token: els.ghToken.value
    };
    saveGithubConfig(cfg);
    try {
      els.ghSyncFeedback.textContent = "Lade von GitHub…";
      state.data = await pullFromGithub(cfg);
      await saveAndRender("Daten von GitHub geladen.");
      els.ghSyncFeedback.textContent = "Erfolgreich von GitHub geladen.";
    } catch (err) {
      els.ghSyncFeedback.textContent = err.message;
    }
  });

  els.ghPushBtn.addEventListener("click", async () => {
    const cfg = {
      owner: els.ghOwner.value,
      repo: els.ghRepo.value,
      branch: els.ghBranch.value,
      token: els.ghToken.value
    };
    saveGithubConfig(cfg);
    try {
      els.ghSyncFeedback.textContent = "Sende zu GitHub…";
      await pushToGithub(cfg, state.data);
      els.ghSyncFeedback.textContent = "Erfolgreich in GitHub gespeichert.";
      showToast("Auf GitHub gespeichert.");
    } catch (err) {
      els.ghSyncFeedback.textContent = err.message;
    }
  });

  els.resetDefaultBtn.addEventListener("click", async () => {
    if (!window.confirm("Wirklich alle Änderungen verwerfen und die kuratierte Startliste wiederherstellen?")) {
      return;
    }
    try {
      state.data = await resetToCuratedDefaults(state.mode);
      renderAll();
      els.syncDialog.close();
      showToast("Startliste wiederhergestellt.");
    } catch (err) {
      showToast(err.message || "Zurücksetzen fehlgeschlagen.");
    }
  });
}

async function init() {
  applyTheme(loadTheme());
  bindEvents();
  const { data, mode } = await loadInitialData();
  state.data = data;
  state.mode = mode;
  state.shortlist = pruneShortlist(loadShortlist(), data.items);
  renderAll();
}

init();
