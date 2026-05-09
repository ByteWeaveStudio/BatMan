import { getCurrentYear, getCurrentUser, getGrowthTreeRef } from './auth.js';
import { child, get, set } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

/* ---------- Constants ---------- */

const PILLARS = ['Health', 'Career & Studies', 'Relationships', 'Finance'];

// Angles use a math convention: 0° = east, increasing counter-clockwise.
// Health top-left, Finance top-right, Career bottom-right, Relationships bottom-left.
const PILLAR_ANGLES = {
  'Health': 135,
  'Finance': 45,
  'Career & Studies': 315,
  'Relationships': 225
};

const PILLAR_THEME = {
  'Health':            { color: '#059669', strong: '#047857', bg: '#ecfdf5', glow: 'rgba(5,150,105,0.45)' },
  'Career & Studies':  { color: '#4f46e5', strong: '#4338ca', bg: '#eef2ff', glow: 'rgba(79,70,229,0.45)' },
  'Relationships':     { color: '#e11d48', strong: '#be123c', bg: '#fff1f2', glow: 'rgba(225,29,72,0.45)' },
  'Finance':           { color: '#d97706', strong: '#b45309', bg: '#fffbeb', glow: 'rgba(217,119,6,0.45)' }
};

const RING = { pillar: 200, l2: 360, l3: 470 };
const RADIUS = { center: 50, pillar: 40, l2: 22, l3: 11 };
const PROGRESS_OFFSET = { center: 8, pillar: 6, l2: 5, l3: 4 };

const INITIAL_VIEW = { x: -640, y: -520, w: 1280, h: 1040 };
const ZOOM_MIN = 0.4; // viewBox can grow to 1/0.4 = 2.5x → zoomed out
const ZOOM_MAX = 3.0; // viewBox can shrink to 1/3 → zoomed in
const ZOOM_STEP = 1.2;
const PAN_DRAG_THRESHOLD = 4; // px before treating mousemove as a real drag

/* ---------- State ---------- */

let dataRef = null;
let tree = createInitialTree();

// Unified selection: level ∈ null|'pillar'|'l2'|'l3'|'l4'
let selection = { level: null, pillar: null, l2Id: null, l3Id: null, l4Id: null };

// Transient UI state
let pendingDelete = null;
let pendingEdit = null;   // { level: 'l2'|'l3'|'l4', id }
let pendingAdd = null;    // { kind: 'l2'|'l3'|'l4', pillar?, l2Id?, l3Id? }
let panelFocusKey = null;

// Pan / zoom state
let view = { ...INITIAL_VIEW };
let pan = { active: false, startCX: 0, startCY: 0, startVX: 0, startVY: 0, moved: false, suppressClick: false };
let pinch = { active: false, startDist: 0, startView: null, anchorSVG: null };

/* ---------- Init ---------- */

export async function initKnightMindmap() {
  dataRef = getGrowthTreeRef(getCurrentYear());
  bindEvents();
  showLoading(true);
  await loadTree();
}

function bindEvents() {
  const root = document.getElementById('kmm-root');
  if (!root) return;

  // Canvas (SVG) clicks + pan/zoom
  const canvas = document.getElementById('kmm-canvas');
  if (canvas) {
    canvas.addEventListener('click', handleCanvasClick);
    canvas.addEventListener('mousedown', handleCanvasMouseDown);
    canvas.addEventListener('wheel', handleCanvasWheel, { passive: false });
    canvas.addEventListener('touchstart', handleCanvasTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleCanvasTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleCanvasTouchEnd);
    canvas.addEventListener('touchcancel', handleCanvasTouchEnd);
  }

  // Mouse pan continues / ends on document so the user can drag past the canvas edge
  document.addEventListener('mousemove', handleDocumentMouseMove);
  document.addEventListener('mouseup', handleDocumentMouseUp);

  // Zoom controls (buttons in canvas-wrap, not inside the SVG)
  const controls = document.querySelector('.kmm-canvas-controls');
  if (controls) {
    controls.addEventListener('click', handleZoomControlClick);
  }

  // Panel (HTML) clicks/changes/keys
  const panel = document.getElementById('kmm-panel');
  if (panel) {
    panel.addEventListener('click', handlePanelClick);
    panel.addEventListener('change', handlePanelChange);
    panel.addEventListener('keydown', handlePanelKeydown);
    panel.addEventListener('focusout', handlePanelFocusOut);
  }

  // Delete confirmation modal
  const modal = document.getElementById('kmm-delete-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'confirm-delete') confirmDelete();
      else if (action === 'cancel-delete') closeDeleteModal();
    });
    modal.addEventListener('hidden.bs.modal', () => { pendingDelete = null; });
  }
}

async function loadTree() {
  if (!dataRef) return;
  try {
    const snap = await get(dataRef);
    if (!snap.exists()) {
      tree = createInitialTree();
      await set(dataRef, tree);
    } else {
      tree = normalizeTree(snap.val());
      await ensurePillars();
    }
    renderAll();
  } catch (err) {
    console.error('Failed to load mind map:', err);
    const wrap = document.querySelector('.kmm-canvas-wrap');
    if (wrap) wrap.innerHTML = '<div class="text-danger p-4">Could not load. Please refresh.</div>';
  } finally {
    showLoading(false);
  }
}

async function ensurePillars() {
  const writes = [];
  for (const pillar of PILLARS) {
    if (!Array.isArray(tree[pillar])) {
      tree[pillar] = [];
      writes.push(set(child(dataRef, pillar), []));
    }
  }
  if (writes.length) await Promise.all(writes);
}

/* ---------- Render orchestration ---------- */

function renderAll() {
  renderCanvas();
  renderPanel();
}

function renderCanvas() {
  const svg = document.getElementById('kmm-canvas');
  if (!svg) return;
  const layout = computeLayout();
  svg.innerHTML = buildCanvasMarkup(layout);
}

function renderPanel() {
  const panel = document.getElementById('kmm-panel');
  if (!panel) return;
  panel.innerHTML = buildPanelMarkup();
  applyPanelFocus();
}

/* ---------- Layout ---------- */

function computeLayout() {
  const out = { pillars: [] };
  for (const pillar of PILLARS) {
    const baseAngle = PILLAR_ANGLES[pillar];
    const ppos = polar(RING.pillar, baseAngle);
    const l2Nodes = getL2(pillar);
    const l2Span = computeArcSpan(l2Nodes.length, 'l2');

    const pillarObj = {
      pillar,
      x: ppos.x, y: ppos.y,
      angle: baseAngle,
      progress: getPillarProgress(pillar),
      l2: []
    };

    for (let i = 0; i < l2Nodes.length; i++) {
      const node = l2Nodes[i];
      const offset = l2Nodes.length === 1
        ? 0
        : (i / (l2Nodes.length - 1) - 0.5) * l2Span;
      const angle = baseAngle + offset;
      const pos = polar(RING.l2, angle);
      const l3Children = normalizeList(node.children);
      const l3Span = computeArcSpan(l3Children.length, 'l3');

      const l2Obj = {
        ...node,
        x: pos.x, y: pos.y,
        angle,
        progress: getL2Progress(node),
        l3: []
      };

      for (let j = 0; j < l3Children.length; j++) {
        const l3node = l3Children[j];
        const l3offset = l3Children.length === 1
          ? 0
          : (j / (l3Children.length - 1) - 0.5) * l3Span;
        const l3angle = angle + l3offset;
        const l3pos = polar(RING.l3, l3angle);
        l2Obj.l3.push({
          ...l3node,
          x: l3pos.x, y: l3pos.y,
          angle: l3angle,
          progress: getL3Progress(l3node)
        });
      }

      pillarObj.l2.push(l2Obj);
    }

    out.pillars.push(pillarObj);
  }
  return out;
}

function computeArcSpan(count, level) {
  if (count <= 1) return 0;
  // Pillars are 90° apart; we cap total fan at ~84° (half = 42°) so adjacent
  // quadrants don't bleed into each other. l2 takes the bigger share.
  if (level === 'l2') {
    if (count === 2) return 28;
    if (count === 3) return 40;
    if (count <= 5) return 52;
    return 60;
  }
  // l3
  if (count === 2) return 12;
  if (count === 3) return 16;
  if (count <= 5) return 20;
  return 24;
}

function polar(r, deg) {
  const rad = deg * Math.PI / 180;
  return { x: r * Math.cos(rad), y: -r * Math.sin(rad) };
}

/* ---------- Canvas markup ---------- */

function buildCanvasMarkup(layout) {
  const parts = [];

  // 1) Branches first (so nodes layer on top)
  parts.push(renderCenterBranches(layout));
  parts.push(renderPillarBranches(layout));
  parts.push(renderL2Branches(layout));

  // 2) Add hints (ghost endpoints)
  parts.push(renderAddHints(layout));

  // 3) Nodes top-to-tip so children stay on top of L2 dots; visually
  //    we want L3 dots above their L2 (they're farther out, no overlap),
  //    but center should be on top of branches.
  parts.push(renderL3Nodes(layout));
  parts.push(renderL2Nodes(layout));
  parts.push(renderPillarNodes(layout));
  parts.push(renderCenterNode());

  return parts.join('');
}

function renderCenterBranches(layout) {
  const sel = selection;
  return layout.pillars.map(p => {
    const branchSelected = sel.pillar === p.pillar && sel.level !== null;
    const opacity = branchOpacity(p.progress, branchSelected);
    return `
      <line class="kmm-link ${branchSelected ? 'is-selected-branch' : ''}"
            x1="0" y1="0" x2="${p.x.toFixed(2)}" y2="${p.y.toFixed(2)}"
            stroke="${PILLAR_THEME[p.pillar].color}"
            stroke-width="${branchSelected ? 4.5 : 3.5}"
            opacity="${opacity}" />
    `;
  }).join('');
}

function renderPillarBranches(layout) {
  return layout.pillars.map(p => {
    return p.l2.map(l2 => {
      const branchSelected = isOnSelectedBranch(p.pillar, l2.id, null);
      const opacity = branchOpacity(l2.progress, branchSelected);
      return `
        <line class="kmm-link ${branchSelected ? 'is-selected-branch' : ''}"
              x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}"
              x2="${l2.x.toFixed(2)}" y2="${l2.y.toFixed(2)}"
              stroke="${PILLAR_THEME[p.pillar].color}"
              stroke-width="${branchSelected ? 2.5 : 2}"
              opacity="${opacity}" />
      `;
    }).join('');
  }).join('');
}

function renderL2Branches(layout) {
  return layout.pillars.map(p => {
    return p.l2.map(l2 => {
      return l2.l3.map(l3 => {
        const branchSelected = isOnSelectedBranch(p.pillar, l2.id, l3.id);
        const opacity = branchOpacity(l3.progress, branchSelected);
        return `
          <line class="kmm-link ${branchSelected ? 'is-selected-branch' : ''}"
                x1="${l2.x.toFixed(2)}" y1="${l2.y.toFixed(2)}"
                x2="${l3.x.toFixed(2)}" y2="${l3.y.toFixed(2)}"
                stroke="${PILLAR_THEME[p.pillar].color}"
                stroke-width="${branchSelected ? 2 : 1.4}"
                opacity="${opacity}" />
        `;
      }).join('');
    }).join('');
  }).join('');
}

function renderAddHints(layout) {
  const out = [];
  for (const p of layout.pillars) {
    if (p.l2.length === 0) {
      // Ghost branch from pillar outward
      const tip = polar(RING.pillar + 80, p.angle);
      out.push(`
        <line class="kmm-link is-empty"
              x1="${p.x.toFixed(2)}" y1="${p.y.toFixed(2)}"
              x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(2)}"
              stroke="${PILLAR_THEME[p.pillar].color}" stroke-width="1.5" opacity="0.5" />
      `);
      out.push(addHintMarkup(tip.x, tip.y, p.pillar, 'l2-from-pillar', null, null));
    } else {
      for (const l2 of p.l2) {
        if (l2.l3.length === 0) {
          const tip = polar(RING.l2 + 70, l2.angle);
          out.push(`
            <line class="kmm-link is-empty"
                  x1="${l2.x.toFixed(2)}" y1="${l2.y.toFixed(2)}"
                  x2="${tip.x.toFixed(2)}" y2="${tip.y.toFixed(2)}"
                  stroke="${PILLAR_THEME[p.pillar].color}" stroke-width="1.5" opacity="0.45" />
          `);
          out.push(addHintMarkup(tip.x, tip.y, p.pillar, 'l3-from-l2', l2.id, null));
        }
      }
    }
  }
  return out.join('');
}

function addHintMarkup(x, y, pillar, kind, l2Id, l3Id) {
  const r = 12;
  return `
    <g class="kmm-add-hint"
       data-action="add-from-hint"
       data-kind="${kind}"
       data-pillar="${escapeAttr(pillar)}"
       data-l2id="${escapeAttr(l2Id || '')}"
       data-l3id="${escapeAttr(l3Id || '')}"
       transform="translate(${x.toFixed(2)} ${y.toFixed(2)})">
      <circle class="kmm-add-hint-circle" cx="0" cy="0" r="${r}" />
      <text class="kmm-add-hint-plus" x="0" y="4" text-anchor="middle" font-size="14">+</text>
    </g>
  `;
}

function renderCenterNode() {
  const r = RADIUS.center;
  const user = getCurrentUser();
  const name = (user?.displayName || user?.email || 'You').split('@')[0];
  const initial = (name[0] || 'M').toUpperCase();
  return `
    <g class="kmm-node kmm-node--center" data-action="select-center">
      <circle class="kmm-node-circle" cx="0" cy="0" r="${r}" />
      <text class="kmm-node-sub" x="0" y="-8" text-anchor="middle">PROJECT</text>
      <text class="kmm-node-label" x="0" y="8" text-anchor="middle">BATMAN</text>
    </g>
  `;
}

function renderPillarNodes(layout) {
  return layout.pillars.map(p => {
    const theme = PILLAR_THEME[p.pillar];
    const r = RADIUS.pillar;
    const isSelected = selection.level === 'pillar' && selection.pillar === p.pillar;
    const isDim = selection.level !== null && selection.pillar !== p.pillar;
    const labelPos = polar(r + 26, p.angle);
    const lx = p.x + labelPos.x;
    const ly = p.y + labelPos.y;
    const anchor = textAnchorFor(p.angle);
    const baseline = baselineFor(p.angle);
    const empty = p.l2.length === 0;
    const fill = empty ? '#cbd5e1' : theme.color;

    return `
      <g class="kmm-node kmm-node--pillar ${isSelected ? 'is-selected' : ''} ${isDim ? 'is-dim' : ''} ${empty ? 'is-empty' : ''}"
         data-action="select-pillar"
         data-pillar="${escapeAttr(p.pillar)}"
         style="--kmm-accent: ${theme.color}; --kmm-accent-glow: ${theme.glow};">
        <circle class="kmm-node-circle" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="${r}" fill="${fill}" />
        ${renderProgressArc(p.x, p.y, r + PROGRESS_OFFSET.pillar, p.progress, theme.color, 3.5)}
        <text class="kmm-node-percent" x="${p.x.toFixed(2)}" y="${(p.y + 4).toFixed(2)}" text-anchor="middle">${Math.round(p.progress)}%</text>
        <text class="kmm-node-label" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeHtml(p.pillar)}</text>
      </g>
    `;
  }).join('');
}

function renderL2Nodes(layout) {
  const out = [];
  for (const p of layout.pillars) {
    const theme = PILLAR_THEME[p.pillar];
    for (const l2 of p.l2) {
      const r = RADIUS.l2;
      const isSelected = selection.level === 'l2' && selection.pillar === p.pillar && selection.l2Id === l2.id;
      const isDim = selection.level !== null && (selection.pillar !== p.pillar || (selection.l2Id && selection.l2Id !== l2.id));
      const empty = l2.l3.length === 0;
      const fill = empty ? '#e2e8f0' : tintColor(theme.color, 0.18);
      const labelPos = polar(r + 18, l2.angle);
      const lx = l2.x + labelPos.x;
      const ly = l2.y + labelPos.y;
      const anchor = textAnchorFor(l2.angle);
      const baseline = baselineFor(l2.angle);

      out.push(`
        <g class="kmm-node kmm-node--l2 ${isSelected ? 'is-selected' : ''} ${isDim ? 'is-dim' : ''} ${empty ? 'is-empty' : ''}"
           data-action="select-l2"
           data-pillar="${escapeAttr(p.pillar)}"
           data-l2id="${escapeAttr(l2.id)}"
           style="--kmm-accent: ${theme.color}; --kmm-accent-glow: ${theme.glow};">
          <circle class="kmm-node-circle" cx="${l2.x.toFixed(2)}" cy="${l2.y.toFixed(2)}" r="${r}" fill="${fill}" stroke="${theme.color}" stroke-width="2" />
          ${renderProgressArc(l2.x, l2.y, r + PROGRESS_OFFSET.l2, l2.progress, theme.color, 2.5)}
          ${l2.progress > 0 ? `<text class="kmm-node-percent" x="${l2.x.toFixed(2)}" y="${(l2.y + 3).toFixed(2)}" text-anchor="middle" style="fill:${theme.strong}">${Math.round(l2.progress)}%</text>` : ''}
          <text class="kmm-node-label" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeHtml(truncate(l2.name, 22))}</text>
        </g>
      `);
    }
  }
  return out.join('');
}

function renderL3Nodes(layout) {
  const out = [];
  for (const p of layout.pillars) {
    const theme = PILLAR_THEME[p.pillar];
    for (const l2 of p.l2) {
      for (const l3 of l2.l3) {
        const r = RADIUS.l3;
        const isSelected = (selection.level === 'l3' || selection.level === 'l4')
          && selection.pillar === p.pillar
          && selection.l2Id === l2.id
          && selection.l3Id === l3.id;
        const isDim = selection.level !== null && (
          selection.pillar !== p.pillar ||
          (selection.l2Id && selection.l2Id !== l2.id) ||
          (selection.l3Id && selection.l3Id !== l3.id)
        );
        const fill = tintColor(theme.color, 0.1);
        const labelPos = polar(r + 12, l3.angle);
        const lx = l3.x + labelPos.x;
        const ly = l3.y + labelPos.y;
        const anchor = textAnchorFor(l3.angle);
        const baseline = baselineFor(l3.angle);

        out.push(`
          <g class="kmm-node kmm-node--l3 ${isSelected ? 'is-selected' : ''} ${isDim ? 'is-dim' : ''}"
             data-action="select-l3"
             data-pillar="${escapeAttr(p.pillar)}"
             data-l2id="${escapeAttr(l2.id)}"
             data-l3id="${escapeAttr(l3.id)}"
             style="--kmm-accent: ${theme.color}; --kmm-accent-glow: ${theme.glow};">
            <circle class="kmm-node-circle" cx="${l3.x.toFixed(2)}" cy="${l3.y.toFixed(2)}" r="${r}" fill="${fill}" stroke="${theme.color}" stroke-width="1.5" />
            ${l3.progress > 0 ? renderProgressArc(l3.x, l3.y, r + PROGRESS_OFFSET.l3, l3.progress, theme.color, 1.8) : ''}
            <text class="kmm-node-label" x="${lx.toFixed(2)}" y="${ly.toFixed(2)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeHtml(truncate(l3.name, 18))}</text>
          </g>
        `);
      }
    }
  }
  return out.join('');
}

function renderProgressArc(cx, cy, r, percent, color, width) {
  if (percent <= 0) return '';
  if (percent >= 100) {
    return `<circle class="kmm-node-progress" cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${r}" stroke="${color}" stroke-width="${width}" />`;
  }
  // Arc starting at top (12 o'clock), sweeping clockwise through 'percent' of full circle.
  const angle = percent / 100 * 360;
  const rad = (angle - 90) * Math.PI / 180; // start at -90° (top)
  const startX = cx;
  const startY = cy - r;
  // End point at -90° + angle, measured clockwise (so we add angle to start angle).
  const endRad = (-90 + angle) * Math.PI / 180;
  const endX = cx + r * Math.cos(endRad);
  const endY = cy + r * Math.sin(endRad);
  const largeArc = angle > 180 ? 1 : 0;
  const path = `M ${startX.toFixed(2)} ${startY.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
  return `<path class="kmm-node-progress" d="${path}" stroke="${color}" stroke-width="${width}" />`;
}

function branchOpacity(progress, isSelected) {
  if (isSelected) return 1;
  if (selection.level !== null) return 0.35;
  // Stagnant branches fade. Active ones brighten.
  return Math.max(0.28, Math.min(1, 0.28 + (progress / 100) * 0.72));
}

function isOnSelectedBranch(pillar, l2Id, l3Id) {
  if (selection.level === null) return false;
  if (selection.pillar !== pillar) return false;
  if (selection.level === 'pillar') return true;
  if (selection.l2Id !== l2Id) return false;
  if (selection.level === 'l2') return true;
  if (l3Id != null && selection.l3Id !== l3Id) return false;
  return true;
}

function textAnchorFor(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (a > 95 && a < 265) return 'end';
  if (a >= 85 && a <= 95) return 'middle';
  if (a >= 265 && a <= 275) return 'middle';
  return 'start';
}

function baselineFor(angle) {
  const a = ((angle % 360) + 360) % 360;
  if (a > 30 && a < 150) return 'auto'; // upper half: text sits below the y-coord; we want text above the point
  if (a > 210 && a < 330) return 'hanging';
  return 'middle';
}

/* ---------- Panel markup ---------- */

function buildPanelMarkup() {
  if (selection.level === null) {
    return `
      <div class="kmm-panel-empty">
        <p class="kmm-panel-empty-title">Tap a node to focus</p>
        <p class="kmm-panel-empty-sub">Sub-areas, topics, and tasks will appear here for editing.</p>
      </div>
    `;
  }
  if (selection.level === 'pillar') return buildPillarPanel();
  if (selection.level === 'l2') return buildL2Panel();
  if (selection.level === 'l3' || selection.level === 'l4') return buildL3Panel();
  return '';
}

function buildPillarPanel() {
  const pillar = selection.pillar;
  const theme = PILLAR_THEME[pillar];
  const l2Nodes = getL2(pillar);
  const progress = roundPct(getPillarProgress(pillar));
  const isAdding = pendingAdd && pendingAdd.kind === 'l2' && pendingAdd.pillar === pillar;

  return `
    <div class="kmm-panel-card" data-pillar-tint="true"
         style="--kmm-accent:${theme.color}; --kmm-accent-strong:${theme.strong}; --kmm-accent-bg:${theme.bg};">
      <p class="kmm-panel-breadcrumb">Pillar</p>
      <div class="kmm-panel-title-row">
        <h2 class="kmm-panel-title">${escapeHtml(pillar)}</h2>
      </div>
      <div class="kmm-panel-meta">
        <span>${l2Nodes.length} sub-area${l2Nodes.length === 1 ? '' : 's'}</span>
        <span class="kmm-panel-meta-strong">${progress}%</span>
      </div>
      <div class="kmm-panel-bar"><div class="kmm-panel-bar-fill" style="width:${progress}%"></div></div>

      <div class="kmm-panel-section">
        <div class="kmm-panel-section-head">
          <p class="kmm-panel-section-label">Sub-areas</p>
          ${isAdding ? '' : `<button class="btn btn-sm btn-outline-primary" data-action="start-add-l2">+ Add</button>`}
        </div>
        ${renderChildList(l2Nodes, 'l2', getL2Progress)}
        ${isAdding ? renderAddRow('l2-input', 'New sub-area name') : ''}
      </div>
    </div>
  `;
}

function buildL2Panel() {
  const pillar = selection.pillar;
  const theme = PILLAR_THEME[pillar];
  const l2Node = getL2Node(pillar, selection.l2Id);
  if (!l2Node) return buildEmptyPanel();
  const isEditing = pendingEdit && pendingEdit.level === 'l2' && pendingEdit.id === l2Node.id;
  const isAdding = pendingAdd && pendingAdd.kind === 'l3' && pendingAdd.l2Id === l2Node.id;
  const l3Children = normalizeList(l2Node.children);
  const progress = roundPct(getL2Progress(l2Node));

  return `
    <div class="kmm-panel-card" data-pillar-tint="true"
         style="--kmm-accent:${theme.color}; --kmm-accent-strong:${theme.strong}; --kmm-accent-bg:${theme.bg};">
      <p class="kmm-panel-breadcrumb">${escapeHtml(pillar)}</p>
      <div class="kmm-panel-title-row">
        ${isEditing
          ? `<input class="form-control kmm-panel-title-input" data-edit-input value="${escapeAttr(l2Node.name)}">`
          : `<h2 class="kmm-panel-title">${escapeHtml(l2Node.name)}</h2>`}
        <div class="kmm-panel-actions">
          <button class="kmm-icon-btn" data-action="start-edit-l2" title="Rename">${editIcon()}</button>
          <button class="kmm-icon-btn kmm-icon-btn--danger" data-action="delete-l2" title="Delete">${deleteIcon()}</button>
        </div>
      </div>
      <div class="kmm-panel-meta">
        <span>${l3Children.length} topic${l3Children.length === 1 ? '' : 's'}</span>
        <span class="kmm-panel-meta-strong">${progress}%</span>
      </div>
      <div class="kmm-panel-bar"><div class="kmm-panel-bar-fill" style="width:${progress}%"></div></div>

      <div class="kmm-panel-section">
        <div class="kmm-panel-section-head">
          <p class="kmm-panel-section-label">Topics</p>
          ${isAdding ? '' : `<button class="btn btn-sm btn-outline-primary" data-action="start-add-l3">+ Add</button>`}
        </div>
        ${renderChildList(l3Children, 'l3', getL3Progress)}
        ${isAdding ? renderAddRow('l3-input', 'New topic name') : ''}
      </div>
    </div>
  `;
}

function buildL3Panel() {
  const pillar = selection.pillar;
  const theme = PILLAR_THEME[pillar];
  const l2Node = getL2Node(pillar, selection.l2Id);
  const l3Node = l2Node ? normalizeList(l2Node.children).find(n => n.id === selection.l3Id) : null;
  if (!l3Node) return buildEmptyPanel();

  const isEditing = pendingEdit && pendingEdit.level === 'l3' && pendingEdit.id === l3Node.id;
  const isAdding = pendingAdd && pendingAdd.kind === 'l4' && pendingAdd.l3Id === l3Node.id;
  const tasks = normalizeList(l3Node.children);
  const progress = roundPct(getL3Progress(l3Node));
  const selectedTask = (selection.level === 'l4' && selection.l4Id)
    ? tasks.find(t => t.id === selection.l4Id) || null
    : null;
  const isEditingL4 = selectedTask && pendingEdit && pendingEdit.level === 'l4' && pendingEdit.id === selectedTask.id;

  const breadcrumb = `${pillar} › ${l2Node.name}`;

  return `
    <div class="kmm-panel-card" data-pillar-tint="true"
         style="--kmm-accent:${theme.color}; --kmm-accent-strong:${theme.strong}; --kmm-accent-bg:${theme.bg};">
      <p class="kmm-panel-breadcrumb">${escapeHtml(breadcrumb)}</p>
      <div class="kmm-panel-title-row">
        ${isEditing
          ? `<input class="form-control kmm-panel-title-input" data-edit-input value="${escapeAttr(l3Node.name)}">`
          : `<h2 class="kmm-panel-title">${escapeHtml(l3Node.name)}</h2>`}
        <div class="kmm-panel-actions">
          <button class="kmm-icon-btn" data-action="start-edit-l3" title="Rename">${editIcon()}</button>
          <button class="kmm-icon-btn kmm-icon-btn--danger" data-action="delete-l3" title="Delete">${deleteIcon()}</button>
        </div>
      </div>
      <div class="kmm-panel-meta">
        <span>${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${tasks.filter(t => t.completed).length} done</span>
        <span class="kmm-panel-meta-strong">${progress}%</span>
      </div>
      <div class="kmm-panel-bar"><div class="kmm-panel-bar-fill" style="width:${progress}%"></div></div>

      <div class="kmm-panel-section">
        <div class="kmm-panel-section-head">
          <p class="kmm-panel-section-label">Tasks</p>
          ${isAdding ? '' : `<button class="btn btn-sm btn-outline-primary" data-action="start-add-l4">+ Add</button>`}
        </div>
        ${tasks.length === 0
          ? '<p class="kmm-panel-empty-children">No tasks yet. Add the first one to get moving.</p>'
          : `<div class="kmm-panel-children">${tasks.map(t => renderTaskRow(t)).join('')}</div>`}
        ${isAdding ? renderAddRow('l4-input', 'New task name') : ''}
      </div>

      ${selectedTask ? renderTaskDetail(selectedTask, isEditingL4) : ''}
    </div>
  `;
}

function buildEmptyPanel() {
  return `
    <div class="kmm-panel-empty">
      <p class="kmm-panel-empty-title">Selection lost</p>
      <p class="kmm-panel-empty-sub">The selected node no longer exists. Tap another node.</p>
    </div>
  `;
}

function renderChildList(nodes, level, progressFn) {
  if (nodes.length === 0) {
    return `<p class="kmm-panel-empty-children">No items yet.</p>`;
  }
  return `
    <div class="kmm-panel-children">
      ${nodes.map(n => {
        const isSel = level === 'l2'
          ? selection.l2Id === n.id
          : selection.l3Id === n.id;
        return `
          <div class="kmm-panel-child ${isSel ? 'is-selected' : ''}"
               data-action="select-${level}-from-panel"
               data-id="${escapeAttr(n.id)}">
            <span class="kmm-panel-child-name">${escapeHtml(n.name)}</span>
            <span class="kmm-panel-child-meta">${roundPct(progressFn(n))}%</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTaskRow(task) {
  const isSel = selection.l4Id === task.id;
  return `
    <div class="kmm-panel-task ${task.completed ? 'is-completed' : ''} ${isSel ? 'is-selected' : ''}"
         data-action="select-l4-from-panel"
         data-id="${escapeAttr(task.id)}">
      <input type="checkbox" class="form-check-input" data-field="completed"
             data-id="${escapeAttr(task.id)}" ${task.completed ? 'checked' : ''}>
      <span class="kmm-panel-task-name">${escapeHtml(task.name)}</span>
    </div>
  `;
}

function renderTaskDetail(task, isEditingName) {
  return `
    <div class="kmm-panel-detail">
      <div class="kmm-panel-title-row">
        ${isEditingName
          ? `<input class="form-control kmm-panel-title-input" data-edit-input value="${escapeAttr(task.name)}">`
          : `<h3 class="kmm-panel-title" style="font-size:1rem;">${escapeHtml(task.name)}</h3>`}
        <div class="kmm-panel-actions">
          <button class="kmm-icon-btn" data-action="start-edit-l4" title="Rename">${editIcon()}</button>
          <button class="kmm-icon-btn kmm-icon-btn--danger" data-action="delete-l4" title="Delete">${deleteIcon()}</button>
        </div>
      </div>
      <label class="kmm-panel-detail-status">
        <input type="checkbox" class="form-check-input" data-field="completed"
               data-id="${escapeAttr(task.id)}" ${task.completed ? 'checked' : ''}>
        <span>${task.completed ? 'Completed' : 'Mark as complete'}</span>
      </label>
      <p class="kmm-panel-detail-label">Description</p>
      <textarea class="form-control kmm-panel-detail-desc" data-field="description"
                data-id="${escapeAttr(task.id)}"
                placeholder="Add details, context, or steps for this item...">${escapeHtml(task.description || '')}</textarea>
    </div>
  `;
}

function renderAddRow(inputKey, placeholder) {
  return `
    <div class="kmm-panel-add">
      <input type="text" class="form-control form-control-sm" data-add-input="${inputKey}" placeholder="${placeholder}">
      <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel-add">Cancel</button>
    </div>
  `;
}

/* ---------- Transient UI helpers ---------- */

function applyPanelFocus() {
  if (!panelFocusKey) return;
  const el = document.querySelector(`[${panelFocusKey}]`);
  if (el) {
    el.focus();
    if (el.select) el.select();
  }
  panelFocusKey = null;
}

/* ---------- Canvas click handling ---------- */

function handleCanvasClick(event) {
  // Click is fired by the browser at the end of every mousedown/up. If the user
  // was dragging the canvas, swallow it so we don't accidentally deselect.
  if (pan.suppressClick) {
    pan.suppressClick = false;
    event.stopPropagation();
    return;
  }
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) {
    // Empty space: deselect
    if (selection.level !== null) {
      selection = { level: null, pillar: null, l2Id: null, l3Id: null, l4Id: null };
      pendingEdit = null;
      pendingAdd = null;
      hideHint(false);
      renderAll();
    }
    return;
  }
  const action = actionEl.dataset.action;

  if (action === 'select-center') {
    selection = { level: null, pillar: null, l2Id: null, l3Id: null, l4Id: null };
    pendingEdit = null;
    pendingAdd = null;
    hideHint(false);
    renderAll();
    return;
  }

  if (action === 'select-pillar') {
    const pillar = actionEl.dataset.pillar;
    selectNode({ level: 'pillar', pillar, l2Id: null, l3Id: null, l4Id: null });
    return;
  }

  if (action === 'select-l2') {
    const pillar = actionEl.dataset.pillar;
    const l2Id = actionEl.dataset.l2id;
    selectNode({ level: 'l2', pillar, l2Id, l3Id: null, l4Id: null });
    return;
  }

  if (action === 'select-l3') {
    const pillar = actionEl.dataset.pillar;
    const l2Id = actionEl.dataset.l2id;
    const l3Id = actionEl.dataset.l3id;
    selectNode({ level: 'l3', pillar, l2Id, l3Id, l4Id: null });
    return;
  }

  if (action === 'add-from-hint') {
    const kind = actionEl.dataset.kind;
    const pillar = actionEl.dataset.pillar;
    const l2Id = actionEl.dataset.l2id || null;
    if (kind === 'l2-from-pillar') {
      selection = { level: 'pillar', pillar, l2Id: null, l3Id: null, l4Id: null };
      pendingAdd = { kind: 'l2', pillar };
      panelFocusKey = 'data-add-input="l2-input"';
      hideHint(true);
    } else if (kind === 'l3-from-l2') {
      selection = { level: 'l2', pillar, l2Id, l3Id: null, l4Id: null };
      pendingAdd = { kind: 'l3', l2Id };
      panelFocusKey = 'data-add-input="l3-input"';
      hideHint(true);
    }
    pendingEdit = null;
    renderAll();
    return;
  }
}

function selectNode(next) {
  selection = next;
  pendingEdit = null;
  pendingAdd = null;
  hideHint(true);
  renderAll();
}

function hideHint(hide) {
  const hint = document.querySelector('[data-canvas-hint]');
  if (hint) hint.classList.toggle('is-hidden', hide);
}

/* ---------- Pan & zoom ---------- */

function applyView() {
  const svg = document.getElementById('kmm-canvas');
  if (!svg) return;
  svg.setAttribute('viewBox', `${view.x.toFixed(2)} ${view.y.toFixed(2)} ${view.w.toFixed(2)} ${view.h.toFixed(2)}`);
}

function clientToSVG(clientX, clientY) {
  const svg = document.getElementById('kmm-canvas');
  if (!svg) return { x: 0, y: 0 };
  const rect = svg.getBoundingClientRect();
  // preserveAspectRatio="xMidYMid meet" → uniform scale, centered with letterboxing
  const scale = Math.min(rect.width / view.w, rect.height / view.h);
  const offsetX = (rect.width - view.w * scale) / 2;
  const offsetY = (rect.height - view.h * scale) / 2;
  const x = (clientX - rect.left - offsetX) / scale + view.x;
  const y = (clientY - rect.top - offsetY) / scale + view.y;
  return { x, y };
}

function svgScale() {
  const svg = document.getElementById('kmm-canvas');
  if (!svg) return 1;
  const rect = svg.getBoundingClientRect();
  return Math.min(rect.width / view.w, rect.height / view.h) || 1;
}

function clampViewWidth(newW) {
  const minW = INITIAL_VIEW.w / ZOOM_MAX; // most zoomed in
  const maxW = INITIAL_VIEW.w / ZOOM_MIN; // most zoomed out
  return Math.max(minW, Math.min(maxW, newW));
}

function zoomAt(clientX, clientY, factor) {
  const newW = clampViewWidth(view.w * factor);
  if (newW === view.w) return;
  const ratio = newW / view.w;
  const anchor = clientToSVG(clientX, clientY);
  view.x = anchor.x - (anchor.x - view.x) * ratio;
  view.y = anchor.y - (anchor.y - view.y) * ratio;
  view.w = newW;
  view.h = INITIAL_VIEW.h * (newW / INITIAL_VIEW.w);
  applyView();
}

function zoomCenter(factor) {
  const svg = document.getElementById('kmm-canvas');
  if (!svg) return;
  const rect = svg.getBoundingClientRect();
  zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
}

function resetView() {
  view = { ...INITIAL_VIEW };
  applyView();
}

function handleCanvasMouseDown(event) {
  pan.suppressClick = false;
  if (event.button !== 0) return;
  // Don't start a pan when grabbing a node — those handle their own click.
  if (event.target.closest('[data-action]')) return;

  pan.active = true;
  pan.startCX = event.clientX;
  pan.startCY = event.clientY;
  pan.startVX = view.x;
  pan.startVY = view.y;
  pan.moved = false;
  const canvas = document.getElementById('kmm-canvas');
  if (canvas) canvas.classList.add('is-panning');
}

function handleDocumentMouseMove(event) {
  if (!pan.active) return;
  const dx = event.clientX - pan.startCX;
  const dy = event.clientY - pan.startCY;
  if (!pan.moved && (Math.abs(dx) > PAN_DRAG_THRESHOLD || Math.abs(dy) > PAN_DRAG_THRESHOLD)) {
    pan.moved = true;
  }
  if (!pan.moved) return;
  const scale = svgScale();
  view.x = pan.startVX - dx / scale;
  view.y = pan.startVY - dy / scale;
  applyView();
}

function handleDocumentMouseUp() {
  if (!pan.active) return;
  pan.active = false;
  // If user actually dragged, suppress the click that browsers fire on mouseup.
  pan.suppressClick = pan.moved;
  pan.moved = false;
  const canvas = document.getElementById('kmm-canvas');
  if (canvas) canvas.classList.remove('is-panning');
}

function handleCanvasWheel(event) {
  // Always handle the wheel ourselves so the page doesn't scroll under us.
  event.preventDefault();
  const factor = event.deltaY > 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
  zoomAt(event.clientX, event.clientY, factor);
}

function handleCanvasTouchStart(event) {
  pan.suppressClick = false;
  if (event.touches.length === 1) {
    // Single-finger drag — pan, but only if not on a node.
    const t = event.touches[0];
    const target = document.elementFromPoint(t.clientX, t.clientY);
    if (target && target.closest('[data-action]')) return;
    pan.active = true;
    pan.startCX = t.clientX;
    pan.startCY = t.clientY;
    pan.startVX = view.x;
    pan.startVY = view.y;
    pan.moved = false;
  } else if (event.touches.length === 2) {
    pan.active = false;
    pinch.active = true;
    const t1 = event.touches[0];
    const t2 = event.touches[1];
    pinch.startDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    pinch.startView = { ...view };
    const midX = (t1.clientX + t2.clientX) / 2;
    const midY = (t1.clientY + t2.clientY) / 2;
    pinch.anchorSVG = clientToSVG(midX, midY);
    event.preventDefault();
  }
}

function handleCanvasTouchMove(event) {
  if (event.touches.length === 1 && pan.active) {
    const t = event.touches[0];
    const dx = t.clientX - pan.startCX;
    const dy = t.clientY - pan.startCY;
    if (!pan.moved && (Math.abs(dx) > PAN_DRAG_THRESHOLD || Math.abs(dy) > PAN_DRAG_THRESHOLD)) {
      pan.moved = true;
    }
    if (!pan.moved) return;
    event.preventDefault();
    const scale = svgScale();
    view.x = pan.startVX - dx / scale;
    view.y = pan.startVY - dy / scale;
    applyView();
  } else if (event.touches.length === 2 && pinch.active) {
    event.preventDefault();
    const t1 = event.touches[0];
    const t2 = event.touches[1];
    const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
    if (dist <= 0 || pinch.startDist <= 0) return;
    // Bigger finger gap → zoom in → smaller viewBox.
    // Dampen by sqrt so the same finger spread produces half the zoom change.
    const rawFactor = pinch.startDist / dist;
    const factor = Math.pow(rawFactor, 0.5);
    const newW = clampViewWidth(pinch.startView.w * factor);
    const ratio = newW / pinch.startView.w;
    view.w = newW;
    view.h = INITIAL_VIEW.h * (newW / INITIAL_VIEW.w);
    view.x = pinch.anchorSVG.x - (pinch.anchorSVG.x - pinch.startView.x) * ratio;
    view.y = pinch.anchorSVG.y - (pinch.anchorSVG.y - pinch.startView.y) * ratio;
    applyView();
  }
}

function handleCanvasTouchEnd(event) {
  if (event.touches.length === 0) {
    if (pan.active) {
      pan.suppressClick = pan.moved;
      pan.moved = false;
    }
    pan.active = false;
    pinch.active = false;
  } else if (event.touches.length === 1 && pinch.active) {
    // Lifted one finger from a pinch — stop pinch but don't auto-start pan.
    pinch.active = false;
  }
}

function handleZoomControlClick(event) {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'zoom-in') zoomCenter(1 / ZOOM_STEP);
  else if (action === 'zoom-out') zoomCenter(ZOOM_STEP);
  else if (action === 'zoom-reset') resetView();
}

/* ---------- Panel click handling ---------- */

function handlePanelClick(event) {
  const actionEl = event.target.closest('[data-action]');
  if (!actionEl) return;
  const action = actionEl.dataset.action;

  // Selection from list
  if (action === 'select-l2-from-panel') {
    const id = actionEl.dataset.id;
    selectNode({ level: 'l2', pillar: selection.pillar, l2Id: id, l3Id: null, l4Id: null });
    return;
  }
  if (action === 'select-l3-from-panel') {
    const id = actionEl.dataset.id;
    selectNode({ level: 'l3', pillar: selection.pillar, l2Id: selection.l2Id, l3Id: id, l4Id: null });
    return;
  }
  if (action === 'select-l4-from-panel') {
    if (event.target.matches('input[type="checkbox"]')) return; // checkbox handled by change
    const id = actionEl.dataset.id;
    selection = { ...selection, level: 'l4', l4Id: id };
    pendingEdit = null;
    pendingAdd = null;
    renderAll();
    return;
  }

  // Add flows
  if (action === 'start-add-l2') {
    pendingAdd = { kind: 'l2', pillar: selection.pillar };
    pendingEdit = null;
    panelFocusKey = 'data-add-input="l2-input"';
    renderPanel();
    return;
  }
  if (action === 'start-add-l3') {
    pendingAdd = { kind: 'l3', l2Id: selection.l2Id };
    pendingEdit = null;
    panelFocusKey = 'data-add-input="l3-input"';
    renderPanel();
    return;
  }
  if (action === 'start-add-l4') {
    pendingAdd = { kind: 'l4', l3Id: selection.l3Id };
    pendingEdit = null;
    panelFocusKey = 'data-add-input="l4-input"';
    renderPanel();
    return;
  }
  if (action === 'cancel-add') {
    pendingAdd = null;
    renderPanel();
    return;
  }

  // Edit flows
  if (action === 'start-edit-l2') return startEdit('l2', selection.l2Id);
  if (action === 'start-edit-l3') return startEdit('l3', selection.l3Id);
  if (action === 'start-edit-l4') return startEdit('l4', selection.l4Id);

  // Delete flows
  if (action === 'delete-l2') return openDeleteModal('l2', selection.l2Id);
  if (action === 'delete-l3') return openDeleteModal('l3', selection.l3Id);
  if (action === 'delete-l4') return openDeleteModal('l4', selection.l4Id);
}

function startEdit(level, id) {
  if (!id) return;
  pendingEdit = { level, id };
  pendingAdd = null;
  panelFocusKey = 'data-edit-input';
  renderPanel();
}

function handlePanelChange(event) {
  const t = event.target;
  if (t.matches('[data-field="completed"]')) {
    handleToggleCompleted(t.dataset.id, t.checked);
    return;
  }
  if (t.matches('[data-field="description"]')) {
    handleSaveDescription(t.dataset.id, t.value || '');
  }
}

function handlePanelKeydown(event) {
  const t = event.target;

  if (t.matches('[data-add-input]')) {
    if (event.key === 'Enter') {
      event.preventDefault();
      t.dataset.skipNextBlur = '1';
      handleConfirmAdd((t.value || '').trim());
    } else if (event.key === 'Escape') {
      event.preventDefault();
      pendingAdd = null;
      renderPanel();
    }
    return;
  }

  if (t.matches('[data-edit-input]')) {
    if (event.key === 'Enter') {
      event.preventDefault();
      t.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      pendingEdit = null;
      renderPanel();
    }
    return;
  }

  if (t.matches('[data-field="description"]') && event.key === 'Escape') {
    event.preventDefault();
    t.blur();
  }
}

function handlePanelFocusOut(event) {
  const t = event.target;

  if (t.matches('[data-add-input]')) {
    if (t.dataset.skipNextBlur === '1') { delete t.dataset.skipNextBlur; return; }
    handleConfirmAdd((t.value || '').trim());
    return;
  }

  if (t.matches('[data-edit-input]')) {
    const name = (t.value || '').trim();
    if (!name) {
      pendingEdit = null;
      renderPanel();
      return;
    }
    handleConfirmEdit(name);
    return;
  }

  if (t.matches('[data-field="description"]')) {
    handleSaveDescription(t.dataset.id, t.value || '');
  }
}

/* ---------- Mutations ---------- */

async function handleConfirmAdd(name) {
  if (!pendingAdd) return;
  if (!name) { pendingAdd = null; renderPanel(); return; }

  try {
    if (pendingAdd.kind === 'l2') {
      const pillar = pendingAdd.pillar || selection.pillar;
      if (!pillar) return;
      const siblings = getL2(pillar);
      const newNode = { id: createChildId(null, siblings), name, children: [] };
      siblings.push(newNode);
      tree[pillar] = siblings;
      await set(child(dataRef, pillar), siblings);
      selection = { level: 'l2', pillar, l2Id: newNode.id, l3Id: null, l4Id: null };
    } else if (pendingAdd.kind === 'l3') {
      const pillar = selection.pillar;
      const l2Index = getL2Index(pillar, pendingAdd.l2Id || selection.l2Id);
      if (l2Index === -1) return;
      const parent = tree[pillar][l2Index];
      const siblings = normalizeList(parent.children);
      const newNode = { id: createChildId(parent.id, siblings), name, children: [] };
      siblings.push(newNode);
      tree[pillar][l2Index].children = siblings;
      await set(child(dataRef, `${pillar}/${l2Index}/children`), siblings);
      selection = { level: 'l3', pillar, l2Id: parent.id, l3Id: newNode.id, l4Id: null };
    } else if (pendingAdd.kind === 'l4') {
      const pillar = selection.pillar;
      const l2Index = getL2Index(pillar, selection.l2Id);
      const l3Index = getL3Index(pillar, selection.l2Id, pendingAdd.l3Id || selection.l3Id);
      if (l2Index === -1 || l3Index === -1) return;
      const parent = tree[pillar][l2Index].children[l3Index];
      const siblings = normalizeList(parent.children);
      const newNode = { id: createChildId(parent.id, siblings), name, description: '', completed: false };
      siblings.push(newNode);
      tree[pillar][l2Index].children[l3Index].children = siblings;
      await set(child(dataRef, `${pillar}/${l2Index}/children/${l3Index}/children`), siblings);
      selection = { level: 'l4', pillar, l2Id: selection.l2Id, l3Id: parent.id, l4Id: newNode.id };
    }
    pendingAdd = null;
    renderAll();
  } catch (err) {
    console.error('Failed to add:', err);
    alert('Could not add item. Please try again.');
  }
}

async function handleConfirmEdit(newName) {
  if (!pendingEdit) return;
  const { level, id } = pendingEdit;

  try {
    if (level === 'l2') {
      const pillar = selection.pillar;
      const idx = getL2Index(pillar, id);
      if (idx === -1) return;
      tree[pillar][idx].name = newName;
      await set(child(dataRef, `${pillar}/${idx}/name`), newName);
    } else if (level === 'l3') {
      const pillar = selection.pillar;
      const l2Idx = getL2Index(pillar, selection.l2Id);
      const l3Idx = getL3Index(pillar, selection.l2Id, id);
      if (l2Idx === -1 || l3Idx === -1) return;
      tree[pillar][l2Idx].children[l3Idx].name = newName;
      await set(child(dataRef, `${pillar}/${l2Idx}/children/${l3Idx}/name`), newName);
    } else if (level === 'l4') {
      const pillar = selection.pillar;
      const l2Idx = getL2Index(pillar, selection.l2Id);
      const l3Idx = getL3Index(pillar, selection.l2Id, selection.l3Id);
      const l4Idx = getL4Index(pillar, selection.l2Id, selection.l3Id, id);
      if (l2Idx === -1 || l3Idx === -1 || l4Idx === -1) return;
      tree[pillar][l2Idx].children[l3Idx].children[l4Idx].name = newName;
      await set(child(dataRef, `${pillar}/${l2Idx}/children/${l3Idx}/children/${l4Idx}/name`), newName);
    }
    pendingEdit = null;
    renderAll();
  } catch (err) {
    console.error('Failed to rename:', err);
    alert('Could not rename. Please try again.');
  }
}

async function handleToggleCompleted(taskId, completed) {
  if (!taskId) return;
  const pillar = selection.pillar;
  const l2Idx = getL2Index(pillar, selection.l2Id);
  const l3Idx = getL3Index(pillar, selection.l2Id, selection.l3Id);
  const l4Idx = getL4Index(pillar, selection.l2Id, selection.l3Id, taskId);
  if (l2Idx === -1 || l3Idx === -1 || l4Idx === -1) return;

  try {
    tree[pillar][l2Idx].children[l3Idx].children[l4Idx].completed = completed;
    await set(
      child(dataRef, `${pillar}/${l2Idx}/children/${l3Idx}/children/${l4Idx}/completed`),
      completed
    );
    renderAll();
  } catch (err) {
    console.error('Failed to toggle task:', err);
    alert('Could not update task. Please try again.');
  }
}

async function handleSaveDescription(taskId, value) {
  if (!taskId) return;
  const pillar = selection.pillar;
  const l2Idx = getL2Index(pillar, selection.l2Id);
  const l3Idx = getL3Index(pillar, selection.l2Id, selection.l3Id);
  const l4Idx = getL4Index(pillar, selection.l2Id, selection.l3Id, taskId);
  if (l2Idx === -1 || l3Idx === -1 || l4Idx === -1) return;
  try {
    tree[pillar][l2Idx].children[l3Idx].children[l4Idx].description = value;
    await set(
      child(dataRef, `${pillar}/${l2Idx}/children/${l3Idx}/children/${l4Idx}/description`),
      value
    );
  } catch (err) {
    console.error('Failed to save description:', err);
  }
}

/* ---------- Delete confirmation ---------- */

function openDeleteModal(level, id) {
  if (!id) return;
  const label = getNodeName(level, id);
  pendingDelete = { level, id };
  const body = document.getElementById('kmm-delete-modal-body');
  if (body) {
    const cascade = level === 'l4' ? 'This cannot be undone.' : 'This also removes all nested items under this branch.';
    body.textContent = `Delete "${label}"? ${cascade}`;
  }
  const modalEl = document.getElementById('kmm-delete-modal');
  if (modalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
  }
}

function closeDeleteModal() {
  pendingDelete = null;
  const modalEl = document.getElementById('kmm-delete-modal');
  if (modalEl && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
  }
}

async function confirmDelete() {
  if (!pendingDelete) return;
  const { level, id } = pendingDelete;
  closeDeleteModal();

  try {
    const pillar = selection.pillar;
    if (level === 'l2') {
      const idx = getL2Index(pillar, id);
      if (idx === -1) return;
      tree[pillar].splice(idx, 1);
      await set(child(dataRef, pillar), tree[pillar]);
      selection = { level: 'pillar', pillar, l2Id: null, l3Id: null, l4Id: null };
    } else if (level === 'l3') {
      const l2Idx = getL2Index(pillar, selection.l2Id);
      if (l2Idx === -1) return;
      const siblings = normalizeList(tree[pillar][l2Idx].children);
      const idx = siblings.findIndex(n => n.id === id);
      if (idx === -1) return;
      siblings.splice(idx, 1);
      tree[pillar][l2Idx].children = siblings;
      await set(child(dataRef, `${pillar}/${l2Idx}/children`), siblings);
      selection = { level: 'l2', pillar, l2Id: selection.l2Id, l3Id: null, l4Id: null };
    } else if (level === 'l4') {
      const l2Idx = getL2Index(pillar, selection.l2Id);
      const l3Idx = getL3Index(pillar, selection.l2Id, selection.l3Id);
      if (l2Idx === -1 || l3Idx === -1) return;
      const siblings = normalizeList(tree[pillar][l2Idx].children[l3Idx].children);
      const idx = siblings.findIndex(n => n.id === id);
      if (idx === -1) return;
      siblings.splice(idx, 1);
      tree[pillar][l2Idx].children[l3Idx].children = siblings;
      await set(child(dataRef, `${pillar}/${l2Idx}/children/${l3Idx}/children`), siblings);
      selection = { level: 'l3', pillar, l2Id: selection.l2Id, l3Id: selection.l3Id, l4Id: null };
    }
    renderAll();
  } catch (err) {
    console.error('Failed to delete:', err);
    alert('Could not delete. Please try again.');
  }
}

function getNodeName(level, id) {
  const pillar = selection.pillar;
  if (level === 'l2') return getL2(pillar).find(n => n.id === id)?.name || 'this item';
  if (level === 'l3') {
    const l2 = getL2Node(pillar, selection.l2Id);
    return (l2 ? normalizeList(l2.children).find(n => n.id === id) : null)?.name || 'this item';
  }
  if (level === 'l4') {
    const l2 = getL2Node(pillar, selection.l2Id);
    const l3 = l2 ? normalizeList(l2.children).find(n => n.id === selection.l3Id) : null;
    return (l3 ? normalizeList(l3.children).find(n => n.id === id) : null)?.name || 'this item';
  }
  return 'this item';
}

/* ---------- Selectors / progress ---------- */

function getL2(pillar) {
  if (!pillar) return [];
  if (!Array.isArray(tree[pillar])) tree[pillar] = [];
  return tree[pillar];
}

function getL2Node(pillar, l2Id) {
  if (!pillar || !l2Id) return null;
  return getL2(pillar).find(n => n.id === l2Id) || null;
}

function getL2Index(pillar, l2Id) {
  if (!pillar || !l2Id) return -1;
  return getL2(pillar).findIndex(n => n.id === l2Id);
}

function getL3Index(pillar, l2Id, l3Id) {
  const l2Idx = getL2Index(pillar, l2Id);
  if (l2Idx === -1 || !l3Id) return -1;
  return normalizeList(tree[pillar][l2Idx].children).findIndex(n => n.id === l3Id);
}

function getL4Index(pillar, l2Id, l3Id, l4Id) {
  const l2Idx = getL2Index(pillar, l2Id);
  const l3Idx = getL3Index(pillar, l2Id, l3Id);
  if (l2Idx === -1 || l3Idx === -1 || !l4Id) return -1;
  return normalizeList(tree[pillar][l2Idx].children[l3Idx].children).findIndex(n => n.id === l4Id);
}

function getPillarProgress(pillar) {
  const nodes = getL2(pillar);
  if (nodes.length === 0) return 0;
  return nodes.reduce((s, n) => s + getL2Progress(n), 0) / nodes.length;
}

function getL2Progress(l2) {
  const ch = normalizeList(l2.children);
  if (ch.length === 0) return 0;
  return ch.reduce((s, n) => s + getL3Progress(n), 0) / ch.length;
}

function getL3Progress(l3) {
  const ts = normalizeList(l3.children);
  if (ts.length === 0) return 0;
  const done = ts.filter(t => t.completed === true).length;
  return (done / ts.length) * 100;
}

function roundPct(p) { return Math.round(p); }

/* ---------- Data normalization (mirrors knight-os.js) ---------- */

function createInitialTree() {
  return { Health: [], Relationships: [], Finance: [], 'Career & Studies': [] };
}

function normalizeTree(raw) {
  const out = createInitialTree();
  PILLARS.forEach(p => { out[p] = normalizeL2(raw ? raw[p] : []); });
  return out;
}

function normalizeL2(value) {
  return normalizeList(value).map((n, i) => {
    const id = safeId(n.id, `${i + 1}`);
    return { id, name: n.name || `Item ${i + 1}`, children: normalizeL3(n.children, id) };
  });
}

function normalizeL3(value, parentId) {
  return normalizeList(value).map((n, i) => {
    const id = safeId(n.id, `${parentId}.${i + 1}`);
    return { id, name: n.name || `Item ${i + 1}`, children: normalizeL4(n.children, id) };
  });
}

function normalizeL4(value, parentId) {
  return normalizeList(value).map((n, i) => ({
    id: safeId(n.id, `${parentId}.${i + 1}`),
    name: n.name || `Item ${i + 1}`,
    description: n.description || '',
    completed: n.completed === true
  }));
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => v && typeof v === 'object');
  if (typeof value === 'object') {
    return Object.keys(value).sort((a, b) => Number(a) - Number(b))
      .map(k => value[k]).filter(v => v && typeof v === 'object');
  }
  return [];
}

function createChildId(parentId, siblings) {
  const max = siblings.reduce((m, s) => {
    const seg = lastNumericSegment(s.id);
    return Number.isFinite(seg) ? Math.max(m, seg) : m;
  }, 0);
  const next = max + 1;
  return parentId ? `${parentId}.${next}` : `${next}`;
}

function lastNumericSegment(id) {
  if (!id || typeof id !== 'string') return NaN;
  const parts = id.split('.');
  return parseInt(parts[parts.length - 1], 10);
}

function safeId(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/* ---------- Misc ---------- */

function showLoading(loading) {
  const loader = document.getElementById('kmm-loader');
  const content = document.getElementById('kmm-content');
  if (!loader || !content) return;
  loader.classList.toggle('d-none', !loading);
  content.classList.toggle('d-none', loading);
}

function tintColor(hex, opacity) {
  // Mix hex with white at given opacity (lower opacity = lighter tint)
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  const blend = (c) => Math.round(c * opacity + 255 * (1 - opacity));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(blend(r))}${toHex(blend(g))}${toHex(blend(b))}`;
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function editIcon() {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M11.207 1.793a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414L5.414 13.586a1 1 0 0 1-.485.263l-3 .75a.5.5 0 0 1-.606-.606l.75-3a1 1 0 0 1 .263-.485L11.207 1.793Z"/>
    </svg>
  `;
}

function deleteIcon() {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 1h4l1 1h3v2H2V2h3l1-1Zm-2 5h8l-.6 7.2A2 2 0 0 1 9.41 15H6.59a2 2 0 0 1-1.99-1.8L4 6Z"/>
    </svg>
  `;
}
