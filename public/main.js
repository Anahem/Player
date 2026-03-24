'use strict';

// ── Copy SteamID ──────────────────────────────────────────────────────────────
const copyBtn = document.getElementById('copySteamId');
if (copyBtn) {
  copyBtn.addEventListener('click', () => {
    const id = copyBtn.dataset.steamid;
    navigator.clipboard.writeText(id).then(() => {
      const orig = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => { copyBtn.textContent = orig; }, 2000);
    });
  });
}

// ── Library filtering & sorting ───────────────────────────────────────────────
(function initLibrary() {
  const searchInput  = document.getElementById('librarySearch');
  const sortSelect   = document.getElementById('librarySort');
  const filterSelect = document.getElementById('libraryFilter');
  const gameGrid     = document.getElementById('gameGrid');
  const countEl      = document.getElementById('gameCount');
  const noResults    = document.getElementById('noResults');

  if (!searchInput || !gameGrid) return;

  // Collect all cards once — we reorder them in the DOM
  let allCards = Array.from(gameGrid.querySelectorAll('.game-card'));

  function applyFilters() {
    const search = searchInput.value.toLowerCase().trim();
    const sort   = sortSelect.value;
    const filter = filterSelect.value;

    let visible = allCards.filter(card => {
      const name     = card.dataset.name     || '';
      const playtime = parseInt(card.dataset.playtime, 10) || 0;

      if (search && !name.includes(search)) return false;
      if (filter === 'played'   && playtime === 0) return false;
      if (filter === 'unplayed' && playtime > 0)   return false;
      if (filter === 'barely'   && (playtime === 0 || playtime >= 60)) return false;
      return true;
    });

    visible.sort((a, b) => {
      const pa = parseInt(a.dataset.playtime, 10) || 0;
      const pb = parseInt(b.dataset.playtime, 10) || 0;
      const na = a.dataset.name || '';
      const nb = b.dataset.name || '';
      switch (sort) {
        case 'playtime_asc':  return pa - pb;
        case 'name_asc':      return na.localeCompare(nb);
        case 'name_desc':     return nb.localeCompare(na);
        default:              return pb - pa; // playtime_desc
      }
    });

    // Hide all, then append visible in sorted order
    allCards.forEach(c => { c.style.display = 'none'; });
    visible.forEach(c  => { c.style.display = ''; gameGrid.appendChild(c); });

    if (countEl)   countEl.textContent = `${visible.length}`;
    if (noResults) noResults.style.display = visible.length === 0 ? '' : 'none';
  }

  searchInput.addEventListener('input',   applyFilters);
  sortSelect.addEventListener('change',   applyFilters);
  filterSelect.addEventListener('change', applyFilters);
})();
