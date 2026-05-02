// Portfolio page functionality (Modular Firebase v9+)
import { getPortfolioRef } from './auth.js';
import { child, set, onValue } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const FIELD_CONFIG = [
  { key: 'personal', label: 'Personal Expense', type: 'expense' },
  { key: 'family', label: 'Family Expense', type: 'expense' },
  { key: 'rent', label: 'Rent', type: 'expense' },
  { key: 'loan', label: 'Loan', type: 'expense' },
  { key: 'misc', label: 'Misc', type: 'expense' },
  { key: 'mainIncome', label: 'Main Income', type: 'income' },
  { key: 'sideIncome', label: 'Side Income', type: 'income' }
];

let portfolioData = {
  openingBalance: 0,
  months: {}
};
let portfolioListener = null;
let lineItemsModal = null;
let activeCellEditor = null;

export function initPortfolio() {
  initOpeningBalance();
  initLineItemsEditor();
  loadPortfolio();
}

function initOpeningBalance() {
  const input = document.getElementById('opening-balance');
  if (!input) return;

  let saveTimeout;
  input.addEventListener('blur', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveOpeningBalance();
    }, 300);
  });

  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  });
}

function initLineItemsEditor() {
  const modalEl = document.getElementById('lineItemsModal');
  const addBtn = document.getElementById('add-line-item-btn');
  const saveBtn = document.getElementById('save-line-items-btn');
  const tbody = document.getElementById('line-items-body');
  if (!modalEl || !addBtn || !saveBtn || !tbody) return;

  lineItemsModal = new bootstrap.Modal(modalEl);

  addBtn.addEventListener('click', () => {
    if (!activeCellEditor) return;
    activeCellEditor.lineItems.push(createEmptyLineItem());
    renderLineItemsEditorRows();
  });

  saveBtn.addEventListener('click', () => {
    saveActiveCellLineItems();
  });

  tbody.addEventListener('input', (event) => {
    if (!activeCellEditor) return;
    const target = event.target;
    const index = parseInt(target.getAttribute('data-index') || '', 10);
    const field = target.getAttribute('data-line-field');
    if (Number.isNaN(index) || !field || !activeCellEditor.lineItems[index]) return;

    if (field === 'amount') {
      const parsed = parseFloat(target.value);
      activeCellEditor.lineItems[index].amount = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
      return;
    }
    activeCellEditor.lineItems[index][field] = target.value;
  });

  tbody.addEventListener('click', (event) => {
    const button = event.target.closest('.line-item-delete-btn');
    if (!button || !activeCellEditor) return;
    const index = parseInt(button.getAttribute('data-index') || '', 10);
    if (Number.isNaN(index)) return;
    activeCellEditor.lineItems.splice(index, 1);
    renderLineItemsEditorRows();
  });

  modalEl.addEventListener('hidden.bs.modal', () => {
    activeCellEditor = null;
  });
}

function loadPortfolio() {
  const portfolioRef = getPortfolioRef();
  if (!portfolioRef) return;

  initializeMonths();

  if (portfolioListener) {
    portfolioListener();
  }

  portfolioListener = onValue(portfolioRef, (snapshot) => {
    const data = snapshot.val() || {};
    portfolioData.openingBalance = data.openingBalance || 0;
    const openingBalanceInput = document.getElementById('opening-balance');
    if (openingBalanceInput) {
      openingBalanceInput.value = portfolioData.openingBalance;
    }

    MONTHS.forEach(monthKey => {
      portfolioData.months[monthKey] = normalizeMonthData(data.months ? data.months[monthKey] : null);
    });

    renderTable();
    updateSummary();
  }, (error) => {
    console.error('Error loading portfolio:', error);
    renderTable();
    updateSummary();
  });
}

function initializeMonths() {
  MONTHS.forEach(monthKey => {
    if (!portfolioData.months[monthKey]) {
      portfolioData.months[monthKey] = createEmptyMonthData();
    }
  });
}

function createEmptyMonthData() {
  const monthData = {};
  FIELD_CONFIG.forEach(field => {
    monthData[field.key] = createEmptyCellData();
  });
  return monthData;
}

function createEmptyCellData() {
  return { lineItems: [] };
}

function createEmptyLineItem() {
  return { date: '', description: '', amount: 0 };
}

function normalizeMonthData(rawMonthData) {
  const normalized = createEmptyMonthData();
  if (!rawMonthData || typeof rawMonthData !== 'object') {
    return normalized;
  }

  FIELD_CONFIG.forEach(field => {
    normalized[field.key] = normalizeCellData(rawMonthData[field.key]);
  });

  return normalized;
}

function normalizeCellData(rawCellData) {
  if (typeof rawCellData === 'number') {
    if (rawCellData <= 0) return createEmptyCellData();
    return {
      lineItems: [{
        date: '',
        description: 'Imported entry',
        amount: rawCellData
      }]
    };
  }

  if (!rawCellData || typeof rawCellData !== 'object') {
    return createEmptyCellData();
  }

  const lineItems = Array.isArray(rawCellData.lineItems) ? rawCellData.lineItems : [];
  return {
    lineItems: lineItems.map(item => ({
      date: typeof item.date === 'string' ? item.date : '',
      description: typeof item.description === 'string' ? item.description : '',
      amount: sanitizeAmount(item.amount)
    })).filter(item => item.amount > 0 || item.date || item.description)
  };
}

function renderTable() {
  const tbody = document.getElementById('portfolio-table-body');
  if (!tbody) return;

  let html = '';
  MONTHS.forEach((monthKey, index) => {
    const monthData = portfolioData.months[monthKey] || createEmptyMonthData();
    const totalExpense = getMonthExpenseTotal(monthData);
    const totalIncome = getMonthIncomeTotal(monthData);
    const finalSavings = totalIncome - totalExpense;

    html += `
      <tr>
        <td class="fw-bold">${MONTH_NAMES[index]}</td>
        <td>${renderEditableCell(monthKey, 'personal', monthData.personal)}</td>
        <td>${renderEditableCell(monthKey, 'family', monthData.family)}</td>
        <td>${renderEditableCell(monthKey, 'rent', monthData.rent)}</td>
        <td>${renderEditableCell(monthKey, 'loan', monthData.loan)}</td>
        <td>${renderEditableCell(monthKey, 'misc', monthData.misc)}</td>
        <td class="text-end fw-bold table-light">${formatCurrency(totalExpense)}</td>
        <td>${renderEditableCell(monthKey, 'mainIncome', monthData.mainIncome)}</td>
        <td>${renderEditableCell(monthKey, 'sideIncome', monthData.sideIncome)}</td>
        <td class="text-end fw-bold table-light">${formatCurrency(totalIncome)}</td>
        <td class="text-end fw-bold table-light ${finalSavings >= 0 ? 'text-success' : 'text-danger'}">
          ${formatCurrency(finalSavings)}
        </td>
      </tr>
    `;
  });

  const totals = getYearTotals();
  html += `
    <tr class="table-secondary fw-bold">
      <td>TOTAL</td>
      <td class="text-end">${formatCurrency(totals.personal)}</td>
      <td class="text-end">${formatCurrency(totals.family)}</td>
      <td class="text-end">${formatCurrency(totals.rent)}</td>
      <td class="text-end">${formatCurrency(totals.loan)}</td>
      <td class="text-end">${formatCurrency(totals.misc)}</td>
      <td class="text-end">${formatCurrency(totals.expense)}</td>
      <td class="text-end">${formatCurrency(totals.mainIncome)}</td>
      <td class="text-end">${formatCurrency(totals.sideIncome)}</td>
      <td class="text-end">${formatCurrency(totals.income)}</td>
      <td class="text-end ${totals.savings >= 0 ? 'text-success' : 'text-danger'}">
        ${formatCurrency(totals.savings)}
      </td>
    </tr>
  `;

  tbody.innerHTML = html;
  attachCellEditListeners();
}

function renderEditableCell(monthKey, fieldKey, cellData) {
  const total = getCellTotal(cellData);
  const lineItemCount = (cellData && Array.isArray(cellData.lineItems)) ? cellData.lineItems.length : 0;
  return `
    <div class="portfolio-cell-edit p-2 rounded border border-light-subtle" data-month="${monthKey}" data-field="${fieldKey}" role="button" tabindex="0" style="cursor: pointer;">
      <div class="fw-semibold">${formatCurrency(total)}</div>
      <!-- <div class="small text-muted">${lineItemCount} ${lineItemCount === 1 ? 'item' : 'items'}</div> -->
    </div>
  `;
}

function attachCellEditListeners() {
  const buttons = document.querySelectorAll('.portfolio-cell-edit');
  buttons.forEach(button => {
    const openEditor = () => {
      const monthKey = button.getAttribute('data-month');
      const fieldKey = button.getAttribute('data-field');
      if (!monthKey || !fieldKey) return;
      openLineItemsEditor(monthKey, fieldKey);
    };

    button.addEventListener('click', openEditor);
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openEditor();
      }
    });
  });
}

function openLineItemsEditor(monthKey, fieldKey) {
  const monthData = portfolioData.months[monthKey] || createEmptyMonthData();
  const cellData = monthData[fieldKey] || createEmptyCellData();
  const fieldLabel = getFieldLabel(fieldKey);
  const monthLabel = MONTH_NAMES[MONTHS.indexOf(monthKey)] || monthKey;

  activeCellEditor = {
    monthKey: monthKey,
    fieldKey: fieldKey,
    lineItems: (cellData.lineItems || []).map(item => ({
      date: item.date || '',
      description: item.description || '',
      amount: sanitizeAmount(item.amount)
    }))
  };

  if (activeCellEditor.lineItems.length === 0) {
    activeCellEditor.lineItems.push(createEmptyLineItem());
  }

  const titleEl = document.getElementById('line-items-modal-title');
  if (titleEl) {
    titleEl.textContent = `${fieldLabel} - ${monthLabel}`;
  }

  renderLineItemsEditorRows();
  if (lineItemsModal) {
    lineItemsModal.show();
  }
}

function renderLineItemsEditorRows() {
  const tbody = document.getElementById('line-items-body');
  if (!tbody || !activeCellEditor) return;

  if (activeCellEditor.lineItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No items yet.</td></tr>';
    return;
  }

  tbody.innerHTML = activeCellEditor.lineItems.map((item, index) => `
    <tr>
      <td>
        <input type="date" class="form-control form-control-sm"
          data-index="${index}" data-line-field="date" value="${escapeHtml(item.date || '')}">
      </td>
      <td>
        <input type="text" class="form-control form-control-sm"
          data-index="${index}" data-line-field="description" value="${escapeHtml(item.description || '')}"
          placeholder="Description" maxlength="80">
      </td>
      <td>
        <input type="number" class="form-control form-control-sm"
          data-index="${index}" data-line-field="amount" value="${sanitizeAmount(item.amount)}"
          min="0" step="0.01">
      </td>
      <td class="text-end">
        <button type="button" class="btn btn-sm btn-outline-danger line-item-delete-btn" data-index="${index}" title="Delete line item">
          &times;
        </button>
      </td>
    </tr>
  `).join('');
}

function saveActiveCellLineItems() {
  if (!activeCellEditor) return;

  const cleanItems = activeCellEditor.lineItems
    .map(item => ({
      date: (item.date || '').trim(),
      description: (item.description || '').trim(),
      amount: sanitizeAmount(item.amount)
    }))
    .filter(item => item.date || item.description || item.amount > 0);

  const hasInvalid = cleanItems.some(item => !item.date || !item.description || item.amount <= 0);
  if (hasInvalid) {
    alert('Each line item must include date, description, and an amount greater than 0.');
    return;
  }

  if (!portfolioData.months[activeCellEditor.monthKey]) {
    portfolioData.months[activeCellEditor.monthKey] = createEmptyMonthData();
  }

  portfolioData.months[activeCellEditor.monthKey][activeCellEditor.fieldKey] = {
    lineItems: cleanItems
  };

  saveMonth(activeCellEditor.monthKey);
  if (lineItemsModal) {
    lineItemsModal.hide();
  }
  renderTable();
  updateSummary();
}

function saveMonth(monthKey) {
  const portfolioRef = getPortfolioRef();
  if (!portfolioRef) return;
  const monthRef = child(child(portfolioRef, 'months'), monthKey);
  set(monthRef, serializeMonthData(portfolioData.months[monthKey]));
}

function serializeMonthData(monthData) {
  const serialized = {};
  FIELD_CONFIG.forEach(field => {
    serialized[field.key] = {
      lineItems: (monthData[field.key] && Array.isArray(monthData[field.key].lineItems))
        ? monthData[field.key].lineItems.map(item => ({
          date: item.date || '',
          description: item.description || '',
          amount: sanitizeAmount(item.amount)
        })).filter(item => item.date || item.description || item.amount > 0)
        : []
    };
  });
  return serialized;
}

function saveOpeningBalance() {
  const input = document.getElementById('opening-balance');
  if (!input) return;

  let value = parseFloat(input.value);
  if (Number.isNaN(value) || value < 0) {
    value = 0;
    input.value = 0;
  }

  portfolioData.openingBalance = value;
  const portfolioRef = getPortfolioRef();
  if (!portfolioRef) return;
  set(child(portfolioRef, 'openingBalance'), value);
}

function updateSummary() {
  const totals = getYearTotals();
  const totalSavings = totals.savings;

  const totalSavingsEl = document.getElementById('total-savings');
  const closingBalanceEl = document.getElementById('closing-balance');
  if (!totalSavingsEl || !closingBalanceEl) return;

  totalSavingsEl.textContent = formatSummaryAmount(totalSavings);
  const closingBalance = (portfolioData.openingBalance || 0) + totalSavings;
  closingBalanceEl.textContent = formatSummaryAmount(closingBalance);
}

function getYearTotals() {
  const totals = {
    personal: 0,
    family: 0,
    rent: 0,
    loan: 0,
    misc: 0,
    mainIncome: 0,
    sideIncome: 0,
    expense: 0,
    income: 0,
    savings: 0
  };

  MONTHS.forEach(monthKey => {
    const monthData = portfolioData.months[monthKey] || createEmptyMonthData();
    totals.personal += getCellTotal(monthData.personal);
    totals.family += getCellTotal(monthData.family);
    totals.rent += getCellTotal(monthData.rent);
    totals.loan += getCellTotal(monthData.loan);
    totals.misc += getCellTotal(monthData.misc);
    totals.mainIncome += getCellTotal(monthData.mainIncome);
    totals.sideIncome += getCellTotal(monthData.sideIncome);
  });

  totals.expense = totals.personal + totals.family + totals.rent + totals.loan + totals.misc;
  totals.income = totals.mainIncome + totals.sideIncome;
  totals.savings = totals.income - totals.expense;
  return totals;
}

function getMonthExpenseTotal(monthData) {
  return getCellTotal(monthData.personal) +
    getCellTotal(monthData.family) +
    getCellTotal(monthData.rent) +
    getCellTotal(monthData.loan) +
    getCellTotal(monthData.misc);
}

function getMonthIncomeTotal(monthData) {
  return getCellTotal(monthData.mainIncome) + getCellTotal(monthData.sideIncome);
}

function getCellTotal(cellData) {
  if (!cellData || !Array.isArray(cellData.lineItems)) return 0;
  return cellData.lineItems.reduce((sum, item) => sum + sanitizeAmount(item.amount), 0);
}

function getFieldLabel(fieldKey) {
  const field = FIELD_CONFIG.find(item => item.key === fieldKey);
  return field ? field.label : fieldKey;
}

function sanitizeAmount(value) {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  return Number.isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toFixed(2);
}

function formatSummaryAmount(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}