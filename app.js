// ====================================================================
// HR Årshjul — interactive year wheel builder
// ====================================================================

// Supabase project (anon publishable key — safe to ship, RLS enforces privacy)
const SUPABASE_URL = 'https://afcagjgztvmdpeljrjru.supabase.co';
const SUPABASE_KEY = 'sb_publishable__QjXJj6z2J2FaCyWvRVSWg_pbiIbHiI';
let sb = null;
let currentUser = null;

const STORAGE_KEY = 'hr-arshjul-v1';

const RING_PALETTE = [
  '#5B6B7A', // slate
  '#87A096', // sage
  '#B8624A', // terracotta
  '#C8A04A', // ockra
  '#6B8AA6', // dimblå
  '#7A5266', // plommon
  '#8B8B5C', // oliv
  '#A89F8E', // sten
];

const MONTHS_SV = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];

// ---------- State ----------
// Start with defaults; real wheel is fetched from Supabase after login.
let state = defaultState();

function defaultState() {
  return {
    client: '',
    year: new Date().getFullYear(),
    rings: [
      { id: rid(), name: 'Arbetsmiljö', color: RING_PALETTE[1] },
      { id: rid(), name: 'Utveckling', color: RING_PALETTE[0] },
      { id: rid(), name: 'Lön & förmåner', color: RING_PALETTE[2] },
    ],
    activities: [
      { id: rid(), name: 'Utvecklingssamtal', ringId: null, startWeek: 8, lengthWeeks: 4 },
      { id: rid(), name: 'Lönerevision', ringId: null, startWeek: 14, lengthWeeks: 3 },
      { id: rid(), name: 'Arbetsmiljörond', ringId: null, startWeek: 38, lengthWeeks: 2 },
      { id: rid(), name: 'Sommarfest', ringId: null, startWeek: 25, lengthWeeks: 1 },
      { id: rid(), name: 'Successionsplan', ringId: null, startWeek: 44, lengthWeeks: 6 },
    ],
  };
}
// link default activities to default rings
(function linkDefaults() {
  if (state.activities.length && state.activities[0].ringId === null) {
    state.activities[0].ringId = state.rings[1].id; // Utveckling
    state.activities[1].ringId = state.rings[2].id; // Lön
    state.activities[2].ringId = state.rings[0].id; // Arbetsmiljö
    state.activities[3].ringId = state.rings[0].id; // Arbetsmiljö
    state.activities[4].ringId = state.rings[1].id; // Utveckling
  }
})();

function rid() {
  return Math.random().toString(36).slice(2, 10);
}

// Wheel persistence — local-first, sync to Supabase when possible.
// Local save is instant and works offline; remote sync runs in background.
let saveTimer = null;
function saveState() {
  saveLocal();          // immediate, reliable
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveToSupabase, 800); // debounced remote sync
}

function localKey() {
  return STORAGE_KEY + ':' + (currentUser ? currentUser.id : 'anon');
}
function saveLocal() {
  try { localStorage.setItem(localKey(), JSON.stringify(state)); } catch {}
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(localKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.rings)) return parsed;
  } catch {}
  return null;
}

async function saveToSupabase() {
  if (!sb || !currentUser) return;
  // Fall back to native fetch with timeout — supabase-js was hanging silently for some setups.
  try {
    const sessRes = await sb.auth.getSession();
    const token = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token;
    if (!token) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(SUPABASE_URL + '/rest/v1/wheels?on_conflict=user_id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
        Authorization: 'Bearer ' + token,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({ user_id: currentUser.id, data: state }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) console.warn('Wheel save HTTP', res.status, await res.text().catch(() => ''));
  } catch (err) {
    console.warn('Wheel save failed (data finns kvar lokalt):', err.message || err);
  }
}

// ---------- Element refs ----------
const $ = (id) => document.getElementById(id);
const ringList = $('ringList');
const activityList = $('activityList');
const wheel = $('wheel');
const legend = $('legend');
const clientNameInput = $('clientName');
const clientYearInput = $('clientYear');

// ---------- Init ----------
clientNameInput.value = state.client || '';
clientYearInput.value = state.year || new Date().getFullYear();

clientNameInput.addEventListener('input', () => { state.client = clientNameInput.value; saveState(); renderWheel(); });
clientYearInput.addEventListener('input', () => { state.year = +clientYearInput.value || new Date().getFullYear(); saveState(); renderWheel(); });

$('addRingBtn').addEventListener('click', addRing);
$('addActivityBtn').addEventListener('click', addActivity);
$('importActivitiesBtn').addEventListener('click', () => $('activitiesFileInput').click());
$('activitiesFileInput').addEventListener('change', handleActivitiesImport);
$('downloadTemplateLink').addEventListener('click', e => {
  e.preventDefault();
  downloadActivitiesTemplate();
});
setupRingDragAndDrop();
$('newBtn').addEventListener('click', () => {
  if (!confirm('Börja om med ett tomt årshjul? Nuvarande hjul försvinner.')) return;
  state = defaultState();
  state.rings = [];
  state.activities = [];
  state.client = '';
  state.year = new Date().getFullYear();
  clientNameInput.value = '';
  clientYearInput.value = state.year;
  saveState(); renderAll();
});
$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', handleFileUpload);
setupExportDropdown();

// ---------- Render ----------
function renderAll() {
  renderRings();
  renderActivities();
  renderWheel();
  renderLegend();
}

function renderRings() {
  ringList.innerHTML = '';
  if (state.rings.length === 0) {
    ringList.innerHTML = `<li class="empty">Inga ringar än. Klicka "+ Lägg till ring" för att börja.</li>`;
    return;
  }
  state.rings.forEach((ring, i) => {
    const li = document.createElement('li');
    li.className = 'ring-item';
    li.draggable = true;
    li.dataset.ringId = ring.id;
    li.innerHTML = `
      <span class="ring-handle" title="Dra för att ändra ordning" aria-label="Dra för att ändra ordning">⋮⋮</span>
      <span class="ring-color" style="background:${ring.color}">
        <input type="color" value="${ring.color}" data-id="${ring.id}" class="ring-color-input" aria-label="Välj färg" />
      </span>
      <input class="ring-name" type="text" value="${escapeHtml(ring.name)}" data-id="${ring.id}" placeholder="Ringens namn" />
      <button class="btn-icon" data-id="${ring.id}" data-action="delete-ring" title="Ta bort">✕</button>
    `;
    ringList.appendChild(li);
  });

  ringList.querySelectorAll('.ring-color-input').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const ring = state.rings.find(r => r.id === id);
      if (ring) {
        ring.color = e.target.value;
        e.target.parentElement.style.background = e.target.value;
        saveState(); renderActivities(); renderWheel(); renderLegend();
      }
    });
  });
  ringList.querySelectorAll('.ring-name').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const ring = state.rings.find(r => r.id === id);
      if (ring) { ring.name = e.target.value; saveState(); renderActivitySelects(); renderLegend(); renderWheel(); }
    });
  });
  ringList.querySelectorAll('[data-action="delete-ring"]').forEach(el => {
    el.addEventListener('click', e => {
      const id = e.target.dataset.id;
      if (!confirm('Ta bort ringen och alla aktiviteter i den?')) return;
      state.rings = state.rings.filter(r => r.id !== id);
      state.activities = state.activities.filter(a => a.ringId !== id);
      saveState(); renderAll();
    });
  });
}

function renderActivities() {
  activityList.innerHTML = '';
  if (state.activities.length === 0) {
    activityList.innerHTML = `<li class="empty">Inga aktiviteter än. Klicka "+ Lägg till aktivitet".</li>`;
    return;
  }
  if (state.rings.length === 0) {
    activityList.innerHTML = `<li class="empty">Lägg till en ring först — aktiviteter tillhör en ring.</li>`;
    return;
  }
  state.activities.forEach(act => {
    const li = document.createElement('li');
    li.className = 'activity-item';
    const monthLabel = weekToMonthLabel(act.startWeek);
    li.innerHTML = `
      <div class="activity-row">
        <input class="activity-name" type="text" value="${escapeHtml(act.name)}" data-id="${act.id}" data-field="name" placeholder="Aktivitetens namn" />
        <button class="btn-icon" data-id="${act.id}" data-action="delete-activity" title="Ta bort">✕</button>
      </div>
      <div class="activity-meta">
        <div class="mini-field">
          <label>Ring</label>
          <select data-id="${act.id}" data-field="ringId">
            ${state.rings.map(r => `<option value="${r.id}" ${r.id === act.ringId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}
          </select>
        </div>
        <div class="mini-field">
          <label>Startvecka</label>
          <input type="number" min="1" max="52" value="${act.startWeek}" data-id="${act.id}" data-field="startWeek" />
        </div>
        <div class="mini-field">
          <label>Längd v.</label>
          <input type="number" min="1" max="52" value="${act.lengthWeeks}" data-id="${act.id}" data-field="lengthWeeks" />
        </div>
      </div>
      <div style="font-size:11px; color:var(--ink-faint); margin-top:2px;">≈ ${monthLabel}</div>
    `;
    activityList.appendChild(li);
  });

  activityList.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', e => {
      const id = e.target.dataset.id;
      const field = e.target.dataset.field;
      const act = state.activities.find(a => a.id === id);
      if (!act) return;
      let val = e.target.value;
      if (field === 'startWeek' || field === 'lengthWeeks') {
        val = Math.max(1, Math.min(52, +val || 1));
      }
      act[field] = val;
      saveState();
      renderWheel();
      // update inline month label
      if (field === 'startWeek') {
        const labelEl = e.target.closest('.activity-item').querySelector('div[style]');
        if (labelEl) labelEl.textContent = '≈ ' + weekToMonthLabel(act.startWeek);
      }
    });
  });
  activityList.querySelectorAll('[data-action="delete-activity"]').forEach(el => {
    el.addEventListener('click', e => {
      const id = e.target.dataset.id;
      state.activities = state.activities.filter(a => a.id !== id);
      saveState(); renderAll();
    });
  });
}

function renderActivitySelects() {
  // refresh dropdowns when ring names change
  activityList.querySelectorAll('select[data-field="ringId"]').forEach(sel => {
    const id = sel.dataset.id;
    const act = state.activities.find(a => a.id === id);
    sel.innerHTML = state.rings.map(r => `<option value="${r.id}" ${r.id === act.ringId ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('');
  });
}

function renderLegend() {
  legend.innerHTML = '';
  state.rings.forEach(r => {
    const span = document.createElement('span');
    span.className = 'legend-item';
    span.innerHTML = `<span class="legend-swatch" style="background:${r.color}"></span>${escapeHtml(r.name)}`;
    legend.appendChild(span);
  });
}

// ---------- Wheel rendering (SVG) ----------
function renderWheel() {
  while (wheel.firstChild) wheel.removeChild(wheel.firstChild);

  const innerR = 60;
  const outerR = 220;
  const monthLabelR = 245;

  // No rings — show empty message
  if (state.rings.length === 0) {
    appendSvg('text', {
      x: 0, y: 0,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'wheel-month-label',
    }, 'Lägg till en ring för att börja');
    return;
  }

  const ringCount = state.rings.length;
  const ringThickness = (outerR - innerR) / ringCount;

  // Convention: list index 0 = top of list = OUTERMOST ring on the wheel.
  // Convert a list index to a position-from-center.
  const posFromCenter = (listIdx) => ringCount - 1 - listIdx;

  // Background bands per ring
  state.rings.forEach((ring, i) => {
    const pos = posFromCenter(i);
    const r1 = innerR + pos * ringThickness;
    const r2 = r1 + ringThickness;
    appendSvg('path', {
      d: ringBandPath(r1, r2),
      fill: lightenColor(ring.color, 0.92),
      stroke: '#E5E0D7',
      'stroke-width': 0.5,
    });
  });

  // Activity arcs
  state.activities.forEach(act => {
    const ringIdx = state.rings.findIndex(r => r.id === act.ringId);
    if (ringIdx === -1) return;
    const ring = state.rings[ringIdx];
    const pos = posFromCenter(ringIdx);
    const r1 = innerR + pos * ringThickness;
    const r2 = r1 + ringThickness;

    const startAngle = weekToAngle(act.startWeek);
    const endAngle = weekToAngle(act.startWeek + act.lengthWeeks);

    const path = arcPath(r1, r2, startAngle, endAngle);
    appendSvg('path', {
      d: path,
      fill: ring.color,
      class: 'wheel-arc',
      stroke: '#fff',
      'stroke-width': 1,
    });

    // Radial text (reads from inner edge outward, centered in the arc)
    appendRadialText(act.name, r1, r2, startAngle, endAngle, act.lengthWeeks);
  });

  // Month dividers (lines at each month boundary)
  for (let m = 0; m < 12; m++) {
    const angle = (m / 12) * Math.PI * 2 - Math.PI / 2;
    const x1 = innerR * Math.cos(angle);
    const y1 = innerR * Math.sin(angle);
    const x2 = outerR * Math.cos(angle);
    const y2 = outerR * Math.sin(angle);
    appendSvg('line', {
      x1, y1, x2, y2,
      stroke: 'rgba(255,255,255,0.7)',
      'stroke-width': 0.8,
    });
  }

  // Month labels
  for (let m = 0; m < 12; m++) {
    const midAngle = ((m + 0.5) / 12) * Math.PI * 2 - Math.PI / 2;
    const x = monthLabelR * Math.cos(midAngle);
    const y = monthLabelR * Math.sin(midAngle);
    appendSvg('text', {
      x, y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      class: 'wheel-month-label',
    }, MONTHS_SV[m]);
  }

  // Center circle + client name (no year)
  appendSvg('circle', { cx: 0, cy: 0, r: innerR - 4, fill: '#fff', stroke: '#E5E0D7', 'stroke-width': 1 });
  const title = (state.client || 'Årshjul').trim();
  const lines = splitTitleOnWords(title, 12);
  const fontSize = lines.length === 1 ? 18 : 15;

  if (lines.length === 1) {
    appendSvg('text', {
      x: 0, y: 0,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'wheel-center-label',
      'font-size': fontSize,
    }, lines[0]);
  } else {
    // Center two lines vertically around y=0
    appendSvg('text', {
      x: 0, y: -fontSize * 0.6,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'wheel-center-label',
      'font-size': fontSize,
    }, lines[0]);
    appendSvg('text', {
      x: 0, y: fontSize * 0.6,
      'text-anchor': 'middle',
      'dominant-baseline': 'central',
      class: 'wheel-center-label',
      'font-size': fontSize,
    }, lines[1]);
  }
}

function splitTitleOnWords(title, maxCharsPerLine) {
  if (!title) return [''];
  if (title.length <= maxCharsPerLine) return [title];
  const words = title.split(/\s+/).filter(Boolean);
  if (words.length === 1) return [title]; // single long word — can't break
  let line1 = '';
  let i = 0;
  while (i < words.length) {
    const candidate = line1 ? line1 + ' ' + words[i] : words[i];
    if (candidate.length > maxCharsPerLine && line1) break;
    line1 = candidate;
    i++;
  }
  const line2 = words.slice(i).join(' ');
  return line2 ? [line1, line2] : [line1];
}

function appendSvg(tag, attrs, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (text != null) el.textContent = text;
  wheel.appendChild(el);
  return el;
}

function weekToAngle(week) {
  // Week 1 starts at top (12 o'clock = -90° = -π/2)
  return ((week - 1) / 52) * Math.PI * 2 - Math.PI / 2;
}

function arcPath(r1, r2, a1, a2) {
  const largeArc = (a2 - a1) > Math.PI ? 1 : 0;
  const x1o = r2 * Math.cos(a1), y1o = r2 * Math.sin(a1);
  const x2o = r2 * Math.cos(a2), y2o = r2 * Math.sin(a2);
  const x1i = r1 * Math.cos(a2), y1i = r1 * Math.sin(a2);
  const x2i = r1 * Math.cos(a1), y2i = r1 * Math.sin(a1);
  return [
    `M ${x1o} ${y1o}`,
    `A ${r2} ${r2} 0 ${largeArc} 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${r1} ${r1} 0 ${largeArc} 0 ${x2i} ${y2i}`,
    'Z'
  ].join(' ');
}

function ringBandPath(r1, r2) {
  // full ring band
  return [
    `M ${r2} 0`,
    `A ${r2} ${r2} 0 1 1 ${-r2} 0`,
    `A ${r2} ${r2} 0 1 1 ${r2} 0`,
    `M ${r1} 0`,
    `A ${r1} ${r1} 0 1 0 ${-r1} 0`,
    `A ${r1} ${r1} 0 1 0 ${r1} 0`,
    'Z',
  ].join(' ');
}

function appendRadialText(text, innerR, outerR, startAngle, endAngle, lengthWeeks) {
  // Text reads radially: from inner edge of the ring outward, centered in the arc.
  // This gives long activity names room even when the arc is narrow.
  const fontSize = 10;
  const charWidth = 5.6; // empirical width per char at 10px Inter
  const padding = 6;     // space at each end of the band
  const lineHeight = fontSize + 2;

  const radialLength = outerR - innerR - padding * 2;
  const arcThickness = (endAngle - startAngle) * (innerR + outerR) / 2;

  if (arcThickness < fontSize + 2) return;
  const maxChars = Math.max(0, Math.floor(radialLength / charWidth));
  if (maxChars < 3) return;

  // Wrap onto multiple radial lines only if the activity is wider than 2 weeks
  // AND the arc has room for an extra line. Otherwise fall back to ellipsis.
  const allowWrap = lengthWeeks > 2;
  const maxLinesByArc = Math.max(1, Math.floor(arcThickness / lineHeight));
  const maxLines = allowWrap ? Math.min(maxLinesByArc, 3) : 1;

  const lines = wrapRadialLabel(text, maxChars, maxLines);

  const midAngle = (startAngle + endAngle) / 2;
  const midR = (innerR + outerR) / 2;
  const cx = midR * Math.cos(midAngle);
  const cy = midR * Math.sin(midAngle);
  const rotation = midAngle * 180 / Math.PI;

  // Lines stack tangentially (perpendicular to the radial text direction)
  const perpX = -Math.sin(midAngle);
  const perpY =  Math.cos(midAngle);

  lines.forEach((line, i) => {
    const offset = (i - (lines.length - 1) / 2) * lineHeight;
    const x = cx + offset * perpX;
    const y = cy + offset * perpY;
    appendSvg('text', {
      x, y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      transform: `rotate(${rotation} ${x} ${y})`,
      class: 'wheel-arc-label',
      'font-size': fontSize,
    }, line);
  });
}

function wrapRadialLabel(text, maxChars, maxLines) {
  if (maxLines <= 1 || text.length <= maxChars) {
    if (text.length <= maxChars) return [text];
    return [text.slice(0, Math.max(1, maxChars - 1)) + '…'];
  }

  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  let consumed = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const candidate = current ? current + ' ' + word : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      consumed = i + 1;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length === maxLines) { current = ''; break; }
      }
      // Word is longer than the line on its own — truncate it.
      if (word.length > maxChars) {
        current = word.slice(0, maxChars);
        consumed = i + 1;
      } else {
        current = word;
        consumed = i + 1;
      }
    }
  }
  if (current && lines.length < maxLines) lines.push(current);

  // If not all words fit, ellipsize the last line
  if (consumed < words.length) {
    const last = lines[lines.length - 1] || '';
    const trimmed = last.length >= maxChars
      ? last.slice(0, Math.max(1, maxChars - 1)) + '…'
      : last + '…';
    lines[lines.length - 1] = trimmed;
  }

  return lines;
}

// ---------- Helpers ----------
function lightenColor(hex, amount) {
  // amount 0-1 (1 = white)
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lr = Math.round(r + (255 - r) * amount);
  const lg = Math.round(g + (255 - g) * amount);
  const lb = Math.round(b + (255 - b) * amount);
  return `rgb(${lr}, ${lg}, ${lb})`;
}

function weekToMonthLabel(week) {
  const dayInYear = (week - 1) * 7 + 1;
  const monthIdx = Math.min(11, Math.floor((week - 1) / 4.333));
  return MONTHS_SV[monthIdx] + ' (v.' + week + ')';
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 1800);
}

// ---------- Import activities from XLSX/CSV ----------
const COL_ALIASES = {
  name:   ['aktivitet', 'aktiviteter', 'namn', 'activity', 'name', 'title'],
  ring:   ['ring', 'kategori', 'category', 'tema', 'grupp'],
  start:  ['startvecka', 'vecka', 'start', 'startweek', 'week'],
  length: ['längd', 'langd', 'veckor', 'length', 'duration', 'weeks', 'längd (veckor)'],
};

function findColumn(headers, aliases) {
  for (let i = 0; i < headers.length; i++) {
    const h = String(headers[i] || '').toLowerCase().trim();
    if (aliases.some(a => h === a || h.startsWith(a))) return i;
  }
  return -1;
}

async function handleActivitiesImport(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (typeof XLSX === 'undefined') {
    toast('Importbiblioteket laddar — försök igen om en stund');
    return;
  }
  try {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) { toast('Filen verkar tom'); return; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    if (rows.length < 2) { toast('Hittade inga rader att importera'); return; }

    const headers = rows[0].map(h => String(h || '').toLowerCase().trim());
    const nameCol  = findColumn(headers, COL_ALIASES.name);
    const ringCol  = findColumn(headers, COL_ALIASES.ring);
    const startCol = findColumn(headers, COL_ALIASES.start);
    const lenCol   = findColumn(headers, COL_ALIASES.length);

    if (nameCol === -1 || startCol === -1) {
      toast('Filen saknar kolumn för Aktivitet eller Startvecka');
      return;
    }

    const newRings = [];
    const newActivities = [];
    let skipped = 0;

    const usedColors = () => [...state.rings, ...newRings].map(r => r.color);
    const nextColor = () => RING_PALETTE.find(c => !usedColors().includes(c))
      || RING_PALETTE[(state.rings.length + newRings.length) % RING_PALETTE.length];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row[nameCol] != null ? row[nameCol] : '').trim();
      const ringName = ringCol >= 0 ? String(row[ringCol] != null ? row[ringCol] : '').trim() : '';
      const startWeekRaw = row[startCol];
      const lengthRaw = lenCol >= 0 ? row[lenCol] : 1;

      const startWeek = parseInt(startWeekRaw, 10);
      const lengthWeeks = Math.max(1, parseInt(lengthRaw, 10) || 1);

      if (!name || isNaN(startWeek) || startWeek < 1 || startWeek > 52) { skipped++; continue; }

      // Resolve ring: existing → previously created in this import → new
      let ring = null;
      if (ringName) {
        const lc = ringName.toLowerCase();
        ring = state.rings.find(r => r.name.toLowerCase() === lc)
            || newRings.find(r => r.name.toLowerCase() === lc);
        if (!ring) {
          ring = { id: rid(), name: ringName, color: nextColor() };
          newRings.push(ring);
        }
      } else if (state.rings.length) {
        ring = state.rings[0];
      } else if (newRings.length) {
        ring = newRings[0];
      } else {
        // No ring at all — create a default
        ring = { id: rid(), name: 'Allmänt', color: nextColor() };
        newRings.push(ring);
      }

      newActivities.push({
        id: rid(),
        name,
        ringId: ring.id,
        startWeek: Math.min(52, Math.max(1, startWeek)),
        lengthWeeks: Math.min(52, lengthWeeks),
      });
    }

    if (newActivities.length === 0) {
      toast('Inga giltiga rader hittades — kontrollera mallen');
      return;
    }

    // Prepend so newest are on top, but preserve file order within the import
    state.rings = [...newRings, ...state.rings];
    state.activities = [...newActivities, ...state.activities];
    saveState();
    renderAll();

    let msg = `${newActivities.length} aktiviteter importerade`;
    if (newRings.length) msg += ` · ${newRings.length} nya ringar`;
    if (skipped) msg += ` · ${skipped} hoppades över`;
    toast(msg);
  } catch (err) {
    console.error(err);
    toast('Kunde inte läsa filen — är det en xlsx eller csv?');
  }
}

function downloadActivitiesTemplate() {
  if (typeof XLSX === 'undefined') {
    toast('Mall-biblioteket laddar — försök igen om en stund');
    return;
  }
  const data = [
    ['Aktivitet', 'Ring', 'Startvecka', 'Längd (veckor)'],
    ['Lönesamtal', 'Lön & förmåner', 14, 3],
    ['Utvecklingssamtal', 'Utveckling', 8, 4],
    ['Sommarfest', 'Arbetsmiljö', 25, 1],
    ['Kompetensutveckling Q3', 'Kompetensutveckling', 36, 6],
    ['Successionsplan', 'Utveckling', 44, 6],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 28 }, { wch: 22 }, { wch: 12 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Aktiviteter');
  XLSX.writeFile(wb, 'arshjul-mall.xlsx');
  toast('Mall nedladdad');
}

// ---------- Drag-and-drop reorder of rings ----------
let draggedRingId = null;

function setupRingDragAndDrop() {
  ringList.addEventListener('dragstart', e => {
    const item = e.target.closest('.ring-item');
    if (!item) return;
    draggedRingId = item.dataset.ringId;
    item.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    // Firefox needs some data set to start a drag
    try { e.dataTransfer.setData('text/plain', draggedRingId); } catch {}
  });

  ringList.addEventListener('dragover', e => {
    if (!draggedRingId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.ring-item');
    clearDropMarkers();
    if (!item || item.dataset.ringId === draggedRingId) return;
    const rect = item.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    item.classList.add(after ? 'drop-after' : 'drop-before');
  });

  ringList.addEventListener('drop', e => {
    if (!draggedRingId) return;
    e.preventDefault();
    const item = e.target.closest('.ring-item');
    clearDropMarkers();
    if (!item || item.dataset.ringId === draggedRingId) {
      draggedRingId = null;
      return;
    }
    const targetId = item.dataset.ringId;
    const rect = item.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;

    const draggedIdx = state.rings.findIndex(r => r.id === draggedRingId);
    if (draggedIdx === -1) { draggedRingId = null; return; }
    const [moved] = state.rings.splice(draggedIdx, 1);

    let targetIdx = state.rings.findIndex(r => r.id === targetId);
    if (after) targetIdx += 1;
    state.rings.splice(targetIdx, 0, moved);

    draggedRingId = null;
    saveState();
    renderAll();
  });

  ringList.addEventListener('dragend', () => {
    clearDropMarkers();
    ringList.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));
    draggedRingId = null;
  });

  function clearDropMarkers() {
    ringList.querySelectorAll('.drop-before, .drop-after').forEach(el => {
      el.classList.remove('drop-before', 'drop-after');
    });
  }
}

// ---------- Add handlers ----------
function addRing() {
  const usedColors = state.rings.map(r => r.color);
  const color = RING_PALETTE.find(c => !usedColors.includes(c)) || RING_PALETTE[state.rings.length % RING_PALETTE.length];
  state.rings.unshift({ id: rid(), name: 'Ny ring', color });
  saveState(); renderAll();
  // focus the new (top) name input
  setTimeout(() => {
    const first = ringList.querySelector('.ring-name');
    if (first) { first.focus(); first.select(); }
  }, 0);
}

function addActivity() {
  if (state.rings.length === 0) {
    alert('Lägg till en ring först — aktiviteter tillhör en ring.');
    return;
  }
  state.activities.unshift({
    id: rid(),
    name: 'Ny aktivitet',
    ringId: state.rings[0].id,
    startWeek: 1,
    lengthWeeks: 2,
  });
  saveState(); renderAll();
  setTimeout(() => {
    const first = activityList.querySelector('.activity-name');
    if (first) { first.focus(); first.select(); }
  }, 0);
}

// ---------- Export — shared PNG builder + PNG/PDF/PPT outputs ----------
const PNG_KEYWORD = 'arshjul-state';

function setupExportDropdown() {
  const btn = $('exportBtn');
  const menu = $('exportMenu');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', e => {
    if (!menu.contains(e.target) && e.target !== btn) menu.hidden = true;
  });
  menu.addEventListener('click', async e => {
    const fmt = e.target.dataset && e.target.dataset.format;
    if (!fmt) return;
    menu.hidden = true;
    if (fmt === 'png') await exportWheelPNG();
    else if (fmt === 'pdf') await exportWheelPDF();
    else if (fmt === 'ppt') await exportWheelPPT();
  });
}

// Build the wheel as a PNG blob with embedded project state.
async function buildWheelPngBlob() {
  return new Promise((resolve, reject) => {
    const svgClone = wheel.cloneNode(true);
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('x', '-260');
    bg.setAttribute('y', '-260');
    bg.setAttribute('width', '520');
    bg.setAttribute('height', '520');
    bg.setAttribute('fill', '#FFFFFF');
    svgClone.insertBefore(bg, svgClone.firstChild);

    const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleEl.textContent = `
      .wheel-month-label { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.08em; fill: #5C6577; text-transform: uppercase; }
      .wheel-center-label { font-family: 'Fraunces', Georgia, serif; font-weight: 500; fill: #1A2332; }
      .wheel-arc-label { font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 9.5px; font-weight: 500; fill: #ffffff; }
    `;
    svgClone.insertBefore(styleEl, svgClone.firstChild);

    const svgString = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const size = 2400;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);

      canvas.toBlob(async (pngBlob) => {
        if (!pngBlob) { reject(new Error('canvas.toBlob returned null')); return; }
        try {
          const arrayBuf = await pngBlob.arrayBuffer();
          const stateJson = JSON.stringify(state);
          const stateB64 = btoa(unescape(encodeURIComponent(stateJson)));
          const pngBytes = injectTextChunk(new Uint8Array(arrayBuf), PNG_KEYWORD, stateB64);
          resolve(new Blob([pngBytes], { type: 'image/png' }));
        } catch (e) { reject(e); }
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to render SVG to image'));
    };
    img.src = url;
  });
}

async function exportWheelPNG() {
  try {
    const blob = await buildWheelPngBlob();
    downloadBlob(blob, `arshjul-${safeClientName()}-${state.year}.png`);
    toast('Bilden är nedladdad');
  } catch (e) {
    console.error(e);
    toast('Kunde inte spara bilden');
  }
}

async function exportWheelPDF() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    toast('PDF-biblioteket laddar fortfarande — försök igen om en stund');
    return;
  }
  try {
    const blob = await buildWheelPngBlob();
    const dataUrl = await blobToDataUrl(blob);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = 297, pageH = 210;

    // Title
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(20);
    doc.setTextColor(26, 35, 50);
    const title = (state.client || 'Årshjul').trim();
    doc.text(`${title}  ·  ${state.year}`, pageW / 2, 18, { align: 'center' });

    // Wheel (square, centered)
    const imgSize = 165;
    doc.addImage(dataUrl, 'PNG', (pageW - imgSize) / 2, 26, imgSize, imgSize);

    // Legend at the bottom — wraps if needed
    drawPdfLegend(doc, pageW, pageH);

    doc.save(`arshjul-${safeClientName()}-${state.year}.pdf`);
    toast('PDF nedladdad');
  } catch (e) {
    console.error(e);
    toast('Kunde inte skapa PDF');
  }
}

function drawPdfLegend(doc, pageW, pageH) {
  if (!state.rings.length) return;
  doc.setFontSize(10);
  doc.setTextColor(60, 70, 90);
  const margin = 18;
  const swatch = 3.6;
  const gap = 3;
  const itemGap = 8;
  const rowHeight = 6.5;
  let y = pageH - 12;
  let x = margin;
  state.rings.forEach(ring => {
    const label = ring.name || 'Ring';
    const labelW = doc.getTextWidth(label);
    const itemW = swatch + gap + labelW + itemGap;
    if (x + itemW > pageW - margin) {
      x = margin;
      y -= rowHeight;
    }
    const rgb = hexToRgb(ring.color);
    doc.setFillColor(rgb.r, rgb.g, rgb.b);
    doc.rect(x, y - swatch + 0.4, swatch, swatch, 'F');
    doc.setTextColor(40, 45, 60);
    doc.text(label, x + swatch + gap, y);
    x += itemW;
  });
}

async function exportWheelPPT() {
  if (typeof PptxGenJS === 'undefined') {
    toast('PowerPoint-biblioteket laddar fortfarande — försök igen om en stund');
    return;
  }
  try {
    const blob = await buildWheelPngBlob();
    const dataUrl = await blobToDataUrl(blob);
    const pres = new PptxGenJS();
    pres.layout = 'LAYOUT_WIDE'; // 13.333" x 7.5"
    const slideW = 13.333, slideH = 7.5;
    const slide = pres.addSlide();
    slide.background = { color: 'FFFFFF' };

    // Title
    slide.addText(`${(state.client || 'Årshjul').trim()}  ·  ${state.year}`, {
      x: 0.5, y: 0.3, w: slideW - 1, h: 0.6,
      fontSize: 24, fontFace: 'Calibri', color: '1A2332',
      align: 'center', valign: 'middle', bold: false,
    });

    // Wheel image (centered, square)
    const imgSize = 5.8;
    slide.addImage({
      data: dataUrl,
      x: (slideW - imgSize) / 2, y: 1.0,
      w: imgSize, h: imgSize,
    });

    // Legend row at bottom
    addPptLegend(slide, slideW, slideH);

    await pres.writeFile({ fileName: `arshjul-${safeClientName()}-${state.year}.pptx` });
    toast('PowerPoint nedladdad');
  } catch (e) {
    console.error(e);
    toast('Kunde inte skapa PowerPoint');
  }
}

function addPptLegend(slide, slideW, slideH) {
  if (!state.rings.length) return;
  const swatch = 0.16;
  const gap = 0.12;
  const itemGap = 0.4;
  const fontSize = 11;
  const charWidthApprox = 0.075;
  const margin = 0.5;
  const rowHeight = 0.32;
  let y = slideH - 0.6;
  let x = margin;
  state.rings.forEach(ring => {
    const label = ring.name || 'Ring';
    const textW = label.length * charWidthApprox;
    const itemW = swatch + gap + textW + itemGap;
    if (x + itemW > slideW - margin) { x = margin; y += rowHeight; }
    slide.addShape('rect', {
      x, y: y - swatch / 2, w: swatch, h: swatch,
      fill: { color: ring.color.replace('#', '') },
      line: { color: ring.color.replace('#', ''), width: 0 },
    });
    slide.addText(label, {
      x: x + swatch + gap, y: y - rowHeight / 2,
      w: textW + 0.2, h: rowHeight,
      fontSize, fontFace: 'Calibri', color: '1A2332',
      valign: 'middle',
    });
    x += itemW;
  });
}

// ---------- Small helpers for export ----------
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
function safeClientName() {
  return (state.client || 'kund').trim().replace(/[^a-zA-ZåäöÅÄÖ0-9_-]/g, '_') || 'kund';
}
function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

// ====================================================================
// Authentication — magic link via Supabase, one wheel per user
// ====================================================================
async function initAuth() {
  // Fallback: if neither screen is visible after 1.5s, force the login screen.
  // (Catches any edge case where init silently throws somewhere.)
  setTimeout(() => {
    const a = $('authScreen'), b = $('appScreen');
    if (a && b && a.hidden && b.hidden) {
      console.warn('Both screens hidden — forcing login screen visible');
      a.hidden = false;
    }
  }, 1500);

  if (typeof supabase === 'undefined') {
    showAuthMessage('Inloggningstjänsten kunde inte laddas. Kontrollera nätet och ladda om sidan.', true);
    showLoginScreen();
    return;
  }
  sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  setupAuthHandlers();

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      isPasswordRecovery = true;
      showLoginScreen();
      setAuthMode('newpw');
      return;
    }
    // While the user is in the middle of setting a new password,
    // don't auto-route them into the app even though Supabase has a session.
    if (isPasswordRecovery) return;
    if (session && session.user) await onSignedIn(session.user);
    else onSignedOut();
  });

  const { data } = await sb.auth.getSession();
  if (isPasswordRecovery) return; // PASSWORD_RECOVERY already routed us to the new-password screen
  if (data.session && data.session.user) {
    await onSignedIn(data.session.user);
  } else {
    onSignedOut();
  }
}

// 'signin' | 'signup' | 'reset' | 'newpw'
let authMode = 'signin';
let isPasswordRecovery = false;

function setAuthMode(mode) {
  authMode = mode;
  const emailEl = $('authEmail');
  const pwEl = $('authPassword');

  // Default visibility — adjusted per mode below
  emailEl.hidden = false;
  emailEl.disabled = false;
  pwEl.hidden = false;
  pwEl.disabled = false;
  $('authForgotRow').hidden = true;
  $('authToggleRow').hidden = true;
  $('authBackRow').hidden = true;

  if (mode === 'signin') {
    $('authTitle').textContent = 'Logga in';
    $('authSub').textContent = 'Logga in med din e-post och ditt lösenord.';
    $('authSubmitBtn').textContent = 'Logga in';
    pwEl.setAttribute('autocomplete', 'current-password');
    pwEl.placeholder = 'Lösenord (minst 6 tecken)';
    $('authToggleText').textContent = 'Inget konto än?';
    $('authToggleLink').textContent = 'Skapa konto';
    $('authForgotRow').hidden = false;
    $('authToggleRow').hidden = false;
  } else if (mode === 'signup') {
    $('authTitle').textContent = 'Skapa konto';
    $('authSub').textContent = 'Välj ett lösenord (minst 6 tecken). Du behåller samma e-post och lösenord för att logga in nästa gång.';
    $('authSubmitBtn').textContent = 'Skapa konto';
    pwEl.setAttribute('autocomplete', 'new-password');
    pwEl.placeholder = 'Lösenord (minst 6 tecken)';
    $('authToggleText').textContent = 'Har du redan ett konto?';
    $('authToggleLink').textContent = 'Logga in';
    $('authToggleRow').hidden = false;
  } else if (mode === 'reset') {
    $('authTitle').textContent = 'Glömt lösenord';
    $('authSub').textContent = 'Skriv in din e-postadress så skickar vi en länk för att välja ett nytt lösenord.';
    $('authSubmitBtn').textContent = 'Skicka återställningslänk';
    pwEl.hidden = true;
    pwEl.disabled = true;
    $('authBackRow').hidden = false;
  } else if (mode === 'newpw') {
    $('authTitle').textContent = 'Välj nytt lösenord';
    $('authSub').textContent = 'Skriv in det nya lösenordet (minst 6 tecken). Du loggas in automatiskt när det är sparat.';
    $('authSubmitBtn').textContent = 'Spara nytt lösenord';
    emailEl.hidden = true;
    emailEl.disabled = true;
    pwEl.setAttribute('autocomplete', 'new-password');
    pwEl.placeholder = 'Nytt lösenord (minst 6 tecken)';
    pwEl.value = '';
  }
  showAuthMessage('', false);
}

function translateAuthError(message) {
  const m = String(message || '').toLowerCase();
  if (m.includes('inte inbjuden') || m.includes('inbjudna')) {
    return 'Den här e-postadressen har inte tillgång till verktyget. Be administratören att lägga till dig.';
  }
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Fel e-post eller lösenord.';
  if (m.includes('email not confirmed')) return 'Du måste bekräfta din e-post först. Kolla inkorgen (och skräpposten).';
  if (m.includes('user already registered') || m.includes('already exists')) return 'Det här kontot finns redan. Tryck på "Logga in" istället.';
  if (m.includes('password should be at least')) return 'Lösenordet är för kort — minst 6 tecken.';
  if (m.includes('rate limit')) return 'För många försök. Vänta en stund och försök igen.';
  if (m.includes('weak password')) return 'Lösenordet är för svagt — välj ett längre eller mer komplext.';
  if (m.includes('database error') && m.includes('saving')) {
    // The signup trigger raises an exception that surfaces as a generic db error
    return 'Den här e-postadressen har inte tillgång till verktyget. Be administratören att lägga till dig.';
  }
  return message || 'Något gick fel. Försök igen.';
}

async function handleResetRequest(email) {
  const submitBtn = $('authSubmitBtn');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Skickar...';
  showAuthMessage('', false);
  try {
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname,
    });
    if (error) throw error;
    showAuthMessage(`Vi har skickat en återställningslänk till ${email}. Klicka på länken i mejlet för att välja ett nytt lösenord. Om du inte ser mejlet, kolla skräpposten.`, false);
  } catch (err) {
    showAuthMessage(translateAuthError(err.message || err), true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

async function handleNewPassword(password) {
  const submitBtn = $('authSubmitBtn');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sparar...';
  showAuthMessage('', false);
  try {
    const { data, error } = await sb.auth.updateUser({ password });
    if (error) throw error;
    isPasswordRecovery = false;
    const user = (data && data.user) || null;
    if (user) {
      await onSignedIn(user);
    } else {
      const sessRes = await sb.auth.getSession();
      const sessUser = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user;
      if (sessUser) await onSignedIn(sessUser);
      else {
        setAuthMode('signin');
        showAuthMessage('Lösenordet är uppdaterat. Logga in med det nya lösenordet.', false);
      }
    }
  } catch (err) {
    showAuthMessage(translateAuthError(err.message || err), true);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

function setupAuthHandlers() {
  $('authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!sb) return;
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;

    if (authMode === 'reset') {
      if (!email) return;
      await handleResetRequest(email);
      return;
    }
    if (authMode === 'newpw') {
      if (!password) return;
      await handleNewPassword(password);
      return;
    }

    if (!email || !password) return;
    const submitBtn = $('authSubmitBtn');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = authMode === 'signin' ? 'Loggar in...' : 'Skapar konto...';
    showAuthMessage('', false);
    try {
      const fn = authMode === 'signin' ? sb.auth.signInWithPassword : sb.auth.signUp;
      const { data, error } = await fn.call(sb.auth, { email, password });
      if (error) throw error;

      // Try to get a user from any of the places it might appear.
      let user = (data && data.user) || null;
      if (!user) {
        const sessRes = await sb.auth.getSession();
        user = (sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.user) || null;
      }

      if (authMode === 'signup' && !user && !(data && data.session)) {
        // Email confirmation required and account just created
        showAuthMessage(`Konto skapat. Vi har skickat ett bekräftelsemejl till ${email} — klicka på länken där och kom sedan tillbaka och logga in.`, false);
        setAuthMode('signin');
      } else if (user) {
        // Force the screen swap synchronously, BEFORE awaiting any wheel data.
        $('authScreen').hidden = true;
        $('appScreen').hidden = false;
        $('userEmail').textContent = user.email || '';
        currentUser = user;
        // Load wheel + admin status in background; don't block UI swap on them
        loadUserWheel(user.id).catch(err => {
          console.error('loadUserWheel failed:', err);
          toast('Hjulet kunde inte laddas — försök ladda om sidan');
        });
        refreshAdminStatus().catch(err => console.error('refreshAdminStatus failed:', err));
      } else {
        showAuthMessage('Inloggning gick igenom men sessionen kunde inte startas. Ladda om sidan och försök igen.', true);
      }
    } catch (err) {
      showAuthMessage(translateAuthError(err.message || err), true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });

  $('authToggleLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
  });

  $('authForgotLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode('reset');
  });

  $('authBackLink').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode('signin');
  });

  $('logoutBtn').addEventListener('click', async () => {
    // Best-effort server signOut (don't wait if it hangs)
    if (sb) {
      try {
        await Promise.race([
          sb.auth.signOut(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
        ]);
      } catch {}
    }
    // Clear the local Supabase auth session so the next reload lands on the login screen.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-')) localStorage.removeItem(key);
      }
    } catch {}
    // Hard reload to a clean state.
    window.location.reload();
  });

  // Admin modal wiring
  $('adminBtn').addEventListener('click', openAdminModal);
  $('adminCloseBtn').addEventListener('click', closeAdminModal);
  $('adminModal').addEventListener('click', (e) => {
    if (e.target === $('adminModal')) closeAdminModal();
  });
  $('adminAddForm').addEventListener('submit', handleAdminAdd);
  const diagBtn = $('adminDiagBtn');
  if (diagBtn) diagBtn.addEventListener('click', runAdminDiagnostic);
}

async function runAdminDiagnostic() {
  const log = ['== HR Årshjul diagnostik ==', 'Tid: ' + new Date().toISOString(), ''];
  log.push('navigator.onLine: ' + navigator.onLine);
  log.push('SUPABASE_URL: ' + SUPABASE_URL);
  log.push('User-Agent: ' + navigator.userAgent.slice(0, 100));
  log.push('');

  let token = null;
  try {
    const sessRes = await sb.auth.getSession();
    const sess = sessRes && sessRes.data && sessRes.data.session;
    log.push('Session: ' + (sess ? 'finns' : 'SAKNAS'));
    if (sess) {
      token = sess.access_token;
      log.push('  user.email: ' + (sess.user && sess.user.email));
    }
  } catch (err) {
    log.push('Session error: ' + (err.message || err));
  }
  log.push('');

  if (!token) {
    alert(log.join('\n') + '\n\nIngen session — logga ut och in.');
    return;
  }

  // Test flera endpoints, var och en med 5 sek timeout
  async function test(label, opts) {
    const t0 = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await fetch(opts.url, {
        method: opts.method,
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: 'Bearer ' + token,
        },
        body: opts.body,
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const ms = Date.now() - t0;
      const text = (await res.text()).slice(0, 120);
      log.push(`[${label}] ${res.status} på ${ms}ms - ${text}`);
    } catch (err) {
      clearTimeout(timer);
      const ms = Date.now() - t0;
      log.push(`[${label}] FEL på ${ms}ms - ${err.name}: ${err.message}`);
    }
  }

  log.push('Testar olika vägar (5 sek max per anrop):');
  log.push('');

  // Vercel-proxyn (ny väg som SKA fungera)
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ action: 'list' }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - t0;
    const txt = (await res.text()).slice(0, 200);
    log.push(`[VERCEL /api/admin] ${res.status} på ${ms}ms`);
    log.push('  body: ' + txt);
  } catch (err) {
    const ms = Date.now() - t0;
    log.push(`[VERCEL /api/admin] FEL på ${ms}ms - ${err.name}: ${err.message}`);
  }

  log.push('');

  // Direkta Supabase-anrop (gamla vägen — testar om de funkar för dig nu)
  await test('GET wheels (direkt)', { method: 'GET', url: SUPABASE_URL + '/rest/v1/wheels?select=user_id&limit=1' });
  await test('POST rpc/whoami (direkt)', { method: 'POST', url: SUPABASE_URL + '/rest/v1/rpc/whoami', body: '{}' });

  alert(log.join('\n'));
}

// ---------- Admin (allowlist) UI ----------
async function openAdminModal() {
  $('adminModal').hidden = false;
  $('adminMessage').hidden = true;
  await renderAdminEmailList();
}
function closeAdminModal() {
  $('adminModal').hidden = true;
  $('adminAddEmail').value = '';
  $('adminAddNotes').value = '';
}

function showAdminMessage(text, isError) {
  const el = $('adminMessage');
  if (!text) { el.hidden = true; el.classList.remove('is-error'); return; }
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('is-error', !!isError);
}

// Anropa vår egen Vercel serverless-funktion som vidarebefordrar till Supabase.
// Bypass:ar vad som än blockerar direkta supabase.co-anrop i Lara's miljö.
async function callAdminApi(action, extra) {
  const sessRes = await sb.auth.getSession();
  const token = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token;
  if (!token) throw new Error('Ingen aktiv session — logga ut och in igen.');

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  let res;
  try {
    res = await fetch('/api/admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token,
      },
      body: JSON.stringify(Object.assign({ action }, extra || {})),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') throw new Error('Begäran tog för lång tid (10 sek).');
    throw err;
  }
  clearTimeout(timer);

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    const msg = (data && (data.error || data.message || data.hint)) || ('HTTP ' + res.status);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

async function renderAdminEmailList() {
  const list = $('adminEmailList');
  list.innerHTML = '<li class="admin-email-empty">Hämtar listan…</li>';
  try {
    const data = await callAdminApi('list');
    list.innerHTML = '';
    if (!data || data.length === 0) {
      list.innerHTML = '<li class="admin-email-empty">Listan är tom — lägg till en mejladress för att börja bjuda in.</li>';
      return;
    }
    const myEmail = (currentUser && currentUser.email || '').toLowerCase();
    data.forEach(row => {
      const isSelf = row.email.toLowerCase() === myEmail;
      const li = document.createElement('li');
      li.className = 'admin-email-row' + (isSelf ? ' is-self' : '');
      li.innerHTML = `
        <span class="admin-email">${escapeHtml(row.email)}${isSelf ? ' (du)' : ''}</span>
        <span class="admin-notes">${escapeHtml(row.notes || '')}</span>
        <button class="btn-icon" type="button" data-email="${escapeHtml(row.email)}" ${isSelf ? 'disabled title="Du kan inte ta bort dig själv"' : 'title="Ta bort"'}>✕</button>
      `;
      list.appendChild(li);
    });
    list.querySelectorAll('button[data-email]').forEach(btn => {
      btn.addEventListener('click', () => handleAdminRemove(btn.dataset.email));
    });
  } catch (err) {
    console.error('admin_list_emails error:', err);
    list.innerHTML = '';
    showAdminMessage('Kunde inte hämta listan: ' + (err.message || err), true);
  }
}

async function handleAdminAdd(e) {
  e.preventDefault();
  const emailRaw = $('adminAddEmail').value.trim().toLowerCase();
  const notes = $('adminAddNotes').value.trim();
  if (!emailRaw) return;
  showAdminMessage('', false);
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn ? submitBtn.textContent : '';
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Lägger till…'; }
  try {
    await callAdminApi('add', { email: emailRaw, notes: notes || null });
    $('adminAddEmail').value = '';
    $('adminAddNotes').value = '';
    showAdminMessage(`${emailRaw} har lagts till. Säg till personen att de kan gå till sidan och skapa konto.`, false);
    await renderAdminEmailList();
  } catch (err) {
    let msg = err.message || String(err);
    if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('unique')) {
      msg = 'Den här mejladressen finns redan på listan.';
    }
    console.error('admin_add_email error:', err);
    showAdminMessage(msg, true);
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText || 'Lägg till'; }
  }
}

async function handleAdminRemove(email) {
  if (!confirm(`Ta bort ${email} från listan? Personen kan inte längre skapa nytt konto, men befintliga konton påverkas inte.`)) return;
  showAdminMessage('', false);
  try {
    await callAdminApi('remove', { email: email });
    await renderAdminEmailList();
  } catch (err) {
    console.error('admin_remove_email error:', err);
    showAdminMessage('Kunde inte ta bort: ' + (err.message || err), true);
  }
}

async function onSignedIn(user) {
  currentUser = user;
  showAppScreen(user);
  await loadUserWheel(user.id);
  await refreshAdminStatus();
}

let isAdmin = false;

// Klientsidig fallback: om mejlen är en känd admin, visa knappen direkt.
// Servern (RLS) gör fortfarande den riktiga kontrollen — knappen leder bara
// till handlingar som server-policys måste tillåta. Att visa knappen för fel
// person är alltså ofarligt.
const KNOWN_ADMIN_EMAILS = new Set([
  'eva.klevas@klevasconsulting.com',
  'klevas.ai@outlook.com',
]);

async function refreshAdminStatus() {
  if (!sb || !currentUser) {
    isAdmin = false;
    $('adminBtn').hidden = true;
    return;
  }
  const email = (currentUser.email || '').toLowerCase();

  // Snabb optimistisk check via mejl — visar knappen omedelbart för Lara.
  if (KNOWN_ADMIN_EMAILS.has(email)) {
    isAdmin = true;
    $('adminBtn').hidden = false;
    const link = $('adminLink');
    if (link) link.hidden = false;
  }

  // Bekräfta också via RPC (bästa möjliga; om den returnerar true håll knappen)
  try {
    const { data } = await sb.rpc('is_admin');
    if (data === true) {
      isAdmin = true;
      $('adminBtn').hidden = false;
      const link = $('adminLink');
      if (link) link.hidden = false;
    }
  } catch (err) {
    console.warn('refreshAdminStatus rpc exception:', err);
  }
}

// Re-check admin status when the tab regains focus — covers the case where
// the user came back to a stale tab and the previous check happened to fail.
window.addEventListener('focus', () => {
  if (currentUser) refreshAdminStatus().catch(() => {});
});

function onSignedOut() {
  currentUser = null;
  state = defaultState();
  isAdmin = false;
  $('adminBtn').hidden = true;
  showLoginScreen();
}

function showAppScreen(user) {
  $('authScreen').hidden = true;
  $('appScreen').hidden = false;
  $('userEmail').textContent = user.email || '';
  // Always re-check admin status when showing the app — never rely on the caller.
  refreshAdminStatus().catch(err => console.error('refreshAdminStatus failed:', err));
}
function showLoginScreen() {
  $('authScreen').hidden = false;
  $('appScreen').hidden = true;
  $('userEmail').textContent = '';
}

function showAuthMessage(text, isError) {
  const el = $('authMessage');
  if (!text) { el.hidden = true; el.classList.remove('is-error'); return; }
  el.textContent = text;
  el.hidden = false;
  el.classList.toggle('is-error', !!isError);
}

async function loadUserWheel(userId) {
  // Local-first: a local cache always wins because remote sync may be unreliable
  // in this user's network. Cross-device sync is a future concern.
  const local = loadLocal();
  if (local) {
    state = local;
    clientNameInput.value = state.client || '';
    clientYearInput.value = state.year || new Date().getFullYear();
    renderAll();
    return; // skip remote — local is authoritative
  }

  // No local cache — try Supabase as a starting point.
  let remote = null;
  try {
    const sessRes = await sb.auth.getSession();
    const token = sessRes && sessRes.data && sessRes.data.session && sessRes.data.session.access_token;
    if (!token) throw new Error('no token');
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(SUPABASE_URL + '/rest/v1/wheels?select=data,updated_at&user_id=eq.' + encodeURIComponent(userId), {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token },
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length && rows[0].data && Array.isArray(rows[0].data.rings)) {
        remote = rows[0].data;
      }
    }
  } catch (err) {
    console.warn('Wheel load failed (använder defaults):', err.message || err);
  }

  if (remote) {
    state = remote;
    saveLocal(); // seed the local cache with remote so we have it next time
  } else {
    // No remote, no local — fresh user, build defaults.
    state = defaultState();
    if (state.activities.length && state.activities[0].ringId === null) {
      state.activities[0].ringId = state.rings[1].id;
      state.activities[1].ringId = state.rings[2].id;
      state.activities[2].ringId = state.rings[0].id;
      state.activities[3].ringId = state.rings[0].id;
      state.activities[4].ringId = state.rings[1].id;
    }
  }
  clientNameInput.value = state.client || '';
  clientYearInput.value = state.year || new Date().getFullYear();
  renderAll();
  saveState();
}

// ---------- Upload PNG and restore project ----------
async function handleFileUpload(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // reset so same file can be picked again
  if (!file) return;
  try {
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (!isPng(bytes)) {
      toast('Filen är inte en giltig PNG-bild');
      return;
    }
    const stateB64 = readTextChunk(bytes, PNG_KEYWORD);
    if (!stateB64) {
      toast('Bilden saknar projektdata — välj en bild som laddats ner från appen');
      return;
    }
    const stateJson = decodeURIComponent(escape(atob(stateB64)));
    const loaded = JSON.parse(stateJson);
    if (!loaded || !Array.isArray(loaded.rings) || !Array.isArray(loaded.activities)) {
      toast('Projektdatan i bilden är skadad');
      return;
    }
    state = loaded;
    clientNameInput.value = state.client || '';
    clientYearInput.value = state.year || new Date().getFullYear();
    saveState();
    renderAll();
    toast('Hjulet är inläst — du kan fortsätta redigera');
  } catch (err) {
    console.error(err);
    toast('Kunde inte läsa filen');
  }
}

// ---------- PNG byte helpers ----------
function isPng(b) {
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (b.length < 8) return false;
  for (let i = 0; i < 8; i++) if (b[i] !== sig[i]) return false;
  return true;
}

// CRC32 used by PNG chunks
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint32BE(arr, offset, value) {
  arr[offset]     = (value >>> 24) & 0xFF;
  arr[offset + 1] = (value >>> 16) & 0xFF;
  arr[offset + 2] = (value >>> 8) & 0xFF;
  arr[offset + 3] = value & 0xFF;
}
function readUint32BE(arr, offset) {
  return ((arr[offset] << 24) | (arr[offset + 1] << 16) | (arr[offset + 2] << 8) | arr[offset + 3]) >>> 0;
}

function buildTextChunk(keyword, text) {
  const enc = new TextEncoder();
  const kw = enc.encode(keyword); // ASCII-only keyword
  const tx = enc.encode(text);    // base64 text → ASCII
  const dataLen = kw.length + 1 + tx.length;
  const data = new Uint8Array(dataLen);
  data.set(kw, 0);
  data[kw.length] = 0;
  data.set(tx, kw.length + 1);

  const type = new Uint8Array([0x74, 0x45, 0x58, 0x74]); // 'tEXt'
  const crcInput = new Uint8Array(type.length + data.length);
  crcInput.set(type, 0);
  crcInput.set(data, type.length);
  const crc = crc32(crcInput);

  const chunk = new Uint8Array(4 + 4 + dataLen + 4);
  writeUint32BE(chunk, 0, dataLen);
  chunk.set(type, 4);
  chunk.set(data, 8);
  writeUint32BE(chunk, 8 + dataLen, crc);
  return chunk;
}

function injectTextChunk(pngBytes, keyword, text) {
  // IEND is always the last 12 bytes (4 length + 4 type + 0 data + 4 crc)
  const chunk = buildTextChunk(keyword, text);
  const out = new Uint8Array(pngBytes.length + chunk.length);
  const insertAt = pngBytes.length - 12;
  out.set(pngBytes.subarray(0, insertAt), 0);
  out.set(chunk, insertAt);
  out.set(pngBytes.subarray(insertAt), insertAt + chunk.length);
  return out;
}

function readTextChunk(pngBytes, targetKeyword) {
  let pos = 8; // skip 8-byte signature
  while (pos + 12 <= pngBytes.length) {
    const length = readUint32BE(pngBytes, pos);
    const type = String.fromCharCode(pngBytes[pos + 4], pngBytes[pos + 5], pngBytes[pos + 6], pngBytes[pos + 7]);
    if (type === 'tEXt') {
      const data = pngBytes.subarray(pos + 8, pos + 8 + length);
      let nullIdx = -1;
      for (let i = 0; i < data.length; i++) if (data[i] === 0) { nullIdx = i; break; }
      if (nullIdx >= 0) {
        const kw = new TextDecoder().decode(data.subarray(0, nullIdx));
        if (kw === targetKeyword) {
          return new TextDecoder().decode(data.subarray(nullIdx + 1));
        }
      }
    }
    if (type === 'IEND') break;
    pos += 12 + length;
  }
  return null;
}

// ---------- Boot ----------
initAuth();
