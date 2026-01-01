// Header component with year selector and navigation
import { getCurrentYear, getCurrentUser, setSelectedYear } from './auth.js';
import { handleLogout } from './auth.js';

/**
 * Initialize header with year selector and navigation
 */
export function initHeader() {
  const header = document.getElementById('app-header');
  if (!header) return;

  const currentYear = getCurrentYear();
  const currentUser = getCurrentUser();

  header.innerHTML = `
    <nav class="navbar navbar-expand-lg navbar-light bg-white border-bottom">
      <div class="container-fluid">
        <a class="navbar-brand fw-bold" href="dashboard.html">BatMan</a>
        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
          <span class="navbar-toggler-icon"></span>
        </button>
        <div class="collapse navbar-collapse" id="navbarNav">
          <ul class="navbar-nav me-auto">
            <li class="nav-item">
              <a class="nav-link" href="dashboard.html">Dashboard</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="analytics.html">Analytics</a>
            </li>
            <li class="nav-item">
              <a class="nav-link" href="expenses.html">Expenses</a>
            </li>
          </ul>
          <div class="d-flex align-items-center gap-3">
            <div class="d-flex align-items-center gap-2">
              <label for="year-selector" class="mb-0 small text-muted">Year:</label>
              <select id="year-selector" class="form-select form-select-sm" style="width: auto;">
                ${generateYearOptions(currentYear)}
              </select>
            </div>
            <div class="dropdown">
              <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                ${currentUser ? currentUser.email : 'User'}
              </button>
              <ul class="dropdown-menu dropdown-menu-end">
                <li><a class="dropdown-item" href="#" id="logout-link">Logout</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </nav>
  `;

  // Add year selector change handler
  const yearSelector = document.getElementById('year-selector');
  if (yearSelector) {
    yearSelector.addEventListener('change', (e) => {
      const newYear = parseInt(e.target.value);
      setSelectedYear(newYear);
      // Reload page to refresh data
      window.location.reload();
    });
  }

  // Add logout handler
  const logoutLink = document.getElementById('logout-link');
  if (logoutLink) {
    logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }
}

/**
 * Generate year options for selector
 */
function generateYearOptions(selectedYear) {
  const currentYear = new Date().getFullYear();
  const years = [];
  // Show current year and 2 years before/after
  for (let i = currentYear - 2; i <= currentYear + 2; i++) {
    years.push(i);
  }
  return years.map(year => 
    `<option value="${year}" ${year === selectedYear ? 'selected' : ''}>${year}</option>`
  ).join('');
}
