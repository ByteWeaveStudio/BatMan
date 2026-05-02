// Expenses page functionality (Modular Firebase v9+)
import { getCurrentYear, getExpensesRef, getExpenseCategoriesRef } from './auth.js';
import { child, get, set, remove } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

let currentYear = getCurrentYear();
let expenses = [];
let categories = [];
let expenseChart = null;
let categoryChart = null;
let currentChartType = 'daily';
let selectedMonth = null;
let selectedExpenseListCategory = 'all';
let expenseListSearchQuery = '';

const PASTEL_COLORS = [
  '#FADADD',
  '#FFF1B8',
  '#D9F7BE',
  '#CFFAFE',
  '#E9D5FF',
  '#FDE2E4',
  '#D6EADF',
  '#E3F2FD',
  '#FFE5B4',
  '#F5E6CA'
];

/**
 * Initialize expenses page
 */
export function initExpenses() {
  currentYear = getCurrentYear();
  selectedMonth = getCurrentYearMonthValue();
  
  // Initialize category manager
  initCategoryManager();

  // Initialize form handlers
  initExpenseForm();
  
  // Initialize chart toggle
  initChartToggle();
  
  // Initialize month filter
  initMonthFilter();

  // Initialize expense list filters
  initExpenseListFilters();
  
  // Load expenses
  loadInitialData();
}

/**
 * Load categories and expenses
 */
function loadInitialData() {
  loadCategories().then(() => {
    loadExpenses();
  });
}

/**
 * Initialize expense form
 */
function initExpenseForm() {
  const form = document.getElementById('expense-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addExpense();
  });
  
  // Keyboard shortcuts for fast entry
  document.getElementById('expense-amount').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('expense-place').focus();
    }
  });
  
  document.getElementById('expense-place').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('expense-description').focus();
    }
  });
}

/**
 * Initialize category form
 */
function initCategoryManager() {
  const form = document.getElementById('category-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    addCategory();
  });
}

function initExpenseListFilters() {
  const categoryFilter = document.getElementById('expense-list-category-filter');
  const searchInput = document.getElementById('expense-list-search');

  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      selectedExpenseListCategory = categoryFilter.value;
      renderExpenseList();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      expenseListSearchQuery = searchInput.value.trim().toLowerCase();
      renderExpenseList();
    });
  }
}

/**
 * Add new expense
 */
function addExpense() {
  const name = document.getElementById('expense-name').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const date = document.getElementById('expense-date').value;
  const categoryId = document.getElementById('expense-category').value;
  const place = document.getElementById('expense-place').value.trim();
  const description = document.getElementById('expense-description').value.trim();
  
  if (!name || isNaN(amount) || amount <= 0 || !categoryId) {
    alert('Please fill in required fields correctly.');
    return;
  }
  
  const expensesRef = getExpensesRef();
  if (!expensesRef) return;
  
  const expenseId = Date.now().toString();
  const expense = {
    name: name,
    amount: amount,
    date: date,
    categoryId: categoryId,
    place: place,
    description: description,
    createdAt: Date.now()
  };
  
  set(child(expensesRef, expenseId), expense).then(() => {
    // Clear form
    document.getElementById('expense-form').reset();
    document.getElementById('expense-date').valueAsDate = new Date();
    document.getElementById('expense-category').value = '';
    document.getElementById('expense-name').focus();
    
    // Reload expenses
    loadExpenses();
  }).catch((error) => {
    alert('Error adding expense. Please try again.');
  });
}

/**
 * Load expenses from Firebase
 */
function loadExpenses() {
  const expensesRef = getExpensesRef();
  if (!expensesRef) return;
  
  get(expensesRef).then((snapshot) => {
    const expensesData = snapshot.val() || {};
    
    // Convert to array and sort by date (newest first)
    expenses = Object.keys(expensesData).map(id => ({
      id: id,
      ...expensesData[id]
    })).sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return b.createdAt - a.createdAt;
    });
    
    updateSummary();
    updateMonthFilter();
    renderExpenseList();
    renderChart();
    renderCategoryChart();
  });
}

/**
 * Load categories from Firebase
 */
function loadCategories() {
  const categoriesRef = getExpenseCategoriesRef();
  if (!categoriesRef) return Promise.resolve();

  return get(categoriesRef).then((snapshot) => {
    const categoriesData = snapshot.val() || {};
    categories = Object.keys(categoriesData).map(id => ({
      id: id,
      ...categoriesData[id]
    })).sort((a, b) => a.name.localeCompare(b.name));

    renderCategoryOptions();
    renderCategoryList();
  }).catch(() => {
    categories = [];
    renderCategoryOptions();
    renderCategoryList();
  });
}

/**
 * Add a new category
 */
function addCategory() {
  const input = document.getElementById('category-name');
  const rawName = input.value.trim();
  const normalized = rawName.toLowerCase();

  if (!rawName) {
    return;
  }

  const alreadyExists = categories.some(category => category.name.toLowerCase() === normalized);
  if (alreadyExists) {
    alert('Category already exists.');
    return;
  }

  if (categories.length >= 10) {
    alert('You can add up to 10 categories.');
    return;
  }

  const categoriesRef = getExpenseCategoriesRef();
  if (!categoriesRef) return;

  const availableColors = PASTEL_COLORS.filter(color =>
    !categories.some(category => category.color === color)
  );
  const fallbackColor = getRandomPastelColors(1)[0];
  const color = availableColors.length > 0
    ? availableColors[Math.floor(Math.random() * availableColors.length)]
    : fallbackColor;

  const id = Date.now().toString();
  const category = {
    name: rawName,
    color: color,
    createdAt: Date.now()
  };

  set(child(categoriesRef, id), category).then(() => {
    input.value = '';
    return loadCategories();
  }).then(() => {
    renderExpenseList();
  }).catch(() => {
    alert('Error adding category. Please try again.');
  });
}

/**
 * Delete category if not used in expenses
 */
function deleteCategory(categoryId) {
  const hasExpenses = expenses.some(expense => expense.categoryId === categoryId);
  if (hasExpenses) {
    alert('This category is in use by existing expenses and cannot be deleted.');
    return;
  }

  if (!confirm('Delete this category?')) return;

  const categoriesRef = getExpenseCategoriesRef();
  if (!categoriesRef) return;

  remove(child(categoriesRef, categoryId)).then(() => {
    return loadCategories();
  }).then(() => {
    renderExpenseList();
    renderCategoryChart();
  }).catch(() => {
    alert('Error deleting category. Please try again.');
  });
}

/**
 * Update summary cards
 */
function updateSummary() {
  const totalEl = document.getElementById('total-spend');
  const avgPerDayEl = document.getElementById('avg-per-day');
  const avgPerMonthEl = document.getElementById('avg-per-month');

  if (!totalEl || !avgPerDayEl || !avgPerMonthEl) return;

  const scopedExpenses = getScopedExpenses();
  const total = scopedExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  document.getElementById('total-spend').textContent = formatCurrency(total);
  
  const scope = getSummaryScope();
  const avgPerDay = total / scope.days;
  document.getElementById('avg-per-day').textContent = formatCurrency(avgPerDay);
  
  const avgPerMonth = total / scope.months;
  document.getElementById('avg-per-month').textContent = formatCurrency(avgPerMonth);
}

/**
 * Render expense list
 */
function renderExpenseList() {
  const tbody = document.getElementById('expense-list-body');
  const totalEl = document.getElementById('expense-list-total');
  if (!tbody) return;
  
  const filterMonth = selectedMonth || getCurrentYearMonthValue();
  const monthFilteredExpenses = expenses.filter(exp => {
    const expDate = new Date(exp.date);
    const expYearMonth = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
    return expYearMonth === filterMonth;
  });

  const filteredExpenses = monthFilteredExpenses.filter((expense) => {
    const categoryMatch = selectedExpenseListCategory === 'all' || expense.categoryId === selectedExpenseListCategory;
    if (!categoryMatch) {
      return false;
    }

    if (!expenseListSearchQuery) {
      return true;
    }

    const categoryName = getCategoryName(expense.categoryId);
    const searchable = [
      expense.name || '',
      expense.place || '',
      expense.description || '',
      categoryName,
      formatCurrency(expense.amount),
      expense.date || ''
    ].join(' ').toLowerCase();

    return searchable.includes(expenseListSearchQuery);
  });

  const filteredTotal = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  if (totalEl) {
    totalEl.textContent = formatCurrency(filteredTotal);
  }
  
  if (filteredExpenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No expenses found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = filteredExpenses.map(expense => {
    const date = new Date(expense.date);
    const formattedDate = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    
    return `
      <tr>
        <td>${formattedDate}</td>
        <td>${escapeHtml(expense.name)}</td>
        <td>${renderCategoryBadge(expense.categoryId)}</td>
        <td class="fw-bold">${formatCurrency(expense.amount)}</td>
        <td>${escapeHtml(expense.place || '-')}</td>
        <td class="text-muted small">${escapeHtml(expense.description || '-')}</td>
        <td>
          <button class="btn btn-sm btn-link p-0 me-2" onclick="window.editExpense('${expense.id}')" title="Edit">
            Edit
          </button>
          <button class="btn btn-sm btn-link text-danger p-0" onclick="window.deleteExpense('${expense.id}')" title="Delete">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Edit expense
 */
export function editExpense(expenseId) {
  const expense = expenses.find(e => e.id === expenseId);
  if (!expense) return;
  
  document.getElementById('edit-expense-id').value = expenseId;
  document.getElementById('edit-expense-name').value = expense.name;
  document.getElementById('edit-expense-amount').value = expense.amount;
  document.getElementById('edit-expense-date').value = expense.date;
  document.getElementById('edit-expense-category').value = expense.categoryId || '';
  document.getElementById('edit-expense-place').value = expense.place || '';
  document.getElementById('edit-expense-description').value = expense.description || '';
  
  const modal = new bootstrap.Modal(document.getElementById('editExpenseModal'));
  modal.show();
  
  // Handle form submission
  const form = document.getElementById('edit-expense-form');
  form.onsubmit = (e) => {
    e.preventDefault();
    saveExpenseEdit(expenseId);
  };
}

/**
 * Save expense edit
 */
function saveExpenseEdit(expenseId) {
  const name = document.getElementById('edit-expense-name').value.trim();
  const amount = parseFloat(document.getElementById('edit-expense-amount').value);
  const date = document.getElementById('edit-expense-date').value;
  const categoryId = document.getElementById('edit-expense-category').value;
  const place = document.getElementById('edit-expense-place').value.trim();
  const description = document.getElementById('edit-expense-description').value.trim();
  
  if (!name || isNaN(amount) || amount <= 0 || !categoryId) {
    alert('Please fill in required fields correctly.');
    return;
  }
  
  const expensesRef = getExpensesRef();
  if (!expensesRef) return;
  
  const expense = {
    name: name,
    amount: amount,
    date: date,
    categoryId: categoryId,
    place: place,
    description: description,
    createdAt: expenses.find(e => e.id === expenseId).createdAt,
    updatedAt: Date.now()
  };
  
  set(child(expensesRef, expenseId), expense).then(() => {
    const modal = bootstrap.Modal.getInstance(document.getElementById('editExpenseModal'));
    modal.hide();
    loadExpenses();
  }).catch((error) => {
    alert('Error updating expense. Please try again.');
  });
}

/**
 * Delete expense
 */
export function deleteExpense(expenseId) {
  if (!confirm('Delete this expense?')) return;
  
  const expensesRef = getExpensesRef();
  if (!expensesRef) return;
  
  remove(child(expensesRef, expenseId)).then(() => {
    loadExpenses();
  }).catch((error) => {
    alert('Error deleting expense. Please try again.');
  });
}

/**
 * Initialize chart toggle
 */
function initChartToggle() {
  document.getElementById('daily-chart').addEventListener('change', () => {
    currentChartType = 'daily';
    updateChartTitle();
    renderChart();
    renderCategoryChart();
    updateSummary();
  });
  
  document.getElementById('monthly-chart').addEventListener('change', () => {
    currentChartType = 'monthly';
    updateChartTitle();
    renderChart();
    renderCategoryChart();
    updateSummary();
  });
}

/**
 * Initialize month filter
 */
function initMonthFilter() {
  const filter = document.getElementById('expense-month-filter');
  if (!filter) return;
  
  filter.addEventListener('change', () => {
    selectedMonth = filter.value;
    updateChartTitle();
    renderExpenseList();
    renderChart();
    renderCategoryChart();
    updateSummary();
  });
  
  // Initial update
  updateMonthFilter();
  updateChartTitle();
}

/**
 * Update month filter options based on current expenses
 */
function updateMonthFilter() {
  const filter = document.getElementById('expense-month-filter');
  if (!filter) return;
  
  // Get unique year-months from expenses
  const yearMonths = new Set();
  expenses.forEach(exp => {
    const date = new Date(exp.date);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    yearMonths.add(yearMonth);
  });
  yearMonths.add(getCurrentYearMonthValue());
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  
  const sortedMonths = Array.from(yearMonths).sort().reverse();
  const currentValue = selectedMonth || filter.value;
  
  filter.innerHTML = sortedMonths.map(ym => {
    const [year, month] = ym.split('-');
    return `<option value="${ym}">${monthNames[parseInt(month) - 1]} ${year}</option>`;
  }).join('');
  
  if (currentValue && Array.from(filter.options).some(opt => opt.value === currentValue)) {
    filter.value = currentValue;
    selectedMonth = currentValue;
  } else {
    const fallback = getCurrentYearMonthValue();
    filter.value = fallback;
    selectedMonth = fallback;
  }
}

/**
 * Render expense chart
 */
function renderChart() {
  const ctx = document.getElementById('expense-chart');
  if (!ctx) return;
  
  if (expenseChart) {
    expenseChart.destroy();
  }
  
  if (expenses.length === 0) {
    ctx.parentElement.innerHTML = '<div class="text-center text-muted p-4">No expenses to display.</div>';
    return;
  }
  
  if (currentChartType === 'daily') {
    renderDailyExpenseChart(ctx);
  } else {
    renderMonthlyExpenseChart(ctx);
  }
}

/**
 * Render category split pie chart for current scope
 */
function renderCategoryChart() {
  const ctx = document.getElementById('category-chart');
  const emptyState = document.getElementById('category-chart-empty');
  if (!ctx || !emptyState) return;

  if (categoryChart) {
    categoryChart.destroy();
  }

  const scopedExpenses = getScopedExpenses();
  const categoryTotals = {};
  scopedExpenses.forEach(exp => {
    const key = exp.categoryId || 'uncategorized';
    categoryTotals[key] = (categoryTotals[key] || 0) + exp.amount;
  });

  const entries = Object.entries(categoryTotals).filter(([, amount]) => amount > 0);
  if (entries.length === 0) {
    ctx.classList.add('d-none');
    emptyState.classList.remove('d-none');
    return;
  }

  const total = entries.reduce((sum, [, amount]) => sum + amount, 0);
  const labels = entries.map(([categoryId, amount]) => {
    const percent = ((amount / total) * 100).toFixed(1);
    return `${getCategoryName(categoryId)} (${percent}%)`;
  });
  const data = entries.map(([, amount]) => amount);
  const colors = entries.map(([categoryId]) => getCategoryColor(categoryId));

  ctx.classList.remove('d-none');
  emptyState.classList.add('d-none');

  categoryChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: '#ffffff',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.raw || 0;
              return `${context.label}: ${formatCurrency(value)}`;
            }
          }
        }
      },
      animation: false
    }
  });
}

/**
 * Render daily expense chart (for selected month)
 */
function renderDailyExpenseChart(ctx) {
  const { year, month } = getSelectedYearMonth();
  
  // Filter expenses for current month
  const monthExpenses = expenses.filter(exp => {
    const date = new Date(exp.date);
    return date.getFullYear() === year && date.getMonth() + 1 === month;
  });
  
  const daysInMonth = new Date(year, month, 0).getDate();
  const labels = [];
  const data = [];
  
  // Initialize all days with 0
  for (let day = 1; day <= daysInMonth; day++) {
    labels.push(`Day ${day}`);
    data.push(0);
  }
  
  // Sum expenses by day
  monthExpenses.forEach(exp => {
    const date = new Date(exp.date);
    const day = date.getDate();
    if (day >= 1 && day <= daysInMonth) {
      data[day - 1] += exp.amount;
    }
  });
  
  expenseChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Expenses',
        data: data,
        borderColor: '#495057',
        backgroundColor: 'rgba(73, 80, 87, 0.1)',
        borderWidth: 1,
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '₹' + value.toFixed(0);
            }
          }
        }
      },
      animation: false
    }
  });
}

/**
 * Render monthly expense chart (for year)
 */
function renderMonthlyExpenseChart(ctx) {
  const currentYear = getCurrentYear();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const labels = monthNames;
  const data = new Array(12).fill(0);
  
  // Sum expenses by month
  expenses.forEach(exp => {
    const date = new Date(exp.date);
    if (date.getFullYear() === currentYear) {
      const month = date.getMonth();
      data[month] += exp.amount;
    }
  });
  
  expenseChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Expenses',
        data: data,
        backgroundColor: '#6c757d',
        borderColor: '#495057',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '₹' + value.toFixed(0);
            }
          }
        }
      },
      animation: false
    }
  });
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return '₹' + amount.toFixed(2);
}

function getCurrentYearMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getSelectedYearMonth() {
  const value = selectedMonth || getCurrentYearMonthValue();
  const [year, month] = value.split('-').map(part => parseInt(part, 10));
  return { year, month };
}

function getScopedExpenses() {
  if (currentChartType === 'daily') {
    const { year, month } = getSelectedYearMonth();
    return expenses.filter(exp => {
      const date = new Date(exp.date);
      return date.getFullYear() === year && date.getMonth() + 1 === month;
    });
  }
  const scopeYear = getCurrentYear();
  return expenses.filter(exp => {
    const date = new Date(exp.date);
    return date.getFullYear() === scopeYear;
  });
}

function getSummaryScope() {
  if (currentChartType === 'daily') {
    const { year, month } = getSelectedYearMonth();
    return {
      days: Math.max(1, getDaysPassedInMonth(year, month)),
      months: 1
    };
  }

  const scopeYear = getCurrentYear();
  const now = new Date();
  const monthsElapsed = now.getFullYear() === scopeYear ? now.getMonth() + 1 : 12;
  return {
    days: Math.max(1, getDaysPassedInYear(scopeYear)),
    months: Math.max(1, monthsElapsed)
  };
}

function getDaysPassedInMonth(year, month) {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return now.getDate();
  }
  return new Date(year, month, 0).getDate();
}

function getDaysPassedInYear(year) {
  const now = new Date();
  if (now.getFullYear() === year) {
    const start = new Date(year, 0, 1);
    return Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1;
  }
  return isLeapYear(year) ? 366 : 365;
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function updateChartTitle() {
  const title = document.getElementById('chart-title');
  if (!title) return;
  if (currentChartType === 'daily') {
    const { year, month } = getSelectedYearMonth();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    title.textContent = `Daily Expenses - ${monthNames[month - 1]} ${year}`;
    return;
  }
  title.textContent = 'Monthly Expenses - Year View';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getRandomPastelColors(count) {
  const colorPool = [...PASTEL_COLORS];
  const chosen = [];

  while (chosen.length < count) {
    if (colorPool.length === 0) {
      chosen.push(PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)]);
      continue;
    }
    const randomIndex = Math.floor(Math.random() * colorPool.length);
    chosen.push(colorPool.splice(randomIndex, 1)[0]);
  }

  return chosen;
}

function renderCategoryOptions() {
  const addSelect = document.getElementById('expense-category');
  const editSelect = document.getElementById('edit-expense-category');
  const listFilterSelect = document.getElementById('expense-list-category-filter');
  if (!addSelect || !editSelect) return;

  const options = categories.map(category => (
    `<option value="${category.id}">${escapeHtml(category.name)}</option>`
  )).join('');

  addSelect.innerHTML = '<option value="" selected disabled>Select category</option>' + options;
  editSelect.innerHTML = '<option value="" selected disabled>Select category</option>' + options;

  if (listFilterSelect) {
    listFilterSelect.innerHTML = '<option value="all">All categories</option>' + options;
    const selectedOptionExists = Array.from(listFilterSelect.options).some(
      option => option.value === selectedExpenseListCategory
    );
    listFilterSelect.value = selectedOptionExists ? selectedExpenseListCategory : 'all';
    selectedExpenseListCategory = listFilterSelect.value;
  }
}

function renderCategoryList() {
  const categoryList = document.getElementById('category-list');
  if (!categoryList) return;

  if (categories.length === 0) {
    categoryList.innerHTML = '<span class="text-muted small">No categories yet.</span>';
    return;
  }

  categoryList.innerHTML = categories.map(category => `
    <span class="badge rounded-pill d-inline-flex align-items-center gap-2 text-dark"
      style="background-color: ${category.color}; border: 1px solid rgba(0, 0, 0, 0.08);">
      ${escapeHtml(category.name)}
      <button class="btn btn-sm p-0 border-0 text-dark" onclick="window.deleteCategory('${category.id}')" title="Delete category" type="button" style="line-height:1;">
        &times;
      </button>
    </span>
  `).join('');
}

function renderCategoryBadge(categoryId) {
  const category = categories.find(item => item.id === categoryId);
  if (!category) {
    return '<span class="badge text-bg-light">Uncategorized</span>';
  }
  return `
    <span class="badge rounded-pill text-dark"
      style="background-color: ${category.color}; border: 1px solid rgba(0, 0, 0, 0.08);">
      ${escapeHtml(category.name)}
    </span>
  `;
}

function getCategoryName(categoryId) {
  if (categoryId === 'uncategorized') {
    return 'Uncategorized';
  }
  const category = categories.find(item => item.id === categoryId);
  return category ? category.name : 'Uncategorized';
}

function getCategoryColor(categoryId) {
  if (categoryId === 'uncategorized') {
    return '#E2E8F0';
  }
  const category = categories.find(item => item.id === categoryId);
  return category ? category.color : '#E2E8F0';
}

// Make functions available globally for onclick handlers
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
window.deleteCategory = deleteCategory;
