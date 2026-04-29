// ====================================================================
// HR Årshjul — interactive year wheel builder
// ====================================================================

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
let state = loadState() || defaultState();

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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
$('exportBtn').addEventListener('click', exportWheelPNG);
$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', handleFileUpload);

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
    li.innerHTML = `
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

  // Background bands per ring
  state.rings.forEach((ring, i) => {
    const r1 = innerR + i * ringThickness;
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
    const r1 = innerR + ringIdx * ringThickness;
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
    appendRadialText(act.name, r1, r2, startAngle, endAngle);
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

  // Center circle
  appendSvg('circle', { cx: 0, cy: 0, r: innerR - 4, fill: '#fff', stroke: '#E5E0D7', 'stroke-width': 1 });
  const title = state.client || 'Årshjul';
  appendSvg('text', { x: 0, y: -10, 'text-anchor': 'middle', class: 'wheel-center-label', 'font-size': title.length > 14 ? 13 : 16 }, title);
  appendSvg('text', { x: 0, y: 12, 'text-anchor': 'middle', class: 'wheel-center-label', 'font-size': 22, 'font-weight': 600 }, String(state.year));
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

function appendRadialText(text, innerR, outerR, startAngle, endAngle) {
  // Text reads radially: from inner edge of the ring outward, centered in the arc.
  // This gives long activity names room even when the arc is narrow.
  const fontSize = 10;
  const charWidth = 5.6; // empirical width per char at 10px Inter
  const padding = 6;     // space at each end of the band

  const radialLength = outerR - innerR - padding * 2;
  const arcThickness = (endAngle - startAngle) * (innerR + outerR) / 2;

  // We need to fit text along the radial axis. Allow up to radialLength.
  let maxChars = Math.max(0, Math.floor(radialLength / charWidth));
  // But the character height (perpendicular to text direction) must fit in the arc thickness.
  // If the arc segment is too narrow (small lengthWeeks on a wide ring), skip the label.
  if (arcThickness < fontSize + 2) return;
  if (maxChars < 3) return;

  let label = text;
  if (label.length > maxChars) label = label.slice(0, Math.max(1, maxChars - 1)) + '…';

  const midAngle = (startAngle + endAngle) / 2;
  // Position text centered in the radial band
  const midR = (innerR + outerR) / 2;
  const x = midR * Math.cos(midAngle);
  const y = midR * Math.sin(midAngle);

  // Rotate text so its baseline runs radially outward.
  // SVG rotate(deg) rotates clockwise; midAngle in degrees gives outward direction.
  const rotation = midAngle * 180 / Math.PI;

  appendSvg('text', {
    x, y,
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    transform: `rotate(${rotation} ${x} ${y})`,
    class: 'wheel-arc-label',
    'font-size': fontSize,
  }, label);
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

// ---------- Export to PNG (with embedded project data) ----------
const PNG_KEYWORD = 'arshjul-state';

function exportWheelPNG() {
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
      if (!pngBlob) { toast('Kunde inte spara bilden'); return; }
      try {
        const arrayBuf = await pngBlob.arrayBuffer();
        const stateJson = JSON.stringify(state);
        const stateB64 = btoa(unescape(encodeURIComponent(stateJson)));
        const pngBytes = injectTextChunk(new Uint8Array(arrayBuf), PNG_KEYWORD, stateB64);
        const finalBlob = new Blob([pngBytes], { type: 'image/png' });
        const dlUrl = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.href = dlUrl;
        const safeClient = (state.client || 'kund').trim().replace(/[^a-zA-ZåäöÅÄÖ0-9_-]/g, '_') || 'kund';
        a.download = `arshjul-${safeClient}-${state.year}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(dlUrl), 1000);
        toast('Bilden är nedladdad');
      } catch (e) {
        console.error(e);
        toast('Något gick fel vid sparning');
      }
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Kunde inte rendera hjulet — försök igen');
  };
  img.src = url;
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
renderAll();
