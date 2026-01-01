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
  // Load daily completion data for selected month
  loadDailyCompletionData();
  
  // Load monthly average data for the year
  loadMonthlyAverageData();
  
  // Load task-wise completion data for selected month
  loadTaskWiseCompletionData();
}

/**
 * Load daily completion percentage for selected month
 */
function loadDailyCompletionData() {
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  get(child(tasksRef, yearMonth)).then((snapshot) => {
    const tasksData = snapshot.val() || {};
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // Calculate completion per day
    const dailyData = [];
    const labels = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      labels.push(`Day ${day}`);
      
      const taskNames = Object.keys(tasksData);
      if (taskNames.length === 0) {
        dailyData.push(0);
        continue;
      }
      
      let completedCount = 0;
      taskNames.forEach(taskName => {
        const taskDays = tasksData[taskName] || {};
        if (taskDays[day] === true) {
          completedCount++;
        }
      });
      
      const percentage = taskNames.length > 0 
        ? (completedCount / taskNames.length) * 100 
        : 0;
      dailyData.push(percentage);
    }
    
    renderDailyChart(labels, dailyData);
  });
}

/**
 * Render daily completion chart
 */
function renderDailyChart(labels, data) {
  const ctx = document.getElementById('dailyCompletionChart');
  if (!ctx) return;
  
  if (dailyChart) {
    dailyChart.destroy();
  }
  
  dailyChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Completion %',
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
