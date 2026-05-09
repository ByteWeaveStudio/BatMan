// Analytics page functionality (Modular Firebase v9+)
import { getCurrentMonth, getCurrentYear, getYearMonth, getTasksRef, getWeightRef, getWeightTargetsRef } from './auth.js';
import { child, get, set, remove } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

let currentMonth = getCurrentMonth();
let currentYear = getCurrentYear();
let dailyChart = null;
let monthlyChart = null;
let taskChart = null;
let weightChart = null;
let weightEntries = {};   // { 'YYYY-MM-DD': number }
let weightTargets = {};   // { '1'..'12': number }
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Initialize analytics page
 */
export function initAnalytics() {
  currentYear = getCurrentYear();
  currentMonth = getCurrentMonth();
  
  // Initialize month selector
  initMonthSelector();

  // Wire up weight tracker controls
  initWeightTracker();

  // Load and render charts
  loadAnalyticsData();
}

/**
 * Initialize month selector
 */
function initMonthSelector() {
  const monthSelector = document.getElementById('analytics-month-selector');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  monthSelector.innerHTML = monthNames.map((name, index) => {
    const monthNum = index + 1;
    return `<option value="${monthNum}" ${monthNum === currentMonth ? 'selected' : ''}>${name}</option>`;
  }).join('');
  
  monthSelector.addEventListener('change', (e) => {
    currentMonth = parseInt(e.target.value);
    loadAnalyticsData();
  });
}

/**
 * Load analytics data from Firebase
 */
function loadAnalyticsData() {
  // Load monthly average data for the year
  loadMonthlyAverageData();

  // Load yearly completion heatmap
  loadYearlyCompletionHeatmap();

  // Load task-wise completion data for selected month
  loadTaskWiseCompletionData();

  // Load weight log for the year
  loadWeightData();
}

/**
 * Load daily completion percentage for the entire year
 */
function loadYearlyCompletionHeatmap() {
  const tasksRef = getTasksRef();
  if (!tasksRef) return;

  const completionByDate = {};
  let monthsLoaded = 0;
  const totalMonths = 12;

  for (let month = 1; month <= totalMonths; month++) {
    const yearMonth = getYearMonth(currentYear, month);

    get(child(tasksRef, yearMonth)).then((snapshot) => {
      const tasksData = snapshot.val() || {};
      const daysInMonth = new Date(currentYear, month, 0).getDate();
      const taskNames = Object.keys(tasksData);

      for (let day = 1; day <= daysInMonth; day++) {
        let percentage = 0;

        if (taskNames.length > 0) {
          let completedCount = 0;
          taskNames.forEach(taskName => {
            const taskDays = tasksData[taskName] || {};
            if (taskDays[day] === true) {
              completedCount++;
            }
          });
          percentage = (completedCount / taskNames.length) * 100;
        }

        completionByDate[getDateKey(currentYear, month, day)] = percentage;
      }

      monthsLoaded++;
      if (monthsLoaded === totalMonths) {
        renderYearlyHeatmap(currentYear, completionByDate);
      }
    });
  }
}

function getDateKey(year, month, day) {
  const monthStr = String(month).padStart(2, '0');
  const dayStr = String(day).padStart(2, '0');
  return `${year}-${monthStr}-${dayStr}`;
}

function getCompletionColor(percentage) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const hue = clamped <= 50
    ? (clamped / 50) * 60
    : 60 + ((clamped - 50) / 50) * 60;

  const lightness = 55 - (clamped / 100) * 25;

  return `hsl(${hue}, 75%, ${lightness}%)`;
}

function renderHeatmapLegend(container) {
  container.innerHTML = '';

  const lowLabel = document.createElement('span');
  lowLabel.textContent = 'Low';
  container.appendChild(lowLabel);

  [0, 25, 50, 75, 100].forEach(value => {
    const swatch = document.createElement('span');
    swatch.className = 'heatmap-legend-swatch';
    swatch.style.backgroundColor = getCompletionColor(value);
    swatch.title = `${value}%`;
    container.appendChild(swatch);
  });

  const highLabel = document.createElement('span');
  highLabel.textContent = 'High';
  container.appendChild(highLabel);
}

function renderYearlyHeatmap(year, completionByDate) {
  const container = document.getElementById('yearlyHeatmap');
  if (!container) return;

  const legendContainer = document.getElementById('yearlyHeatmapLegend');
  if (legendContainer) {
    renderHeatmapLegend(legendContainer);
  }

  container.innerHTML = '';

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  const totalDays = Math.floor((endDate - startDate) / 86400000) + 1;
  const startOffset = (startDate.getDay() + 6) % 7;
  const totalCells = startOffset + totalDays;
  const weeksCount = Math.ceil(totalCells / 7);
  const today = new Date();
  const isCurrentYear = today.getFullYear() === year;

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthsRow = document.createElement('div');
  monthsRow.className = 'heatmap-months';
  monthsRow.style.gridTemplateColumns = `repeat(${weeksCount}, 1fr)`;

  for (let month = 0; month < 12; month++) {
    const firstOfMonth = new Date(year, month, 1);
    const dayOfYear = Math.floor((firstOfMonth - startDate) / 86400000);
    const weekIndex = Math.floor((startOffset + dayOfYear) / 7);

    const label = document.createElement('span');
    label.className = 'heatmap-month-label';
    label.style.gridColumn = `${weekIndex + 1}`;
    label.textContent = monthNames[month];
    monthsRow.appendChild(label);
  }

  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  grid.style.gridTemplateColumns = `repeat(${weeksCount}, 1fr)`;

  const gap = 3;
  const availableWidth = container.clientWidth || 0;
  const tentativeSize = (availableWidth - gap * (weeksCount - 1)) / weeksCount;
  const cellSize = Math.max(10, Math.min(20, Math.floor(tentativeSize)));
  grid.style.setProperty('--heatmap-cell-size', `${cellSize}px`);
  grid.style.setProperty('--heatmap-cell-gap', `${gap}px`);

  for (let i = 0; i < startOffset; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'heatmap-cell empty';
    grid.appendChild(emptyCell);
  }

  const currentDate = new Date(year, 0, 1);
  for (let dayIndex = 0; dayIndex < totalDays; dayIndex++) {
    const dateKey = getDateKey(year, currentDate.getMonth() + 1, currentDate.getDate());
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    if (isCurrentYear && currentDate > today) {
      cell.classList.add('future');
      cell.title = `${dateKey}: future`;
    } else {
      const percentage = completionByDate[dateKey] ?? 0;
      cell.style.backgroundColor = getCompletionColor(percentage);
      cell.title = `${dateKey}: ${Math.round(percentage)}%`;
    }
    grid.appendChild(cell);

    currentDate.setDate(currentDate.getDate() + 1);
  }

  container.appendChild(monthsRow);
  container.appendChild(grid);
}

/**
 * Load monthly average completion for the year
 */
function loadMonthlyAverageData() {
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyAverages = [];
  const labels = [];
  
  let monthsLoaded = 0;
  const totalMonths = 12;
  
  for (let month = 1; month <= totalMonths; month++) {
    const yearMonth = getYearMonth(currentYear, month);
    labels.push(monthNames[month - 1]);
    
    get(child(tasksRef, yearMonth)).then((snapshot) => {
      const tasksData = snapshot.val() || {};
      const daysInMonth = new Date(currentYear, month, 0).getDate();
      
      const taskNames = Object.keys(tasksData);
      if (taskNames.length === 0) {
        monthlyAverages[month - 1] = 0;
      } else {
        let totalCompletion = 0;
        let totalPossible = taskNames.length * daysInMonth;
        
        taskNames.forEach(taskName => {
          const taskDays = tasksData[taskName] || {};
          for (let day = 1; day <= daysInMonth; day++) {
            if (taskDays[day] === true) {
              totalCompletion++;
            }
          }
        });
        
        const average = totalPossible > 0 
          ? (totalCompletion / totalPossible) * 100 
          : 0;
        monthlyAverages[month - 1] = average;
      }
      
      monthsLoaded++;
      if (monthsLoaded === totalMonths) {
        renderMonthlyChart(labels, monthlyAverages);
      }
    });
  }
}

/**
 * Render monthly average chart
 */
function renderMonthlyChart(labels, data) {
  const ctx = document.getElementById('monthlyAverageChart');
  if (!ctx) return;
  
  if (monthlyChart) {
    monthlyChart.destroy();
  }
  
  monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Average Completion %',
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
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      animation: false
    }
  });
}

/**
 * Load task-wise completion data for selected month
 */
function loadTaskWiseCompletionData() {
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  get(child(tasksRef, yearMonth)).then((snapshot) => {
    const tasksData = snapshot.val() || {};
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    const taskNames = Object.keys(tasksData);
    const labels = [];
    const completionData = [];
    
    taskNames.forEach(taskName => {
      labels.push(taskName);
      const taskDays = tasksData[taskName] || {};
      
      let completedDays = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        if (taskDays[day] === true) {
          completedDays++;
        }
      }
      
      const percentage = (completedDays / daysInMonth) * 100;
      completionData.push(percentage);
    });
    
    renderTaskWiseChart(labels, completionData);
  });
}

/**
 * Render task-wise completion chart
 */
function renderTaskWiseChart(labels, data) {
  const ctx = document.getElementById('taskWiseChart');
  if (!ctx) return;
  
  if (taskChart) {
    taskChart.destroy();
  }
  
  if (labels.length === 0) {
    ctx.parentElement.innerHTML = '<div class="text-center text-muted p-4">No tasks found for this month.</div>';
    return;
  }
  
  taskChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Completion %',
        data: data,
        backgroundColor: '#868e96',
        borderColor: '#495057',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      indexAxis: 'y',
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: 100,
          ticks: {
            callback: function(value) {
              return value + '%';
            }
          }
        }
      },
      animation: false
    }
  });
}

/* ---------- Weight tracker ---------- */

function initWeightTracker() {
  const dateInput = document.getElementById('weightDate');
  const valueInput = document.getElementById('weightValue');
  const addBtn = document.getElementById('weightAddBtn');
  if (!dateInput || !valueInput || !addBtn) return;

  // Default the date picker to today (clamped to the selected year so adding
  // a stray entry to a different year is hard to do by accident).
  dateInput.value = defaultWeightDate();
  // Restrict to entries within the currently selected year.
  dateInput.min = `${currentYear}-01-01`;
  dateInput.max = `${currentYear}-12-31`;

  addBtn.addEventListener('click', handleAddWeight);
  valueInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddWeight();
    }
  });

  const targetsBtn = document.getElementById('weightTargetsBtn');
  const saveTargetsBtn = document.getElementById('weightTargetsSaveBtn');
  if (targetsBtn) {
    targetsBtn.addEventListener('click', renderWeightTargetsModal);
  }
  if (saveTargetsBtn) {
    saveTargetsBtn.addEventListener('click', handleSaveTargets);
  }
}

function defaultWeightDate() {
  const today = new Date();
  if (today.getFullYear() === currentYear) {
    return formatDateInput(today);
  }
  // For past/future years, default to Jan 1 of that year
  return `${currentYear}-01-01`;
}

function formatDateInput(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

async function loadWeightData() {
  const weightRefRoot = getWeightRef();
  const targetsRef = getWeightTargetsRef();
  if (!weightRefRoot) return;
  try {
    const [weightSnap, targetsSnap] = await Promise.all([
      get(weightRefRoot),
      targetsRef ? get(targetsRef) : Promise.resolve(null)
    ]);
    weightEntries = weightSnap.exists() ? (weightSnap.val() || {}) : {};
    weightTargets = (targetsSnap && targetsSnap.exists()) ? (targetsSnap.val() || {}) : {};
    renderWeightChart();
    renderWeightLatest();
  } catch (err) {
    console.error('Failed to load weight log:', err);
  }
}

async function handleAddWeight() {
  const dateInput = document.getElementById('weightDate');
  const valueInput = document.getElementById('weightValue');
  if (!dateInput || !valueInput) return;

  const dateKey = dateInput.value;
  const raw = parseFloat(valueInput.value);

  if (!dateKey) {
    alert('Please pick a date.');
    return;
  }
  if (!dateKey.startsWith(`${currentYear}-`)) {
    alert(`Date must be within ${currentYear}. Switch year in the header to log for another year.`);
    return;
  }
  if (!Number.isFinite(raw) || raw <= 0) {
    alert('Please enter a valid weight.');
    valueInput.focus();
    return;
  }

  const value = Math.round(raw * 10) / 10; // store 1 decimal place
  const ref = getWeightRef();
  if (!ref) return;

  try {
    await set(child(ref, dateKey), value);
    weightEntries = { ...weightEntries, [dateKey]: value };
    valueInput.value = '';
    renderWeightChart();
    renderWeightLatest();
  } catch (err) {
    console.error('Failed to save weight:', err);
    alert('Could not save. Please try again.');
  }
}

async function handleDeleteWeight(dateKey) {
  const ref = getWeightRef();
  if (!ref || !dateKey) return;
  if (!confirm(`Delete weight entry for ${dateKey}?`)) return;
  try {
    await remove(child(ref, dateKey));
    const next = { ...weightEntries };
    delete next[dateKey];
    weightEntries = next;
    renderWeightChart();
    renderWeightLatest();
  } catch (err) {
    console.error('Failed to delete weight:', err);
    alert('Could not delete. Please try again.');
  }
}

function renderWeightLatest() {
  const el = document.getElementById('weightLatest');
  if (!el) return;
  const sorted = Object.keys(weightEntries).sort();
  if (sorted.length === 0) {
    el.textContent = '';
    return;
  }
  const lastDate = sorted[sorted.length - 1];
  const value = weightEntries[lastDate];
  el.textContent = `Latest: ${value} kg on ${lastDate}`;
}

function renderWeightChart() {
  const ctx = document.getElementById('weightChart');
  const empty = document.getElementById('weightEmpty');
  if (!ctx) return;

  // Always span the full year regardless of whether data exists.
  const allDates = generateYearDates(currentYear);
  const hasAnyEntry = Object.keys(weightEntries).length > 0;
  const hasAnyTarget = Object.keys(weightTargets).length > 0;
  const hasAny = hasAnyEntry || hasAnyTarget;

  ctx.classList.toggle('d-none', !hasAny);
  if (empty) empty.classList.toggle('d-none', hasAny);

  if (weightChart) {
    weightChart.destroy();
    weightChart = null;
  }
  if (!hasAny) return;

  // Weight series: actual value or null per day (spanGaps stitches the line).
  const weightSeries = allDates.map(d => (d in weightEntries) ? weightEntries[d] : null);

  // Target series: month's target for every day in that month, or null if unset.
  const targetSeries = allDates.map(d => {
    const month = parseInt(d.slice(5, 7), 10);
    const t = weightTargets[String(month)];
    return (t === undefined || t === null || t === '') ? null : Number(t);
  });

  weightChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allDates,
      datasets: [
        {
          label: 'Weight (kg)',
          data: weightSeries,
          backgroundColor: 'rgba(79, 70, 229, 0.15)',
          borderColor: '#4f46e5',
          borderWidth: 2,
          pointRadius: (ctx) => ctx.parsed?.y == null ? 0 : 4,
          pointHoverRadius: (ctx) => ctx.parsed?.y == null ? 0 : 6,
          pointBackgroundColor: '#4f46e5',
          tension: 0.25,
          fill: true,
          spanGaps: true
        },
        {
          label: 'Target (kg)',
          data: targetSeries,
          borderColor: '#dc2626',
          borderWidth: 2,
          borderDash: [6, 4],
          pointRadius: 0,
          pointHoverRadius: 0,
          fill: false,
          spanGaps: false,
          tension: 0
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      aspectRatio: 4,
      onClick: (event, elements) => {
        const weightHit = elements.find(e => e.datasetIndex === 0);
        if (!weightHit) return;
        const dateKey = allDates[weightHit.index];
        if (!(dateKey in weightEntries)) return;
        handleDeleteWeight(dateKey);
      },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: { boxWidth: 14, boxHeight: 2, padding: 12 }
        },
        tooltip: {
          callbacks: {
            title: (items) => items[0].label,
            label: (item) => {
              if (item.parsed.y == null) return null;
              if (item.datasetIndex === 0) return `Weight: ${item.parsed.y} kg  ·  click to delete`;
              return `Target: ${item.parsed.y} kg`;
            }
          },
          filter: (item) => item.parsed.y != null
        }
      },
      scales: {
        x: {
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            callback: function(_value, index) {
              const dateStr = allDates[index];
              if (!dateStr) return '';
              return dateStr.endsWith('-01') ? MONTH_SHORT[parseInt(dateStr.slice(5, 7), 10) - 1] : '';
            }
          },
          grid: { display: false }
        },
        y: {
          beginAtZero: false,
          ticks: { callback: (v) => `${v} kg` }
        }
      },
      animation: false
    }
  });
}

function generateYearDates(year) {
  const out = [];
  const cur = new Date(year, 0, 1);
  while (cur.getFullYear() === year) {
    out.push(formatDateInput(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/* ---------- Targets modal ---------- */

function renderWeightTargetsModal() {
  const grid = document.getElementById('weightTargetsGrid');
  if (!grid) return;
  grid.innerHTML = MONTH_NAMES.map((name, i) => {
    const monthNum = i + 1;
    const value = weightTargets[String(monthNum)];
    const valStr = (value === undefined || value === null || value === '') ? '' : String(value);
    return `
      <div class="col-6 col-md-4">
        <label class="form-label small text-muted mb-1">${name}</label>
        <div class="input-group input-group-sm">
          <input type="number" step="0.1" min="0" class="form-control"
                 data-target-month="${monthNum}" value="${valStr}" placeholder="--">
          <span class="input-group-text">kg</span>
        </div>
      </div>
    `;
  }).join('');
}

async function handleSaveTargets() {
  const grid = document.getElementById('weightTargetsGrid');
  if (!grid) return;
  const inputs = grid.querySelectorAll('[data-target-month]');
  const next = {};
  for (const input of inputs) {
    const month = input.dataset.targetMonth;
    const raw = input.value.trim();
    if (raw === '') continue; // empty = no target for that month
    const num = parseFloat(raw);
    if (!Number.isFinite(num) || num <= 0) {
      alert(`Invalid value for ${MONTH_NAMES[parseInt(month, 10) - 1]}.`);
      input.focus();
      return;
    }
    next[month] = Math.round(num * 10) / 10;
  }

  const ref = getWeightTargetsRef();
  if (!ref) return;
  try {
    await set(ref, next);
    weightTargets = next;
    renderWeightChart();
    const modalEl = document.getElementById('weightTargetsModal');
    if (modalEl && window.bootstrap?.Modal) {
      window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
    }
  } catch (err) {
    console.error('Failed to save targets:', err);
    alert('Could not save targets. Please try again.');
  }
}
