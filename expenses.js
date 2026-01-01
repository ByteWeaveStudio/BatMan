// Expenses page functionality (Modular Firebase v9+)
import { getCurrentYear, getExpensesRef } from './auth.js';
import { child, get, set, remove } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

let currentYear = getCurrentYear();
let expenses = [];
let expenseChart = null;
let currentChartType = 'daily';

/**
 * Initialize expenses page
 */
export function initExpenses() {
  currentYear = getCurrentYear();
  
  // Initialize form handlers
  initExpenseForm();
  
  // Initialize chart toggle
  initChartToggle();
  
  // Initialize month filter
  initMonthFilter();
  
  // Load expenses
  loadExpenses();
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
 * Add new expense
 */
function addExpense() {
  const name = document.getElementById('expense-name').value.trim();
  const amount = parseFloat(document.getElementById('expense-amount').value);
  const date = document.getElementById('expense-date').value;
  const place = document.getElementById('expense-place').value.trim();
  const description = document.getElementById('expense-description').value.trim();
  
  if (!name || isNaN(amount) || amount <= 0) {
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
    place: place,
    description: description,
    createdAt: Date.now()
  };
  
  set(child(expensesRef, expenseId), expense).then(() => {
    // Clear form
    document.getElementById('expense-form').reset();
    document.getElementById('expense-date').valueAsDate = new Date();
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
  });
}

/**
 * Update summary cards
 */
function updateSummary() {
  if (expenses.length === 0) {
    document.getElementById('total-spend').textContent = '₹0.00';
    document.getElementById('avg-per-day').textContent = '₹0.00';
    document.getElementById('avg-per-month').textContent = '₹0.00';
    return;
  }
  
  const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  document.getElementById('total-spend').textContent = formatCurrency(total);
  
  // Calculate average per day (based on date range)
  const dates = expenses.map(e => new Date(e.date));
  const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
  const daysDiff = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1);
  const avgPerDay = total / daysDiff;
  document.getElementById('avg-per-day').textContent = formatCurrency(avgPerDay);
  
  // Calculate average per month
  const months = new Set(expenses.map(e => {
    const d = new Date(e.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  })).size;
  const avgPerMonth = months > 0 ? total / months : 0;
  document.getElementById('avg-per-month').textContent = formatCurrency(avgPerMonth);
}

/**
 * Render expense list
 */
function renderExpenseList() {
  const tbody = document.getElementById('expense-list-body');
  if (!tbody) return;
  
  const filterMonth = document.getElementById('expense-month-filter').value;
  let filteredExpenses = expenses;
  
  if (filterMonth !== 'all') {
    filteredExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      const expYearMonth = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;
      return expYearMonth === filterMonth;
    });
  }
  
  if (filteredExpenses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No expenses found.</td></tr>';
    return;
  }
  
  tbody.innerHTML = filteredExpenses.map(expense => {
    const date = new Date(expense.date);
    const formattedDate = date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
    
    return `
      <tr>
        <td>${formattedDate}</td>
        <td>${escapeHtml(expense.name)}</td>
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
  const place = document.getElementById('edit-expense-place').value.trim();
  const description = document.getElementById('edit-expense-description').value.trim();
  
  if (!name || isNaN(amount) || amount <= 0) {
    alert('Please fill in required fields correctly.');
    return;
  }
  
  const expensesRef = getExpensesRef();
  if (!expensesRef) return;
  
  const expense = {
    name: name,
    amount: amount,
    date: date,
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
    document.getElementById('chart-title').textContent = 'Daily Expenses - Selected Month';
    renderChart();
  });
  
  document.getElementById('monthly-chart').addEventListener('change', () => {
    currentChartType = 'monthly';
    document.getElementById('chart-title').textContent = 'Monthly Expenses - Year View';
    renderChart();
  });
}

/**
 * Initialize month filter
 */
function initMonthFilter() {
  const filter = document.getElementById('expense-month-filter');
  if (!filter) return;
  
  filter.addEventListener('change', () => {
    renderExpenseList();
  });
  
  // Initial update
  updateMonthFilter();
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
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  
  const sortedMonths = Array.from(yearMonths).sort().reverse();
  const currentValue = filter.value;
  
  filter.innerHTML = '<option value="all">All Months</option>' +
    sortedMonths.map(ym => {
      const [year, month] = ym.split('-');
      return `<option value="${ym}">${monthNames[parseInt(month) - 1]} ${year}</option>`;
    }).join('');
  
  // Restore previous selection if it still exists
  if (currentValue && Array.from(filter.options).some(opt => opt.value === currentValue)) {
    filter.value = currentValue;
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
 * Render daily expense chart (for selected month)
 */
function renderDailyExpenseChart(ctx) {
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = getCurrentYear();
  
  // Filter expenses for current month
  const monthExpenses = expenses.filter(exp => {
    const date = new Date(exp.date);
    return date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth;
  });
  
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
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

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Make functions available globally for onclick handlers
window.editExpense = editExpense;
window.deleteExpense = deleteExpense;
