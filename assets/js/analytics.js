// Analytics page functionality (Modular Firebase v9+)
import { getCurrentMonth, getCurrentYear, getYearMonth, getTasksRef } from './auth.js';
import { child, get } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

let currentMonth = getCurrentMonth();
let currentYear = getCurrentYear();
let dailyChart = null;
let monthlyChart = null;
let taskChart = null;

/**
 * Initialize analytics page
 */
export function initAnalytics() {
  currentYear = getCurrentYear();
  currentMonth = getCurrentMonth();
  
  // Initialize month selector
  initMonthSelector();
  
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
