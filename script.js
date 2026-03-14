/**
 * Stakeholder Database — script.js
 *
 * Data source priority:
 *  1. Google Sheets (set SHEET_CSV_URL to your published CSV URL)
 *  2. Local data.json (fallback / demo)
 *
 * To connect Google Sheets:
 *  - Open your sheet → File → Share → Publish to web
 *  - Choose the sheet → CSV → Publish
 *  - Paste the resulting URL into SHEET_CSV_URL below
 */

// ─── Config ───────────────────────────────────────────────
const SHEET_CSV_URL = ''; // ← paste your Google Sheets CSV URL here
const FALLBACK_JSON = 'data.json';

// Column mapping for CSV (0-indexed), adjust if your sheet columns differ
const CSV_COLS = {
  name:        0,
  designation: 1,
  experience:  2,
  email:       3,
  phone:       4,
  linkedin:    5,
  category:    6,
  subcategory: 7,
};

// ─── State ────────────────────────────────────────────────
let allData     = [];
let filtered    = [];
let sortCol     = null;
let sortDir     = 'asc'; // 'asc' | 'desc'

// ─── DOM refs ─────────────────────────────────────────────
const searchInput   = document.getElementById('searchInput');
const catFilter     = document.getElementById('catFilter');
const subCatFilter  = document.getElementById('subCatFilter');
const resetBtn      = document.getElementById('resetBtn');
const tbody         = document.getElementById('tableBody');
const totalCount    = document.getElementById('totalCount');
const filteredCount = document.getElementById('filteredCount');
const dataSourceEl  = document.getElementById('dataSource');
const lastUpdatedEl = document.getElementById('lastUpdated');

// ─── Init ─────────────────────────────────────────────────
(async function init() {
  showLoading();
  allData = await loadData();
  populateFilters();
  applyFilters();
  updateSourceMeta();
})();

// ─── Data Loading ─────────────────────────────────────────
async function loadData() {
  if (SHEET_CSV_URL) {
    try {
      const rows = await fetchSheetCSV(SHEET_CSV_URL);
      if (rows.length > 0) {
        dataSourceEl.textContent = 'Google Sheets';
        return rows;
      }
    } catch (e) {
      console.warn('Google Sheets fetch failed, falling back to JSON:', e);
    }
  }

  try {
    const res = await fetch(FALLBACK_JSON);
    if (!res.ok) throw new Error('JSON not found');
    dataSourceEl.textContent = 'data.json (local)';
    return await res.json();
  } catch (e) {
    console.error('Could not load data:', e);
    showError();
    return [];
  }
}

async function fetchSheetCSV(url) {
  const res  = await fetch(url);
  const text = await res.text();
  const lines = text.trim().split('\n');
  // First row is header — skip it
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line);
    return {
      name:        (cols[CSV_COLS.name]        || '').trim(),
      designation: (cols[CSV_COLS.designation] || '').trim(),
      experience:  (cols[CSV_COLS.experience]  || '').trim(),
      email:       (cols[CSV_COLS.email]       || '').trim(),
      phone:       (cols[CSV_COLS.phone]       || '').trim(),
      linkedin:    (cols[CSV_COLS.linkedin]    || '').trim(),
      category:    (cols[CSV_COLS.category]    || '').trim(),
      subcategory: (cols[CSV_COLS.subcategory] || '').trim(),
    };
  }).filter(r => r.name);
}

function parseCSVLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// ─── Filters ──────────────────────────────────────────────
function populateFilters() {
  const cats    = [...new Set(allData.map(r => r.category).filter(Boolean))].sort();
  const subCats = [...new Set(allData.map(r => r.subcategory).filter(Boolean))].sort();

  cats.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    catFilter.appendChild(opt);
  });

  subCats.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    subCatFilter.appendChild(opt);
  });
}

function applyFilters() {
  const q   = searchInput.value.toLowerCase().trim();
  const cat = catFilter.value;
  const sub = subCatFilter.value;

  filtered = allData.filter(row => {
    const matchSearch = !q ||
      row.name.toLowerCase().includes(q)        ||
      row.designation.toLowerCase().includes(q) ||
      row.email.toLowerCase().includes(q)       ||
      row.category.toLowerCase().includes(q)    ||
      row.subcategory.toLowerCase().includes(q);

    const matchCat = !cat || row.category === cat;
    const matchSub = !sub || row.subcategory === sub;

    return matchSearch && matchCat && matchSub;
  });

  if (sortCol !== null) sortData();
  renderTable();
  updateStats();
}

// ─── Sorting ──────────────────────────────────────────────
const SORT_KEYS = ['name', 'designation', 'experience', 'email', 'phone'];

document.querySelectorAll('th[data-col]').forEach(th => {
  th.addEventListener('click', () => {
    const col = th.dataset.col;
    if (sortCol === col) {
      sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
    document.querySelectorAll('th[data-col]').forEach(h => {
      h.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    sortData();
    renderTable();
  });
});

function sortData() {
  const key = sortCol;
  filtered.sort((a, b) => {
    let va = (a[key] || '').toLowerCase();
    let vb = (b[key] || '').toLowerCase();
    // Sort experience numerically if possible
    if (key === 'experience') {
      va = parseInt(va) || 0;
      vb = parseInt(vb) || 0;
    }
    if (va < vb) return sortDir === 'asc' ? -1 :  1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

// ─── Render ───────────────────────────────────────────────
function renderTable() {
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <h3>No results found</h3>
            <p>Try adjusting your search or filter criteria.</p>
          </div>
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(row => {
    const initials = getInitials(row.name);
    const liHref   = row.linkedin && isValidURL(row.linkedin) ? row.linkedin : null;

    return `
      <tr>
        <td>
          <div class="cell-name">
            <div class="avatar">${initials}</div>
            <span class="name-text">${esc(row.name)}</span>
          </div>
        </td>
        <td class="cell-designation">${esc(row.designation)}</td>
        <td><span class="exp-badge">${esc(row.experience)}</span></td>
        <td class="cell-email">
          ${row.email ? `<a href="mailto:${esc(row.email)}">${esc(row.email)}</a>` : '—'}
        </td>
        <td class="cell-phone">${esc(row.phone) || '—'}</td>
        <td>
          ${liHref
            ? `<a class="linkedin-btn" href="${esc(liHref)}" target="_blank" rel="noopener noreferrer">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn
               </a>`
            : '<span style="color:var(--text-faint);font-size:12px;">—</span>'}
        </td>
      </tr>`;
  }).join('');
}

function showLoading() {
  tbody.innerHTML = `
    <tr>
      <td colspan="6">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading stakeholders…</p>
        </div>
      </td>
    </tr>`;
}

function showError() {
  tbody.innerHTML = `
    <tr>
      <td colspan="6">
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h3>Failed to load data</h3>
          <p>Check your data source configuration or provide a data.json file.</p>
        </div>
      </td>
    </tr>`;
}

// ─── Stats ────────────────────────────────────────────────
function updateStats() {
  totalCount.textContent    = allData.length;
  filteredCount.textContent = filtered.length;
}

function updateSourceMeta() {
  const now = new Date();
  lastUpdatedEl.textContent = now.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ─── Events ───────────────────────────────────────────────
searchInput.addEventListener('input', applyFilters);
catFilter.addEventListener('change', () => {
  // When category changes, re-populate subcategory to show only relevant subcats
  repopulateSubcat();
  applyFilters();
});
subCatFilter.addEventListener('change', applyFilters);

resetBtn.addEventListener('click', () => {
  searchInput.value = '';
  catFilter.value   = '';
  subCatFilter.value = '';
  sortCol = null;
  sortDir = 'asc';
  document.querySelectorAll('th[data-col]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
  repopulateSubcat(true);
  applyFilters();
  showToast('Filters cleared');
});

function repopulateSubcat(all = false) {
  const cat = catFilter.value;
  const current = subCatFilter.value;

  // Clear existing options beyond the first placeholder
  while (subCatFilter.options.length > 1) subCatFilter.remove(1);

  const source = (!cat || all) ? allData : allData.filter(r => r.category === cat);
  const subs = [...new Set(source.map(r => r.subcategory).filter(Boolean))].sort();

  subs.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    subCatFilter.appendChild(opt);
  });

  // Restore previous value if still available
  if (!all && [...subCatFilter.options].some(o => o.value === current)) {
    subCatFilter.value = current;
  }
}

// ─── Toast ────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ─── Helpers ──────────────────────────────────────────────
function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidURL(str) {
  try { new URL(str); return true; } catch { return false; }
}
