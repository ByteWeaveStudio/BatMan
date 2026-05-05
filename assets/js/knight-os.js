import { getCurrentYear, getGrowthTreeRef } from './auth.js';
import { child, get, set } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const PILLARS = ['Health', 'Relationships', 'Finance', 'Career & Studies'];
const PILLAR_THEME_KEYS = {
  Health: 'health',
  Relationships: 'relationships',
  Finance: 'finance',
  'Career & Studies': 'career'
};

let dataRef = null;
let tree = createInitialTree();
let selection = {
  pillar: null,
  level2Id: null,
  level3Id: null,
  level4Id: null
};
let uiState = {
  addingLevel: null,
  addingPillar: null,
  editingNode: null,
  focusSelector: null,
  pendingDelete: null
};

export async function initKnightOs() {
  dataRef = getGrowthTreeRef(getCurrentYear());

  bindEvents();
  setLoadingState(true);
  await loadTree();
}

function bindEvents() {
  const root = document.getElementById('knight-root');
  if (!root) return;

  root.addEventListener('click', handleClick);
  root.addEventListener('change', handleChange);
  root.addEventListener('keydown', handleKeydown);
  root.addEventListener('focusout', handleFocusOut);

  const deleteModal = document.getElementById('knight-delete-modal');
  if (deleteModal) {
    deleteModal.addEventListener('click', handleClick);
    deleteModal.addEventListener('hidden.bs.modal', () => {
      uiState.pendingDelete = null;
    });
  }
}

async function loadTree() {
  if (!dataRef) return;

  try {
    const snapshot = await get(dataRef);
    if (!snapshot.exists()) {
      tree = createInitialTree();
      await set(dataRef, tree);
    } else {
      tree = normalizeTree(snapshot.val());
      await ensurePillars();
    }

    renderUI();
  } catch (error) {
    console.error('Failed to load KnightOS:', error);
    const content = document.getElementById('knight-content');
    if (content) {
      content.innerHTML = '<div class="text-danger">Could not load. Please refresh.</div>';
    }
  } finally {
    setLoadingState(false);
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
  if (writes.length > 0) {
    await Promise.all(writes);
  }
}

/* ---------- Event handlers ---------- */

function handleClick(event) {
  const actionTarget = event.target.closest('[data-action]');
  if (actionTarget) {
    const action = actionTarget.dataset.action;
    const level = actionTarget.dataset.level ? parseInt(actionTarget.dataset.level, 10) : null;
    const pillar = actionTarget.dataset.pillar || null;
    const id = actionTarget.dataset.id || null;

    if (action === 'start-add') return startAddMode(level, pillar);
    if (action === 'cancel-add') return cancelAddMode();
    if (action === 'start-edit') return startNameEdit(level, id, pillar);
    if (action === 'delete-node') return openDeleteConfirmation(level, id, pillar);
    if (action === 'confirm-delete') return confirmDeleteNode();
    if (action === 'cancel-delete') return closeDeleteConfirmation();
  }

  const selectTarget = event.target.closest('[data-select-level]');
  if (!selectTarget) return;
  if (event.target.closest('input, textarea, button')) return;

  const level = parseInt(selectTarget.dataset.selectLevel, 10);
  const targetId = selectTarget.dataset.id;
  const targetPillar = selectTarget.dataset.pillar || null;

  // If user is mid add/edit, fall back to a clean full re-render so we
  // tear down inputs consistently. Otherwise do targeted DOM updates so
  // cards under the user's gaze stay stable.
  const wasInTransientUi = uiState.addingLevel !== null || uiState.editingNode !== null;

  if (level === 2) {
    const newPillar = targetPillar || selection.pillar;
    if (selection.pillar === newPillar && selection.level2Id === targetId && !wasInTransientUi) {
      return;
    }
    selection.pillar = newPillar;
    selection.level2Id = targetId;
    selection.level3Id = null;
    selection.level4Id = null;
    resetTransientUiState();
    if (wasInTransientUi) {
      renderUI();
    } else {
      applyLevel2SelectionUpdate();
    }
  } else if (level === 3) {
    if (selection.level3Id === targetId && !wasInTransientUi) return;
    selection.level3Id = targetId;
    selection.level4Id = null;
    resetTransientUiState();
    if (wasInTransientUi) {
      renderUI();
    } else {
      applyLevel3SelectionUpdate();
    }
  } else if (level === 4) {
    if (selection.level4Id === targetId && !wasInTransientUi) return;
    selection.level4Id = targetId;
    resetTransientUiState();
    if (wasInTransientUi) {
      renderUI();
    } else {
      applyLevel4SelectionUpdate();
    }
  }
}

function handleChange(event) {
  const target = event.target;

  if (target.matches('[data-field="completed"]')) {
    handleToggleCompletion(target.dataset.id, target.checked);
    return;
  }

  if (target.matches('[data-field="description"]')) {
    handleSaveDescription(target.dataset.id, target.value || '');
  }
}

async function handleToggleCompletion(nodeId, completed) {
  if (!dataRef) return;
  const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
  const level3Index = getLevel3Index(selection.pillar, selection.level2Id, selection.level3Id);
  const level4Index = getLevel4Index(selection.pillar, selection.level2Id, selection.level3Id, nodeId);
  if (level2Index === -1 || level3Index === -1 || level4Index === -1) return;

  try {
    tree[selection.pillar][level2Index].children[level3Index].children[level4Index].completed = completed;
    await set(
      child(dataRef, `${selection.pillar}/${level2Index}/children/${level3Index}/children/${level4Index}/completed`),
      completed
    );

    const row = document.querySelector(
      `[data-select-level="4"][data-id="${escapeSelectorValue(nodeId)}"]`
    );
    if (row) row.classList.toggle('completed', completed);

    if (selection.level4Id === nodeId) {
      const label = document.querySelector('[data-card-key="detail"] .knight-detail-status-label');
      if (label) label.textContent = completed ? 'Completed' : 'Mark as complete';
    }

    refreshPillarCard(selection.pillar);
    refreshL3Card();
  } catch (error) {
    console.error('Failed to toggle completion:', error);
    alert('Could not update item. Please try again.');
  }
}

async function handleSaveDescription(nodeId, value) {
  if (!dataRef) return;
  const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
  const level3Index = getLevel3Index(selection.pillar, selection.level2Id, selection.level3Id);
  const level4Index = getLevel4Index(selection.pillar, selection.level2Id, selection.level3Id, nodeId);
  if (level2Index === -1 || level3Index === -1 || level4Index === -1) return;

  try {
    tree[selection.pillar][level2Index].children[level3Index].children[level4Index].description = value;
    await set(
      child(dataRef, `${selection.pillar}/${level2Index}/children/${level3Index}/children/${level4Index}/description`),
      value
    );
  } catch (error) {
    console.error('Failed to save description:', error);
  }
}

function handleKeydown(event) {
  const target = event.target;

  if (target.matches('[data-add-input-level]')) {
    const level = parseInt(target.dataset.addInputLevel, 10);
    if (event.key === 'Enter') {
      event.preventDefault();
      target.dataset.skipNextBlur = '1';
      handleAddNode(level, target.value.trim(), target.dataset.pillar || null);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelAddMode();
    }
    return;
  }

  if (target.matches('[data-edit-input="name"]')) {
    if (event.key === 'Enter') {
      event.preventDefault();
      target.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelNameEdit();
    }
    return;
  }

  if (target.matches('[data-field="description"]') && event.key === 'Escape') {
    event.preventDefault();
    target.blur();
  }
}

function handleFocusOut(event) {
  const target = event.target;

  if (target.matches('[data-add-input-level]')) {
    if (target.dataset.skipNextBlur === '1') {
      delete target.dataset.skipNextBlur;
      return;
    }
    const level = parseInt(target.dataset.addInputLevel, 10);
    handleAddNode(level, target.value.trim(), target.dataset.pillar || null);
    return;
  }

  if (target.matches('[data-edit-input="name"]')) {
    const level = parseInt(target.dataset.level, 10);
    const nodeId = target.dataset.id;
    const name = (target.value || '').trim();
    if (!name) {
      cancelNameEdit();
      return;
    }
    handleUpdateNode(level, nodeId, 'name', name, target.dataset.pillar || null);
    return;
  }

  if (target.matches('[data-field="description"]')) {
    handleSaveDescription(target.dataset.id, target.value || '');
  }
}

/* ---------- Render ---------- */

function renderUI() {
  const pillarsContainer = document.getElementById('knight-pillars');
  if (!pillarsContainer) return;

  pillarsContainer.innerHTML = PILLARS.map(renderPillarCard).join('');
  rebuildDetailSection({ animate: false });
  applyPendingFocus();
}

/**
 * Rebuilds the entire detail row from current selection (used on full
 * re-render and when L2 selection changes).
 */
function rebuildDetailSection({ animate = false } = {}) {
  const detail = document.getElementById('knight-detail');
  if (!detail) return;

  const cards = [];
  const l2 = getSelectedLevel2Node();
  if (l2) cards.push(renderLevel3Card(l2, { animate }));
  const l3 = getSelectedLevel3Node();
  if (l3) cards.push(renderLevel4Card(l3, { animate }));
  const l4 = getSelectedLevel4Node();
  if (l4) cards.push(renderLevel4DetailCard(l4, { animate }));

  detail.innerHTML = cards.join('');
  detail.classList.toggle('is-visible', cards.length > 0);
}

/* ---------- Targeted DOM updates ---------- */

function htmlToElement(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = (html || '').trim();
  return tmp.firstElementChild;
}

function refreshPillarCard(pillar) {
  const existing = document.querySelector(`[data-card-pillar="${escapeSelectorValue(pillar)}"]`);
  if (!existing) return;
  const newEl = htmlToElement(renderPillarCard(pillar));
  if (newEl) existing.replaceWith(newEl);
}

function refreshL3Card() {
  const detail = document.getElementById('knight-detail');
  if (!detail) return;
  const existing = detail.querySelector('[data-card-key="level3"]');
  const l2Node = getSelectedLevel2Node();
  if (!l2Node) {
    if (existing) existing.remove();
    return;
  }
  const newEl = htmlToElement(renderLevel3Card(l2Node, { animate: false }));
  if (!newEl) return;
  if (existing) {
    existing.replaceWith(newEl);
  } else {
    detail.appendChild(newEl);
  }
  detail.classList.add('is-visible');
}

function applyLevel2SelectionUpdate() {
  document.querySelectorAll('[data-card-pillar]').forEach((card) => {
    card.classList.toggle('selected', card.dataset.cardPillar === selection.pillar);
  });
  document.querySelectorAll('[data-select-level="2"]').forEach((el) => {
    el.classList.toggle(
      'selected',
      el.dataset.pillar === selection.pillar && el.dataset.id === selection.level2Id
    );
  });
  rebuildDetailSection({ animate: true });
}

function applyLevel3SelectionUpdate() {
  document.querySelectorAll('[data-select-level="3"]').forEach((el) => {
    el.classList.toggle('selected', el.dataset.id === selection.level3Id);
  });

  const detail = document.getElementById('knight-detail');
  if (!detail) return;

  const existingL4 = detail.querySelector('[data-card-key="level4"]');
  const l3Node = getSelectedLevel3Node();
  if (l3Node) {
    const newEl = htmlToElement(renderLevel4Card(l3Node, { animate: !existingL4 }));
    if (existingL4) {
      existingL4.replaceWith(newEl);
    } else if (newEl) {
      detail.appendChild(newEl);
    }
  } else if (existingL4) {
    existingL4.remove();
  }

  detail.querySelector('[data-card-key="detail"]')?.remove();
  detail.classList.toggle('is-visible', detail.children.length > 0);
}

function applyLevel4SelectionUpdate() {
  document.querySelectorAll('[data-select-level="4"]').forEach((el) => {
    el.classList.toggle('selected', el.dataset.id === selection.level4Id);
  });

  const detail = document.getElementById('knight-detail');
  if (!detail) return;

  const existingDetail = detail.querySelector('[data-card-key="detail"]');
  const l4Node = getSelectedLevel4Node();
  if (l4Node) {
    const newEl = htmlToElement(renderLevel4DetailCard(l4Node, { animate: !existingDetail }));
    if (existingDetail) {
      existingDetail.replaceWith(newEl);
    } else if (newEl) {
      detail.appendChild(newEl);
    }
  } else if (existingDetail) {
    existingDetail.remove();
  }

  detail.classList.toggle('is-visible', detail.children.length > 0);
}

/**
 * L2 (top row) pillar card.
 * Header: pillar name + overall progress + add button.
 * Body: list of L2 items (selection only, no inline edit/delete).
 */
function renderPillarCard(pillar) {
  const level2Nodes = getLevel2Nodes(pillar);
  const themeClass = getPillarThemeClass(pillar);
  const isCardSelected = selection.pillar === pillar;
  const progress = roundProgress(getPillarProgress(pillar));

  const items = level2Nodes.length === 0
    ? renderEmptyState('No items yet', 2, 'Add your first one', pillar)
    : level2Nodes.map((node) => {
      const selectedClass = selection.pillar === pillar && selection.level2Id === node.id ? 'selected' : '';
      const itemProgress = roundProgress(getLevel2Progress(node));
      return `
        <div class="knight-node knight-node-selectable ${selectedClass}"
             data-select-level="2"
             data-pillar="${escapeAttr(pillar)}"
             data-id="${escapeAttr(node.id)}">
          <div class="knight-node-row">
            <span class="knight-node-title">${escapeHtml(node.name)}</span>
            <span class="knight-node-meta">${itemProgress}%</span>
          </div>
          ${renderProgressBar(itemProgress)}
        </div>
      `;
    }).join('');

  const isAdding = uiState.addingLevel === 2 && uiState.addingPillar === pillar;

  return `
    <section class="knight-card knight-card-fixed knight-themed ${themeClass} ${isCardSelected ? 'selected' : ''}"
             data-card-pillar="${escapeAttr(pillar)}">
      <header class="knight-card-header">
        <div class="knight-card-title-row">
          <h6 class="knight-card-title">${escapeHtml(pillar)}</h6>
          <span class="knight-card-meta">${progress}%</span>
        </div>
        ${renderProgressBar(progress)}
        <div class="knight-card-actions">
          <button type="button" class="btn btn-sm btn-outline-primary knight-add-btn"
                  data-action="start-add" data-level="2" data-pillar="${escapeAttr(pillar)}">
            + Add
          </button>
        </div>
      </header>
      <div class="knight-card-body">
        ${items}
        ${renderAddRow(2, isAdding, pillar)}
      </div>
    </section>
  `;
}

/**
 * L3 card. Header is the SELECTED L2 item, with edit/delete/add for it.
 * Body is the L3 list (selection only).
 */
function renderLevel3Card(level2Node, opts = {}) {
  const themeClass = getPillarThemeClass(selection.pillar);
  const children = normalizeList(level2Node.children);
  const isAdding = uiState.addingLevel === 3;
  const isEditingHeader = isEditingNode(2, level2Node.id, selection.pillar);

  const items = children.length === 0
    ? renderEmptyState('No items yet', 3, 'Add your first one')
    : children.map((node) => {
      const selectedClass = selection.level3Id === node.id ? 'selected' : '';
      const itemProgress = roundProgress(getLevel3Progress(node));
      return `
        <div class="knight-node knight-node-selectable ${selectedClass}"
             data-select-level="3"
             data-id="${escapeAttr(node.id)}">
          <div class="knight-node-row">
            <span class="knight-node-title">${escapeHtml(node.name)}</span>
            <span class="knight-node-meta">${itemProgress}%</span>
          </div>
          ${renderProgressBar(itemProgress)}
        </div>
      `;
    }).join('');

  return renderHeaderedCard({
    cardKey: 'level3',
    themeClass,
    headerTitle: level2Node.name,
    breadcrumb: selection.pillar,
    isEditingHeader,
    editLevel: 2,
    editId: level2Node.id,
    editPillar: selection.pillar,
    showAdd: true,
    addLevel: 3,
    animate: opts.animate === true,
    body: `
      ${items}
      ${renderAddRow(3, isAdding)}
    `
  });
}

/**
 * L4 card. Header is the SELECTED L3 item, with edit/delete/add for it.
 * Body is L4 list (checkboxes for completion, no inline edit/delete).
 */
function renderLevel4Card(level3Node, opts = {}) {
  const themeClass = getPillarThemeClass(selection.pillar);
  const tasks = normalizeList(level3Node.children);
  const isAdding = uiState.addingLevel === 4;
  const isEditingHeader = isEditingNode(3, level3Node.id);

  const items = tasks.length === 0
    ? renderEmptyState('No items yet', 4, 'Add your first one')
    : tasks.map((task) => {
      const selectedClass = selection.level4Id === task.id ? 'selected' : '';
      const completedClass = task.completed ? 'completed' : '';
      return `
        <div class="knight-node knight-node-selectable ${selectedClass} ${completedClass}"
             data-select-level="4"
             data-id="${escapeAttr(task.id)}">
          <div class="knight-node-row">
            <input type="checkbox"
                   class="form-check-input knight-node-check"
                   data-field="completed"
                   data-id="${escapeAttr(task.id)}"
                   ${task.completed ? 'checked' : ''}>
            <span class="knight-node-title">${escapeHtml(task.name)}</span>
          </div>
        </div>
      `;
    }).join('');

  const breadcrumb = `${selection.pillar} > ${getSelectedLevel2Node()?.name || ''}`;

  return renderHeaderedCard({
    cardKey: 'level4',
    themeClass,
    headerTitle: level3Node.name,
    breadcrumb,
    isEditingHeader,
    editLevel: 3,
    editId: level3Node.id,
    showAdd: true,
    addLevel: 4,
    animate: opts.animate === true,
    body: `
      ${items}
      ${renderAddRow(4, isAdding)}
    `
  });
}

/**
 * Detail card for selected L4 item.
 * Header has edit/delete for the L4 item; body has completion + description.
 */
function renderLevel4DetailCard(item, opts = {}) {
  const themeClass = getPillarThemeClass(selection.pillar);
  const isEditingHeader = isEditingNode(4, item.id);
  const breadcrumb = `${selection.pillar} > ${getSelectedLevel2Node()?.name || ''} > ${getSelectedLevel3Node()?.name || ''}`;

  return renderHeaderedCard({
    cardKey: 'detail',
    themeClass,
    headerTitle: item.name,
    breadcrumb,
    isEditingHeader,
    editLevel: 4,
    editId: item.id,
    showAdd: false,
    detail: true,
    animate: opts.animate === true,
    body: `
      <label class="knight-detail-status">
        <input type="checkbox"
               class="form-check-input"
               data-field="completed"
               data-id="${escapeAttr(item.id)}"
               ${item.completed ? 'checked' : ''}>
        <span class="knight-detail-status-label">${item.completed ? 'Completed' : 'Mark as complete'}</span>
      </label>
      <label class="knight-detail-desc-label" for="knight-detail-desc-${escapeAttr(item.id)}">Description</label>
      <textarea id="knight-detail-desc-${escapeAttr(item.id)}"
                class="form-control knight-detail-desc"
                rows="14"
                data-field="description"
                data-id="${escapeAttr(item.id)}"
                placeholder="Add details, context, or steps for this item...">${escapeHtml(item.description || '')}</textarea>
    `
  });
}

function renderHeaderedCard({
  cardKey,
  themeClass,
  headerTitle,
  breadcrumb,
  isEditingHeader,
  editLevel,
  editId,
  editPillar = null,
  showAdd = false,
  addLevel = null,
  detail = false,
  body,
  animate = false
}) {
  const cardClass = detail ? 'knight-card knight-card-detail' : 'knight-card knight-card-fixed';
  const bodyClass = detail ? 'knight-card-body knight-detail-body' : 'knight-card-body';
  const pillarAttr = editPillar ? `data-pillar="${escapeAttr(editPillar)}"` : '';
  const animateClass = animate ? ' knight-enter' : '';

  const headerTitleHtml = isEditingHeader
    ? `<input type="text"
              class="form-control form-control-sm knight-edit-input"
              value="${escapeAttr(headerTitle)}"
              data-edit-input="name"
              data-level="${editLevel}"
              data-id="${escapeAttr(editId)}"
              ${pillarAttr}>`
    : `<h6 class="knight-card-title">${escapeHtml(headerTitle)}</h6>`;

  return `
    <section class="${cardClass} knight-themed ${themeClass}${animateClass}"
             data-card-key="${cardKey}">
      <header class="knight-card-header">
        ${breadcrumb ? `<p class="knight-breadcrumb">${escapeHtml(breadcrumb)}</p>` : ''}
        <div class="knight-card-title-row">
          ${headerTitleHtml}
          <div class="knight-header-actions">
            <button type="button" class="knight-icon-btn"
                    data-action="start-edit"
                    data-level="${editLevel}"
                    data-id="${escapeAttr(editId)}"
                    ${pillarAttr}
                    title="Rename" aria-label="Rename">
              ${renderEditIcon()}
            </button>
            <button type="button" class="knight-icon-btn knight-icon-btn-danger"
                    data-action="delete-node"
                    data-level="${editLevel}"
                    data-id="${escapeAttr(editId)}"
                    ${pillarAttr}
                    title="Delete" aria-label="Delete">
              ${renderDeleteIcon()}
            </button>
          </div>
        </div>
        ${showAdd ? `
          <div class="knight-card-actions">
            <button type="button" class="btn btn-sm btn-outline-primary knight-add-btn"
                    data-action="start-add" data-level="${addLevel}">
              + Add
            </button>
          </div>
        ` : ''}
      </header>
      <div class="${bodyClass}">${body}</div>
    </section>
  `;
}

function renderAddRow(level, isAdding, pillar = null) {
  if (!isAdding) return '';
  return `
    <div class="knight-add-row">
      <input type="text"
             class="form-control form-control-sm knight-add-input"
             placeholder="Type name and press Enter"
             data-add-input-level="${level}"
             ${pillar ? `data-pillar="${escapeAttr(pillar)}"` : ''}>
      <button type="button" class="btn btn-sm btn-outline-secondary"
              data-action="cancel-add">Cancel</button>
    </div>
  `;
}

function renderEmptyState(text, level, ctaLabel, pillar = null) {
  return `
    <div class="knight-empty-state">
      <p class="mb-2">${escapeHtml(text)}</p>
      <button type="button" class="btn btn-sm btn-outline-primary"
              data-action="start-add" data-level="${level}"
              ${pillar ? `data-pillar="${escapeAttr(pillar)}"` : ''}>+ ${escapeHtml(ctaLabel)}</button>
    </div>
  `;
}

function renderProgressBar(progress) {
  let colorClass = 'is-low';
  if (progress >= 70) colorClass = 'is-high';
  else if (progress >= 35) colorClass = 'is-medium';

  return `
    <div class="progress knight-progress">
      <div class="progress-bar ${colorClass}"
           role="progressbar"
           style="width: ${progress}%;"
           aria-valuenow="${progress}" aria-valuemin="0" aria-valuemax="100"></div>
    </div>
  `;
}

function renderEditIcon() {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M11.207 1.793a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414L5.414 13.586a1 1 0 0 1-.485.263l-3 .75a.5.5 0 0 1-.606-.606l.75-3a1 1 0 0 1 .263-.485L11.207 1.793Zm.707 1.414L3.5 11.621l-.5 2 2-.5 8.414-8.414-1.5-1.5Z"/>
    </svg>
  `;
}

function renderDeleteIcon() {
  return `
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path d="M6 1h4l1 1h3v2H2V2h3l1-1Zm-2 5h8l-.6 7.2A2 2 0 0 1 9.41 15H6.59a2 2 0 0 1-1.99-1.8L4 6Zm2 1.25c-.41 0-.75.34-.75.75v4c0 .41.34.75.75.75s.75-.34.75-.75V8c0-.41-.34-.75-.75-.75Zm4 0c-.41 0-.75.34-.75.75v4c0 .41.34.75.75.75s.75-.34.75-.75V8c0-.41-.34-.75-.75-.75Z"/>
    </svg>
  `;
}

/* ---------- Mutations ---------- */

async function handleAddNode(level, name, pillarOverride = null) {
  if (!dataRef) return;
  if (!name) return cancelAddMode();

  try {
    if (level === 2) {
      const pillar = pillarOverride || uiState.addingPillar || selection.pillar;
      if (!pillar) return;
      const siblings = getLevel2Nodes(pillar);
      const newNode = { id: createChildId(null, siblings), name, children: [] };
      siblings.push(newNode);
      tree[pillar] = siblings;
      await set(child(dataRef, pillar), siblings);
      selection.pillar = pillar;
      selection.level2Id = newNode.id;
      selection.level3Id = null;
      selection.level4Id = null;
    } else if (level === 3) {
      const level2Node = getSelectedLevel2Node();
      const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
      if (!level2Node || level2Index === -1) return;
      const siblings = normalizeList(level2Node.children);
      const newNode = { id: createChildId(level2Node.id, siblings), name, children: [] };
      siblings.push(newNode);
      tree[selection.pillar][level2Index].children = siblings;
      await set(child(dataRef, `${selection.pillar}/${level2Index}/children`), siblings);
      selection.level3Id = newNode.id;
      selection.level4Id = null;
    } else if (level === 4) {
      const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
      const level3Index = getLevel3Index(selection.pillar, selection.level2Id, selection.level3Id);
      const level3Node = getSelectedLevel3Node();
      if (level2Index === -1 || level3Index === -1 || !level3Node) return;
      const siblings = normalizeList(level3Node.children);
      const newNode = { id: createChildId(level3Node.id, siblings), name, description: '', completed: false };
      siblings.push(newNode);
      tree[selection.pillar][level2Index].children[level3Index].children = siblings;
      await set(child(dataRef, `${selection.pillar}/${level2Index}/children/${level3Index}/children`), siblings);
      selection.level4Id = newNode.id;
    }

    cancelAddMode(false);
    renderUI();
  } catch (error) {
    console.error('Failed to add node:', error);
    alert('Could not add item. Please try again.');
  }
}

async function handleDeleteNode(level, nodeId, pillarOverride = null) {
  if (!dataRef) return;

  try {
    if (level === 2) {
      const pillar = pillarOverride || selection.pillar;
      if (!pillar) return;
      const siblings = getLevel2Nodes(pillar);
      const index = siblings.findIndex((n) => n.id === nodeId);
      if (index === -1) return;
      siblings.splice(index, 1);
      tree[pillar] = siblings;
      await set(child(dataRef, pillar), siblings);
      if (selection.pillar === pillar && selection.level2Id === nodeId) {
        selection.level2Id = null;
        selection.level3Id = null;
        selection.level4Id = null;
      }
    } else if (level === 3) {
      const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
      if (level2Index === -1) return;
      const siblings = normalizeList(tree[selection.pillar][level2Index].children);
      const index = siblings.findIndex((n) => n.id === nodeId);
      if (index === -1) return;
      siblings.splice(index, 1);
      tree[selection.pillar][level2Index].children = siblings;
      await set(child(dataRef, `${selection.pillar}/${level2Index}/children`), siblings);
      if (selection.level3Id === nodeId) {
        selection.level3Id = null;
        selection.level4Id = null;
      }
    } else if (level === 4) {
      const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
      const level3Index = getLevel3Index(selection.pillar, selection.level2Id, selection.level3Id);
      if (level2Index === -1 || level3Index === -1) return;
      const siblings = normalizeList(tree[selection.pillar][level2Index].children[level3Index].children);
      const index = siblings.findIndex((n) => n.id === nodeId);
      if (index === -1) return;
      siblings.splice(index, 1);
      tree[selection.pillar][level2Index].children[level3Index].children = siblings;
      await set(child(dataRef, `${selection.pillar}/${level2Index}/children/${level3Index}/children`), siblings);
      if (selection.level4Id === nodeId) {
        selection.level4Id = null;
      }
    }

    renderUI();
  } catch (error) {
    console.error('Failed to delete node:', error);
    alert('Could not delete item. Please try again.');
  }
}

async function handleUpdateNode(level, nodeId, field, value, pillarOverride = null) {
  if (!dataRef || field !== 'name') return;

  try {
    if (level === 2) {
      const pillar = pillarOverride || selection.pillar;
      if (!pillar) return;
      const level2Index = getLevel2Index(pillar, nodeId);
      if (level2Index === -1) return;
      tree[pillar][level2Index].name = value;
      await set(child(dataRef, `${pillar}/${level2Index}/name`), value);
    } else if (level === 3) {
      const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
      const level3Index = getLevel3Index(selection.pillar, selection.level2Id, nodeId);
      if (level2Index === -1 || level3Index === -1) return;
      tree[selection.pillar][level2Index].children[level3Index].name = value;
      await set(child(dataRef, `${selection.pillar}/${level2Index}/children/${level3Index}/name`), value);
    } else if (level === 4) {
      const level2Index = getLevel2Index(selection.pillar, selection.level2Id);
      const level3Index = getLevel3Index(selection.pillar, selection.level2Id, selection.level3Id);
      const level4Index = getLevel4Index(selection.pillar, selection.level2Id, selection.level3Id, nodeId);
      if (level2Index === -1 || level3Index === -1 || level4Index === -1) return;
      tree[selection.pillar][level2Index].children[level3Index].children[level4Index].name = value;
      await set(
        child(dataRef, `${selection.pillar}/${level2Index}/children/${level3Index}/children/${level4Index}/name`),
        value
      );
    }

    uiState.editingNode = null;
    renderUI();
  } catch (error) {
    console.error('Failed to update node:', error);
    alert('Could not update item. Please try again.');
  }
}

/* ---------- UI state helpers ---------- */

function startAddMode(level, pillar = null) {
  uiState.addingLevel = level;
  uiState.addingPillar = level === 2 ? pillar : null;
  uiState.focusSelector = pillar
    ? `[data-add-input-level="${level}"][data-pillar="${escapeSelectorValue(pillar)}"]`
    : `[data-add-input-level="${level}"]`;
  renderUI();
}

function cancelAddMode(shouldRender = true) {
  uiState.addingLevel = null;
  uiState.addingPillar = null;
  uiState.focusSelector = null;
  if (shouldRender) renderUI();
}

function startNameEdit(level, id, pillar = null) {
  uiState.editingNode = { level, id, pillar };
  if (level === 2 && pillar) selection.pillar = pillar;
  uiState.focusSelector = pillar
    ? `[data-edit-input="name"][data-level="${level}"][data-id="${escapeSelectorValue(id)}"][data-pillar="${escapeSelectorValue(pillar)}"]`
    : `[data-edit-input="name"][data-level="${level}"][data-id="${escapeSelectorValue(id)}"]`;
  renderUI();
}

function cancelNameEdit() {
  uiState.editingNode = null;
  uiState.focusSelector = null;
  renderUI();
}

function isEditingNode(level, id, pillar = null) {
  if (!uiState.editingNode) return false;
  if (uiState.editingNode.level !== level || uiState.editingNode.id !== id) return false;
  if (level !== 2) return true;
  return uiState.editingNode.pillar === pillar;
}

function applyPendingFocus() {
  if (!uiState.focusSelector) return;
  const root = document.getElementById('knight-root');
  if (!root) return;
  const target = root.querySelector(uiState.focusSelector);
  if (target) {
    target.focus();
    if (target.select) target.select();
  }
  uiState.focusSelector = null;
}

function resetTransientUiState() {
  uiState.addingLevel = null;
  uiState.addingPillar = null;
  uiState.editingNode = null;
}

/* ---------- Delete confirmation ---------- */

function openDeleteConfirmation(level, nodeId, pillarOverride = null) {
  const nodeLabel = getNodeLabel(level, nodeId, pillarOverride);
  uiState.pendingDelete = { level, nodeId, pillarOverride };

  const bodyEl = document.getElementById('knight-delete-modal-body');
  if (bodyEl) {
    const cascadeHint = level === 4
      ? 'This cannot be undone.'
      : 'This also removes all nested items under this branch.';
    bodyEl.textContent = `Delete "${nodeLabel}"? ${cascadeHint}`;
  }

  const modalEl = document.getElementById('knight-delete-modal');
  if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) return;
  window.bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function closeDeleteConfirmation() {
  uiState.pendingDelete = null;
  const modalEl = document.getElementById('knight-delete-modal');
  if (!modalEl || !window.bootstrap || !window.bootstrap.Modal) return;
  window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
}

async function confirmDeleteNode() {
  if (!uiState.pendingDelete) return;
  const { level, nodeId, pillarOverride } = uiState.pendingDelete;
  closeDeleteConfirmation();
  await handleDeleteNode(level, nodeId, pillarOverride);
}

function getNodeLabel(level, nodeId, pillarOverride = null) {
  if (level === 2) {
    const pillar = pillarOverride || selection.pillar;
    return getLevel2Nodes(pillar).find((n) => n.id === nodeId)?.name || 'this item';
  }
  if (level === 3) {
    const node = getSelectedLevel2Node();
    return (node ? normalizeList(node.children).find((n) => n.id === nodeId) : null)?.name || 'this item';
  }
  if (level === 4) {
    const node = getSelectedLevel3Node();
    return (node ? normalizeList(node.children).find((n) => n.id === nodeId) : null)?.name || 'this item';
  }
  return 'this item';
}

/* ---------- Selection helpers ---------- */

function getLevel2Nodes(pillar) {
  if (!pillar) return [];
  if (!Array.isArray(tree[pillar])) tree[pillar] = [];
  return tree[pillar];
}

function getSelectedLevel2Node() {
  if (!selection.pillar || !selection.level2Id) return null;
  return getLevel2Nodes(selection.pillar).find((n) => n.id === selection.level2Id) || null;
}

function getSelectedLevel3Node() {
  const level2 = getSelectedLevel2Node();
  if (!level2 || !selection.level3Id) return null;
  return normalizeList(level2.children).find((n) => n.id === selection.level3Id) || null;
}

function getSelectedLevel4Node() {
  const level3 = getSelectedLevel3Node();
  if (!level3 || !selection.level4Id) return null;
  return normalizeList(level3.children).find((n) => n.id === selection.level4Id) || null;
}

function getLevel2Index(pillar, level2Id) {
  if (!pillar || !level2Id) return -1;
  return getLevel2Nodes(pillar).findIndex((n) => n.id === level2Id);
}

function getLevel3Index(pillar, level2Id, level3Id) {
  const level2Index = getLevel2Index(pillar, level2Id);
  if (level2Index === -1 || !level3Id) return -1;
  return normalizeList(tree[pillar][level2Index].children).findIndex((n) => n.id === level3Id);
}

function getLevel4Index(pillar, level2Id, level3Id, level4Id) {
  const level2Index = getLevel2Index(pillar, level2Id);
  const level3Index = getLevel3Index(pillar, level2Id, level3Id);
  if (level2Index === -1 || level3Index === -1 || !level4Id) return -1;
  return normalizeList(tree[pillar][level2Index].children[level3Index].children).findIndex((n) => n.id === level4Id);
}

/* ---------- Progress ---------- */

function getPillarProgress(pillar) {
  const nodes = getLevel2Nodes(pillar);
  if (nodes.length === 0) return 0;
  return nodes.reduce((sum, n) => sum + getLevel2Progress(n), 0) / nodes.length;
}

function getLevel2Progress(level2Node) {
  const children = normalizeList(level2Node.children);
  if (children.length === 0) return 0;
  return children.reduce((sum, n) => sum + getLevel3Progress(n), 0) / children.length;
}

function getLevel3Progress(level3Node) {
  const tasks = normalizeList(level3Node.children);
  if (tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.completed === true).length;
  return (completed / tasks.length) * 100;
}

function roundProgress(progress) {
  return Math.round(progress);
}

/* ---------- Data normalization ---------- */

function createInitialTree() {
  return {
    Health: [],
    Relationships: [],
    Finance: [],
    'Career & Studies': []
  };
}

function normalizeTree(raw) {
  const out = createInitialTree();
  PILLARS.forEach((pillar) => {
    out[pillar] = normalizeLevel2(raw ? raw[pillar] : []);
  });
  return out;
}

function normalizeLevel2(value) {
  return normalizeList(value).map((node, index) => {
    const id = getSafeId(node.id, `${index + 1}`);
    return {
      id,
      name: node.name || `Item ${index + 1}`,
      children: normalizeLevel3(node.children, id)
    };
  });
}

function normalizeLevel3(value, parentId) {
  return normalizeList(value).map((node, index) => {
    const id = getSafeId(node.id, `${parentId}.${index + 1}`);
    return {
      id,
      name: node.name || `Item ${index + 1}`,
      children: normalizeLevel4(node.children, id)
    };
  });
}

function normalizeLevel4(value, parentId) {
  return normalizeList(value).map((node, index) => ({
    id: getSafeId(node.id, `${parentId}.${index + 1}`),
    name: node.name || `Item ${index + 1}`,
    description: node.description || '',
    completed: node.completed === true
  }));
}

function normalizeList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === 'object');
  }
  if (typeof value === 'object') {
    return Object.keys(value)
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
      .filter((item) => item && typeof item === 'object');
  }
  return [];
}

function createChildId(parentId, siblings) {
  const max = siblings.reduce((m, s) => {
    const seg = getLastNumericSegment(s.id);
    return Number.isFinite(seg) ? Math.max(m, seg) : m;
  }, 0);
  const next = max + 1;
  return parentId ? `${parentId}.${next}` : `${next}`;
}

function getLastNumericSegment(id) {
  if (!id || typeof id !== 'string') return NaN;
  const parts = id.split('.');
  return parseInt(parts[parts.length - 1], 10);
}

function getSafeId(value, fallback) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

/* ---------- Misc helpers ---------- */

function setLoadingState(isLoading) {
  const loader = document.getElementById('knight-loader');
  const content = document.getElementById('knight-content');
  if (!loader || !content) return;
  loader.classList.toggle('d-none', !isLoading);
  content.classList.toggle('d-none', isLoading);
}

function getPillarThemeClass(pillar) {
  const key = PILLAR_THEME_KEYS[pillar];
  return key ? `knight-theme-${key}` : '';
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, '&quot;');
}

function escapeSelectorValue(value) {
  const text = value == null ? '' : String(value);
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(text);
  }
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
