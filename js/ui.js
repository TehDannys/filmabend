// DOM-Rendering für Karten, Filter-Chips und Dialoge.

import {
  FIT_LEVELS,
  JOINT_VERDICTS,
  MOOD_OPTIONS,
  QUICK_FILTER_CHIPS,
  TYPE_LABELS,
  getVerdictMeta
} from "./logic.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateDe(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function renderQuickChips(container, activeMood) {
  container.innerHTML = QUICK_FILTER_CHIPS.map((chip) => {
    const active = chip.id === activeMood ? "is-active" : "";
    return `<button type="button" class="chip-btn ${active}" data-mood-chip="${escapeHtml(chip.id)}">${escapeHtml(chip.label)}</button>`;
  }).join("");
}

export function renderRecommenderOptions(selectEl, recommenders, activeValue) {
  const options = [
    `<option value="all">Alle Quellen</option>`,
    ...recommenders.map(
      (rec) => `<option value="${escapeHtml(rec)}" ${rec === activeValue ? "selected" : ""}>${escapeHtml(rec)}</option>`
    )
  ];
  selectEl.innerHTML = options.join("");
}

export function renderPosterMarkup(item) {
  const typeLabel = TYPE_LABELS[item.type] || "Film";
  const fallback = `
    <div class="poster-fallback">
      <span class="poster-fallback-type">${escapeHtml(typeLabel)}</span>
      <span class="poster-fallback-title">${escapeHtml(item.title)}</span>
    </div>
  `;

  if (item.posterUrl && item.posterUrl.trim()) {
    return `
      <div class="poster-wrap">
        <img
          class="poster-img"
          src="${escapeHtml(item.posterUrl)}"
          alt="Poster zu ${escapeHtml(item.title)}"
          loading="lazy"
          referrerpolicy="no-referrer"
          onerror="this.replaceWith(this.nextElementSibling.content.cloneNode(true))"
        >
        <template>${fallback}</template>
        <span class="type-pill">${escapeHtml(typeLabel)}</span>
      </div>
    `;
  }

  return `
    <div class="poster-wrap">
      ${fallback}
      <span class="type-pill">${escapeHtml(typeLabel)}</span>
    </div>
  `;
}

export function renderCard(item, { compactForModal = false, shortlistIds = [], inShortlistDialog = false } = {}) {
  const fit = FIT_LEVELS[item.fit] || FIT_LEVELS.medium;
  const fitClass = `badge-fit-${fit.id}`;
  const moods = Array.isArray(item.moodLabels) ? item.moodLabels : [];
  const verdict = item.watched ? getVerdictMeta(item.jointRating) : null;
  const isPinned = shortlistIds.includes(item.id);
  const trailerUrl =
    item.trailerUrl && item.trailerUrl.trim()
      ? item.trailerUrl.trim()
      : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} Trailer Deutsch`)}`;

  const showOriginal =
    item.originalTitle &&
    item.originalTitle.trim() &&
    item.originalTitle.trim().toLowerCase() !== item.title.trim().toLowerCase();

  const verdictBlock = item.watched
    ? `
      <div class="joint-verdict-box">
        <span class="joint-verdict-eyebrow">Unser gemeinsames Urteil</span>
        <div class="joint-verdict-main">
          ${verdict ? `${verdict.hearts} (${verdict.rating}/5) · ${escapeHtml(verdict.label)}` : "Gemeinsam gesehen"}
        </div>
        ${item.jointNote ? `<div class="joint-verdict-note">„${escapeHtml(item.jointNote)}“</div>` : ""}
        ${item.watchedAt ? `<div class="joint-verdict-note">Geschaut am ${escapeHtml(formatDateDe(item.watchedAt))}</div>` : ""}
      </div>
    `
    : "";

  const pinButtonHtml =
    !item.watched && !compactForModal
      ? inShortlistDialog
        ? `<button type="button" class="btn btn-ghost" data-action="pin" data-id="${escapeHtml(item.id)}" aria-pressed="true">✕ Entfernen</button>`
        : `<button type="button" class="btn btn-secondary btn-pin ${isPinned ? "is-pinned" : ""}" data-action="pin" data-id="${escapeHtml(item.id)}" aria-pressed="${isPinned ? "true" : "false"}">${isPinned ? "📌 Gemerkt" : "📌 Merken"}</button>`
      : "";

  const promoteButtonHtml =
    !item.watched && !compactForModal && !inShortlistDialog && item.sourceCategory === "external"
      ? `<button type="button" class="btn btn-secondary" data-action="promote" data-id="${escapeHtml(item.id)}" title="In unsere persönliche Offen-Liste übernehmen">+ Übernehmen</button>`
      : "";

  const actionsHtml = compactForModal
    ? ""
    : `
      <div class="card-actions">
        <a class="btn btn-trailer" href="${escapeHtml(trailerUrl)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(item.trailerNote || "Deutschen Trailer auf YouTube öffnen")}">
          ▶ Trailer (DE)
        </a>
        ${pinButtonHtml}
        ${promoteButtonHtml}
        ${
          item.watched
            ? `<button type="button" class="btn btn-secondary" data-action="rate" data-id="${escapeHtml(item.id)}">✎ Urteil</button>
               <button type="button" class="btn btn-ghost" data-action="unwatch" data-id="${escapeHtml(item.id)}" title="Zurück in Offen">↺ Offen</button>`
            : `<button type="button" class="btn btn-primary" data-action="rate" data-id="${escapeHtml(item.id)}">✓ Gesehen</button>`
        }
        ${
          inShortlistDialog
            ? ""
            : `<button type="button" class="icon-btn" data-action="edit" data-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(item.title)} bearbeiten" title="Bearbeiten / Entfernen">✎</button>`
        }
      </div>
    `;

  return `
    <article class="movie-card" data-id="${escapeHtml(item.id)}" data-fit="${escapeHtml(item.fit)}">
      <div class="movie-top">
        ${renderPosterMarkup(item)}
        <div class="movie-header-info">
          <h2 class="movie-title">${escapeHtml(item.title)}</h2>
          ${showOriginal ? `<div class="movie-original">${escapeHtml(item.originalTitle)}</div>` : ""}
          <div class="movie-meta-line">
            <span class="runtime-highlight">⏱ ${escapeHtml(item.runtimeLabel || "k. A.")}</span>
            ${item.year ? `<span>· ${escapeHtml(item.year)}</span>` : ""}
          </div>
          <div class="badge-row">
            <span class="badge ${fitClass}">${escapeHtml(fit.shortLabel)}</span>
            ${item.sourceCategory === "external" && !item.watched ? `<span class="badge badge-idea">✨ Idee</span>` : ""}
            ${item.freeSource ? `<span class="badge badge-free">${escapeHtml(item.freeSource)} · Frei</span>` : ""}
            ${moods.map((m) => `<span class="badge badge-mood">${escapeHtml(m)}</span>`).join("")}
          </div>
        </div>
      </div>

      <p class="movie-summary">${escapeHtml(item.summary || "Keine Beschreibung hinterlegt.")}</p>

      ${item.fitReason && item.fit !== "high" ? `<p class="fit-reason">${escapeHtml(item.fitReason)}</p>` : ""}

      <div class="source-line">
        <span>Empfohlen von: <strong>${escapeHtml(item.recommendedBy || "Selbst notiert")}</strong></span>
        ${item.recommendationNote ? `<span>· ${escapeHtml(item.recommendationNote)}</span>` : ""}
      </div>

      ${verdictBlock}
      ${actionsHtml}
    </article>
  `;
}

export function renderCardsGrid(container, items, tab, shortlistIds = []) {
  if (items.length === 0) {
    const message =
      tab === "watched"
        ? "Noch keine gemeinsamen Filme abgehakt. Sobald ihr einen geschaut habt, erscheint er hier mit eurem gemeinsamen Urteil."
        : tab === "ideas"
        ? "Keine externen oder KI-Ideen für diesen Filter."
        : tab === "avoid"
        ? "Keine unpassenden Titel im Filter."
        : "Keine Treffer für diesen Filter. Probiert einen anderen Stimmungs-Chip oder setzt die Filter zurück.";
    container.innerHTML = `
      <div class="empty-state">
        <h3>Hier ist gerade nichts</h3>
        <p>${escapeHtml(message)}</p>
      </div>
    `;
    return;
  }
  container.innerHTML = items.map((item) => renderCard(item, { shortlistIds })).join("");
}

export function renderQuickResultCards(container, items, shortlistIds = []) {
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>Kein Treffer</h3>
        <p>Für diese Kombination gibt es gerade nichts – probiert „Egal“ bei der Zeit oder „Überrascht mich“.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items
    .map((item) => {
      const fit = FIT_LEVELS[item.fit] || FIT_LEVELS.medium;
      const isPinned = shortlistIds.includes(item.id);
      const trailerUrl =
        item.trailerUrl && item.trailerUrl.trim()
          ? item.trailerUrl.trim()
          : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${item.title} Trailer Deutsch`)}`;
      return `
        <article class="quick-mini-card" data-id="${escapeHtml(item.id)}">
          ${renderPosterMarkup(item)}
          <div class="quick-mini-body">
            <h3 class="quick-mini-title">${escapeHtml(item.title)}</h3>
            <div class="movie-meta-line">
              <span class="runtime-highlight">⏱ ${escapeHtml(item.runtimeLabel || "k. A.")}</span>
              <span class="badge badge-fit-${fit.id}">${escapeHtml(fit.shortLabel)}</span>
              ${item.freeSource ? `<span class="badge badge-free">${escapeHtml(item.freeSource)} · Frei</span>` : ""}
            </div>
            <p class="quick-mini-summary">${escapeHtml(item.summary || "")}</p>
            <div class="quick-mini-actions">
              <a class="btn btn-trailer" href="${escapeHtml(trailerUrl)}" target="_blank" rel="noopener noreferrer">▶ Trailer (DE)</a>
              <button type="button" class="btn btn-secondary btn-pin ${isPinned ? "is-pinned" : ""}" data-quick-pin="${escapeHtml(item.id)}">${isPinned ? "📌 Gemerkt" : "📌 Merken"}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

export function renderMoodCheckboxes(container, selectedMoods = []) {
  const selectedSet = new Set(selectedMoods);
  container.innerHTML = MOOD_OPTIONS.map(
    (m) => `
      <label class="mood-check-pill">
        <input type="checkbox" name="moods" value="${escapeHtml(m.id)}" ${selectedSet.has(m.id) ? "checked" : ""}>
        <span>${escapeHtml(m.label)}</span>
      </label>
    `
  ).join("");
}

export function renderVerdictOptions(container, selectedRating = 4) {
  container.innerHTML = JOINT_VERDICTS.map((v) => {
    const checked = Number(selectedRating) === v.rating;
    return `
      <label class="verdict-option ${checked ? "is-selected" : ""}">
        <input type="radio" name="jointRating" value="${v.rating}" ${checked ? "checked" : ""}>
        <span class="verdict-hearts" aria-hidden="true">${v.hearts}</span>
        <span><strong>${v.rating}/5</strong> · ${escapeHtml(v.label)}</span>
      </label>
    `;
  }).join("");
}
