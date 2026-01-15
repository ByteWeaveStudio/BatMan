// Portfolio page functionality (Modular Firebase v9+)
import { getPortfolioRef } from './auth.js';
import { child, get, set, onValue } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

let portfolioData = {
  openingBalance: 0,
  months: {}
};
let portfolioListener = null;

// Month names in order
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Initialize portfolio page
 */
export function initPortfolio() {  
  // Initialize opening balance input
  initOpeningBalance();
  
  // Load portfolio data
  loadPortfolio();
}

/**
 * Initialize opening balance input
 */
function initOpeningBalance() {
  const input = document.getElementById('opening-balance');
  if (!input) return;
  
  // Debounce save on blur
  let saveTimeout;
  input.addEventListener('blur', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveOpeningBalance();
    }, 300);
  });
  
  // Save on Enter key
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  });
}

/**
 * Load portfolio data from Firebase
 */
function loadPortfolio() {
  const portfolioRef = getPortfolioRef();
  if (!portfolioRef) return;
  
  // Initialize months with default values
  initializeMonths();
  
  // Remove existing listener if any
  if (portfolioListener) {
    portfolioListener(); // onValue returns an unsubscribe function
  }
  
  // Listen for real-time updates
  portfolioListener = onValue(portfolioRef, (snapshot) => {
    const data = snapshot.val() || {};
    
    // Load opening balance
    portfolioData.openingBalance = data.openingBalance || 0;
    document.getElementById('opening-balance').value = portfolioData.openingBalance;
    
    // Load month data
    if (data.months) {
      MONTHS.forEach(monthKey => {
        if (data.months[monthKey]) {
          portfolioData.months[monthKey] = {
            personal: data.months[monthKey].personal || 0,
            family: data.months[monthKey].family || 0,
            rent: data.months[monthKey].rent || 0,
            loan: data.months[monthKey].loan || 0,
            misc: data.months[monthKey].misc || 0,
            mainIncome: data.months[monthKey].mainIncome || 0,
            sideIncome: data.months[monthKey].sideIncome || 0
          };
        }
      });
    }
    
    // Render table
    renderTable();
    
    // Update summary
    updateSummary();
  }, (error) => {
    console.error('Error loading portfolio:', error);
    // Still render with default values
    renderTable();
    updateSummary();
  });
}

/**
 * Initialize months with default values
 */
function initializeMonths() {
  MONTHS.forEach(monthKey => {
    if (!portfolioData.months[monthKey]) {
      portfolioData.months[monthKey] = {
        personal: 0,
        family: 0,
        rent: 0,
        loan: 0,
        misc: 0,
        mainIncome: 0,
        sideIncome: 0
      };
    }
  });
}

/**
 * Render portfolio table
 */
function renderTable() {
  const tbody = document.getElementById('portfolio-table-body');
  if (!tbody) return;
  
  let html = '';
  
  // Render month rows
  MONTHS.forEach((monthKey, index) => {
    const monthData = portfolioData.months[monthKey] || {
      personal: 0,
      family: 0,
      rent: 0,
      loan: 0,
      misc: 0,
      mainIncome: 0,
      sideIncome: 0
    };
    
    // Calculate totals for this month
    const totalExpense = monthData.personal + monthData.family + monthData.rent + 
                         monthData.loan + monthData.misc;
    const totalIncome = monthData.mainIncome + monthData.sideIncome;
    const finalSavings = totalIncome - totalExpense;
    
    html += `
      <tr>
        <td class="fw-bold">${MONTH_NAMES[index]}</td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="personal" 
                 value="${monthData.personal || 0}" step="0.01" min="0">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="family" 
                 value="${monthData.family || 0}" step="0.01" min="0">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="rent" 
                 value="${monthData.rent || 0}" step="0.01" min="0">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="loan" 
                 value="${monthData.loan || 0}" step="0.01" min="0">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="misc" 
                 value="${monthData.misc || 0}" step="0.01" min="0">
        </td>
        <td class="text-end fw-bold">${formatCurrency(totalExpense)}</td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="mainIncome" 
                 value="${monthData.mainIncome || 0}" step="0.01" min="0">
        </td>
        <td>
          <input type="number" class="form-control form-control-sm portfolio-input" 
                 data-month="${monthKey}" data-field="sideIncome" 
                 value="${monthData.sideIncome || 0}" step="0.01" min="0">
        </td>
        <td class="text-end fw-bold">${formatCurrency(totalIncome)}</td>
        <td class="text-end fw-bold ${finalSavings >= 0 ? 'text-success' : 'text-danger'}">
          ${formatCurrency(finalSavings)}
        </td>
      </tr>
    `;
  });
  
  // Calculate TOTAL row
  let totalPersonal = 0, totalFamily = 0, totalRent = 0, totalLoan = 0, totalMisc = 0;
  let totalExpenseSum = 0, totalMainIncome = 0, totalSideIncome = 0;
  let totalIncomeSum = 0, totalSavingsSum = 0;
  
  MONTHS.forEach(monthKey => {
    const monthData = portfolioData.months[monthKey] || {
      personal: 0,
      family: 0,
      rent: 0,
      loan: 0,
      misc: 0,
      mainIncome: 0,
      sideIncome: 0
    };
    
    totalPersonal += monthData.personal || 0;
    totalFamily += monthData.family || 0;
    totalRent += monthData.rent || 0;
    totalLoan += monthData.loan || 0;
    totalMisc += monthData.misc || 0;
    totalMainIncome += monthData.mainIncome || 0;
    totalSideIncome += monthData.sideIncome || 0;
    
    const monthTotalExpense = (monthData.personal || 0) + (monthData.family || 0) + 
                             (monthData.rent || 0) + (monthData.loan || 0) + (monthData.misc || 0);
    const monthTotalIncome = (monthData.mainIncome || 0) + (monthData.sideIncome || 0);
    const monthSavings = monthTotalIncome - monthTotalExpense;
    
    totalExpenseSum += monthTotalExpense;
    totalIncomeSum += monthTotalIncome;
    totalSavingsSum += monthSavings;
  });
  
  // Add TOTAL row
  html += `
    <tr class="table-secondary fw-bold">
      <td>TOTAL</td>
      <td class="text-end">${formatCurrency(totalPersonal)}</td>
      <td class="text-end">${formatCurrency(totalFamily)}</td>
      <td class="text-end">${formatCurrency(totalRent)}</td>
      <td class="text-end">${formatCurrency(totalLoan)}</td>
      <td class="text-end">${formatCurrency(totalMisc)}</td>
      <td class="text-end">${formatCurrency(totalExpenseSum)}</td>
      <td class="text-end">${formatCurrency(totalMainIncome)}</td>
      <td class="text-end">${formatCurrency(totalSideIncome)}</td>
      <td class="text-end">${formatCurrency(totalIncomeSum)}</td>
      <td class="text-end ${totalSavingsSum >= 0 ? 'text-success' : 'text-danger'}">
        ${formatCurrency(totalSavingsSum)}
      </td>
    </tr>
  `;
  
  tbody.innerHTML = html;
  
  // Attach event listeners to inputs
  attachInputListeners();
}

/**
 * Attach event listeners to portfolio inputs
 */
function attachInputListeners() {
  const inputs = document.querySelectorAll('.portfolio-input');
  inputs.forEach(input => {
    // Remove existing listeners by cloning
    const newInput = input.cloneNode(true);
    input.parentNode.replaceChild(newInput, input);
    
    // Add debounced save
    let saveTimeout;
    newInput.addEventListener('blur', () => {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveMonthField(newInput);
        renderTable(); // Re-render to update computed values
        updateSummary();
      }, 300);
    });
    
    // Save on Enter key
    newInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
      }
    });
  });
}

/**
 * Save month field value to Firebase
 */
function saveMonthField(input) {
  const monthKey = input.getAttribute('data-month');
  const field = input.getAttribute('data-field');
  let value = parseFloat(input.value);
  
  // Handle empty or invalid values
  if (isNaN(value) || value < 0) {
    value = 0;
    input.value = 0;
  }
  
  if (!monthKey || !field) return;
  
  // Update local data
  if (!portfolioData.months[monthKey]) {
    portfolioData.months[monthKey] = {
      personal: 0,
      family: 0,
      rent: 0,
      loan: 0,
      misc: 0,
      mainIncome: 0,
      sideIncome: 0
    };
  }
  
  portfolioData.months[monthKey][field] = value;
  
  // Save to Firebase
  const portfolioRef = getPortfolioRef();
  if (!portfolioRef) return;
  
  const monthRef = child(child(portfolioRef, 'months'), monthKey);
  get(monthRef).then((snapshot) => {
    const monthData = snapshot.val() || {
      personal: 0,
      family: 0,
      rent: 0,
      loan: 0,
      misc: 0,
      mainIncome: 0,
      sideIncome: 0
    };
    
    monthData[field] = value;
    set(monthRef, monthData);
  });
}

/**
 * Save opening balance to Firebase
 */
function saveOpeningBalance() {
  const input = document.getElementById('opening-balance');
  if (!input) return;
  
  let value = parseFloat(input.value);
  // Handle empty or invalid values
  if (isNaN(value) || value < 0) {
    value = 0;
    input.value = 0;
  }
  
  portfolioData.openingBalance = value;
  
  const portfolioRef = getPortfolioRef();
  if (!portfolioRef) return;
  
  set(child(portfolioRef, 'openingBalance'), value);
}

/**
 * Update summary cards
 */
function updateSummary() {
  // Calculate total savings (sum of Final Savings for all months)
  let totalSavings = 0;
  
  MONTHS.forEach(monthKey => {
    const monthData = portfolioData.months[monthKey] || {
      personal: 0,
      family: 0,
      rent: 0,
      loan: 0,
      misc: 0,
      mainIncome: 0,
      sideIncome: 0
    };
    
    const totalExpense = (monthData.personal || 0) + (monthData.family || 0) + 
                         (monthData.rent || 0) + (monthData.loan || 0) + (monthData.misc || 0);
    const totalIncome = (monthData.mainIncome || 0) + (monthData.sideIncome || 0);
    const savings = totalIncome - totalExpense;
    
    totalSavings += savings;
  });
  
  // Update Total Savings
  document.getElementById('total-savings').textContent = formatSummaryAmount(totalSavings);
  
  // Calculate Closing Balance = Opening Balance + Total Savings
  const openingBalance = portfolioData.openingBalance || 0;
  const closingBalance = openingBalance + totalSavings;
  
  // Update Closing Balance
  document.getElementById('closing-balance').textContent = formatSummaryAmount(closingBalance);
}

/**
 * Format currency
 */
function formatCurrency(amount) {
  return '₹' + Math.abs(amount).toFixed(2);
}

function formatSummaryAmount(amount) {
  return '₹' + Math.abs(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}