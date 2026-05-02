// Dashboard functionality: Goals and Daily Task Tracker (Modular Firebase v9+)
import { getCurrentMonth, getCurrentYear, getYearMonth, getGoalsRef, getTasksRef } from './auth.js';
import { child, get, set, remove } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

let currentMonth = getCurrentMonth();
let currentYear = getCurrentYear();
let tasks = [];
let goals = {
  yearly: [],
  quarterly: [],
  monthly: []
};

/**
 * Initialize dashboard
 */
export function initDashboard() {
  currentYear = getCurrentYear();
  currentMonth = getCurrentMonth();
  
  // Initialize month selector
  initMonthSelector();
  
  // Load goals
  loadGoals();
  
  // Load tasks
  loadTasks();
  
  // Check for goal resets
  checkGoalResets();
}

/**
 * Initialize month selector
 */
function initMonthSelector() {
  const monthSelector = document.getElementById('month-selector');
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
    loadTasks();
  });
}

/**
 * Load goals from Firebase
 */
function loadGoals() {
  const goalsRef = getGoalsRef();
  if (!goalsRef) return;
  
  // Load yearly goals
  get(child(goalsRef, 'yearly')).then((snapshot) => {
    goals.yearly = snapshot.val() || [];
    renderGoals('yearly');
  });
  
  // Load quarterly goals
  get(child(goalsRef, 'quarterly')).then((snapshot) => {
    goals.quarterly = snapshot.val() || [];
    renderGoals('quarterly');
  });
  
  // Load monthly goals
  get(child(goalsRef, 'monthly')).then((snapshot) => {
    goals.monthly = snapshot.val() || [];
    renderGoals('monthly');
  });
}

/**
 * Render goals for a specific type
 */
function renderGoals(type) {
  const listElement = document.getElementById(`${type}-goals-list`);
  if (!listElement) return;
  
  const goalList = goals[type] || [];
  
  if (goalList.length === 0) {
    listElement.innerHTML = '<p class="text-muted small mb-0">No goals yet. Click "+ Add" to create one.</p>';
    return;
  }
  
  listElement.innerHTML = goalList.map((goal, index) => {
    const completedClass = goal.completed ? 'completed' : '';
    return `
      <div class="goal-item ${completedClass}" data-index="${index}">
        <div class="goal-input-group">
          <input type="checkbox" class="form-check-input" ${goal.completed ? 'checked' : ''} 
                 onchange="window.toggleGoal('${type}', ${index})">
          <input type="text" class="goal-text" value="${escapeHtml(goal.text)}" 
                 onblur="window.updateGoal('${type}', ${index}, this.value)"
                 onkeypress="if(event.key==='Enter') this.blur()">
          <div class="goal-actions">
            <button class="btn btn-sm btn-link text-danger p-0" onclick="window.deleteGoal('${type}', ${index})" title="Delete">
              ×
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Add a new goal
 */
export function addGoal(type) {
  const goalList = goals[type] || [];
  const newGoal = {
    text: '',
    completed: false,
    createdAt: Date.now()
  };
  
  goalList.push(newGoal);
  goals[type] = goalList;
  
  saveGoals(type);
  renderGoals(type);
  
  // Focus on the new goal input
  setTimeout(() => {
    const listElement = document.getElementById(`${type}-goals-list`);
    const lastInput = listElement.querySelector('.goal-item:last-child .goal-text');
    if (lastInput) {
      lastInput.focus();
      lastInput.select();
    }
  }, 100);
}

/**
 * Update goal text
 */
export function updateGoal(type, index, text) {
  if (!goals[type] || !goals[type][index]) return;
  
  goals[type][index].text = text.trim();
  if (goals[type][index].text === '') {
    // Remove empty goals
    goals[type].splice(index, 1);
  }
  
  saveGoals(type);
  renderGoals(type);
}

/**
 * Toggle goal completion
 */
export function toggleGoal(type, index) {
  if (!goals[type] || !goals[type][index]) return;
  
  goals[type][index].completed = !goals[type][index].completed;
  saveGoals(type);
  renderGoals(type);
}

/**
 * Delete goal
 */
export function deleteGoal(type, index) {
  if (!goals[type] || !goals[type][index]) return;
  
  if (confirm('Delete this goal?')) {
    goals[type].splice(index, 1);
    saveGoals(type);
    renderGoals(type);
  }
}

/**
 * Save goals to Firebase
 */
function saveGoals(type) {
  const goalsRef = getGoalsRef();
  if (!goalsRef) return;
  
  set(child(goalsRef, type), goals[type]);
}

/**
 * Show goal history
 */
export function showGoalHistory(type) {
  const goalsRef = getGoalsRef();
  if (!goalsRef) return;
  
  const typeNames = {
    yearly: 'Yearly',
    quarterly: 'Quarterly',
    monthly: 'Monthly'
  };
  
  document.getElementById('goalHistoryModalTitle').textContent = `${typeNames[type]} Goals History`;
  
  get(child(child(goalsRef, 'history'), type)).then((snapshot) => {
    const history = snapshot.val() || [];
    
    if (history.length === 0) {
      document.getElementById('goalHistoryModalBody').innerHTML = '<p class="text-muted">No history yet.</p>';
    } else {
      // Group by period
      const grouped = {};
      history.forEach(item => {
        const period = item.period || 'Unknown';
        if (!grouped[period]) grouped[period] = [];
        grouped[period].push(item);
      });
      
      let html = '';
      Object.keys(grouped).sort().reverse().forEach(period => {
        const items = grouped[period];
        const completed = items.filter(g => g.completed).length;
        html += `
          <div class="mb-3">
            <h6>${period}</h6>
            <p class="small text-muted">${completed}/${items.length} completed</p>
            <ul class="list-unstyled">
              ${items.map(goal => `
                <li class="${goal.completed ? 'text-decoration-line-through text-muted' : ''}">
                  ${escapeHtml(goal.text)}
                </li>
              `).join('')}
            </ul>
          </div>
        `;
      });
      
      document.getElementById('goalHistoryModalBody').innerHTML = html;
    }
    
    const modal = new bootstrap.Modal(document.getElementById('goalHistoryModal'));
    modal.show();
  });
}

/**
 * Check and handle goal resets
 */
function checkGoalResets() {
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const currentMonthNum = now.getMonth() + 1;
  
  const goalsRef = getGoalsRef();
  if (!goalsRef) return;
  
  // Check monthly reset - track last active month in metadata
  get(child(goalsRef, 'monthly')).then((snapshot) => {
    const monthlyGoals = snapshot.val() || [];
    if (monthlyGoals.length > 0 && Array.isArray(monthlyGoals)) {
      // Check metadata for last month
      get(child(child(goalsRef, '_metadata'), 'lastMonth')).then((metaSnapshot) => {
        const lastMonth = metaSnapshot.val() || currentMonthNum;
        
        if (lastMonth !== currentMonthNum) {
          // Archive current goals before resetting
          archiveGoals('monthly', `Month ${lastMonth}/${currentYear}`, () => {
            set(child(goalsRef, 'monthly'), []);
            set(child(child(goalsRef, '_metadata'), 'lastMonth'), currentMonthNum);
            goals.monthly = [];
            renderGoals('monthly');
          });
        } else {
          // Update metadata if not set
          if (!metaSnapshot.val()) {
            set(child(child(goalsRef, '_metadata'), 'lastMonth'), currentMonthNum);
          }
        }
      });
    }
  });
  
  // Check quarterly reset
  get(child(goalsRef, 'quarterly')).then((snapshot) => {
    const quarterlyGoals = snapshot.val() || [];
    if (quarterlyGoals.length > 0 && Array.isArray(quarterlyGoals)) {
      get(child(child(goalsRef, '_metadata'), 'lastQuarter')).then((metaSnapshot) => {
        const lastQuarter = metaSnapshot.val() || currentQuarter;
        
        if (lastQuarter !== currentQuarter) {
          archiveGoals('quarterly', `Q${lastQuarter} ${currentYear}`, () => {
            set(child(goalsRef, 'quarterly'), []);
            set(child(child(goalsRef, '_metadata'), 'lastQuarter'), currentQuarter);
            goals.quarterly = [];
            renderGoals('quarterly');
          });
        } else {
          if (!metaSnapshot.val()) {
            set(child(child(goalsRef, '_metadata'), 'lastQuarter'), currentQuarter);
          }
        }
      });
    }
  });
}

/**
 * Archive goals to history
 */
function archiveGoals(type, period, callback) {
  const goalsRef = getGoalsRef();
  if (!goalsRef) {
    if (callback) callback();
    return;
  }
  
  const currentGoals = goals[type] || [];
  if (currentGoals.length === 0) {
    if (callback) callback();
    return;
  }
  
  get(child(child(goalsRef, 'history'), type)).then((snapshot) => {
    const history = snapshot.val() || [];
    
    currentGoals.forEach(goal => {
      history.push({
        ...goal,
        period: period,
        archivedAt: Date.now()
      });
    });
    
    set(child(child(goalsRef, 'history'), type), history).then(() => {
      if (callback) callback();
    });
  });
}

/**
 * Load tasks from Firebase
 */
function loadTasks() {
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  get(child(tasksRef, yearMonth)).then((snapshot) => {
    const tasksData = snapshot.val() || {};
    
    // Convert to array format
    tasks = Object.keys(tasksData).map(taskName => ({
      name: taskName,
      days: tasksData[taskName] || {}
    }));
    
    renderTaskTable();
  });
}

/**
 * Render task table
 */
function renderTaskTable() {
  const container = document.getElementById('task-table-container');
  if (!container) return;
  
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
  const dayNames = ['S', 'M', 'T', 'W', 'Th', 'F', 'S'];
  
  // Build header
  let headerHtml = '<table class="table table-sm mb-0"><thead><tr><th class="task-name-cell">Task</th>';
  
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(currentYear, currentMonth - 1, day);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isToday = isCurrentDay(day);
    const weekendClass = isWeekend ? 'weekend-column' : '';
    const todayClass = isToday ? 'current-day' : '';
    
    headerHtml += `<th class="${weekendClass} ${todayClass}">
      <div>${dayNames[dayOfWeek]}</div>
      <div>${day}</div>
    </th>`;
  }
  
  headerHtml += '</tr></thead><tbody>';
  
  // Build task rows
  if (tasks.length === 0) {
    headerHtml += `<tr><td colspan="${daysInMonth + 1}" class="text-center text-muted p-4">
      No tasks yet. Add a task by typing in the input below.
    </td></tr>`;
  } else {
    tasks.forEach((task, taskIndex) => {
      headerHtml += `<tr>
        <td class="task-name-cell">
          <input type="text" class="form-control form-control-sm border-0 bg-transparent" 
                 value="${escapeHtml(task.name)}" 
                 onblur="window.updateTaskName(${taskIndex}, this.value)"
                 onkeypress="if(event.key==='Enter') this.blur()">
        </td>`;
      
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(currentYear, currentMonth - 1, day);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isToday = isCurrentDay(day);
        const weekendClass = isWeekend ? 'weekend-column' : '';
        const todayClass = isToday ? 'current-day' : '';
        const checked = task.days[day] === true ? 'checked' : '';
        
        headerHtml += `<td class="${weekendClass} ${todayClass}">
          <input type="checkbox" class="form-check-input task-checkbox" ${checked}
                 onchange="window.toggleTaskDay(${taskIndex}, ${day})">
        </td>`;
      }
      
      headerHtml += '</tr>';
    });
  }
  
  // Add new task row
  headerHtml += `<tr>
    <td class="task-name-cell">
      <input type="text" class="form-control form-control-sm" 
             id="new-task-input" 
             placeholder="Add new task..." 
             onkeypress="if(event.key==='Enter') window.addNewTask(this.value)">
    </td>`;
  
  for (let day = 1; day <= daysInMonth; day++) {
    headerHtml += '<td></td>';
  }
  
  headerHtml += '</tr></tbody></table>';
  
  container.innerHTML = headerHtml;
}

/**
 * Check if a day is today
 */
function isCurrentDay(day) {
  const today = new Date();
  return today.getFullYear() === currentYear &&
         today.getMonth() + 1 === currentMonth &&
         today.getDate() === day;
}

/**
 * Add new task
 */
export function addNewTask(taskName) {
  if (!taskName || !taskName.trim()) return;
  
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  const cleanName = taskName.trim();
  
  // Check if task already exists
  if (tasks.some(t => t.name === cleanName)) {
    alert('Task already exists');
    return;
  }
  
  set(child(child(tasksRef, yearMonth), cleanName), {});
  
  tasks.push({
    name: cleanName,
    days: {}
  });
  
  renderTaskTable();
  
  // Clear input
  setTimeout(() => {
    const input = document.getElementById('new-task-input');
    if (input) input.value = '';
  }, 100);
}

/**
 * Update task name
 */
export function updateTaskName(taskIndex, newName) {
  if (!tasks[taskIndex] || !newName || !newName.trim()) {
    // If empty, delete task
    if (tasks[taskIndex]) {
      deleteTask(taskIndex);
    }
    return;
  }
  
  const oldName = tasks[taskIndex].name;
  const cleanName = newName.trim();
  
  if (oldName === cleanName) return;
  
  // Check if new name already exists
  if (tasks.some(t => t.name === cleanName && t !== tasks[taskIndex])) {
    alert('Task name already exists');
    renderTaskTable();
    return;
  }
  
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  // Update in Firebase
  const taskData = tasks[taskIndex].days;
  remove(child(child(tasksRef, yearMonth), oldName));
  set(child(child(tasksRef, yearMonth), cleanName), taskData);
  
  tasks[taskIndex].name = cleanName;
}

/**
 * Delete task
 */
function deleteTask(taskIndex) {
  if (!tasks[taskIndex]) return;
  
  const taskName = tasks[taskIndex].name;
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  remove(child(child(tasksRef, yearMonth), taskName));
  tasks.splice(taskIndex, 1);
  renderTaskTable();
}

/**
 * Toggle task day completion
 */
export function toggleTaskDay(taskIndex, day) {
  if (!tasks[taskIndex]) return;
  
  const task = tasks[taskIndex];
  const isCompleted = task.days[day] === true;
  
  const yearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  // Update in Firebase immediately
  set(child(child(child(tasksRef, yearMonth), task.name), day.toString()), !isCompleted);
  
  // Update local state
  if (isCompleted) {
    delete task.days[day];
  } else {
    task.days[day] = true;
  }
}

/**
 * Copy tasks from previous month
 */
export function copyTasksFromPreviousMonth() {
  if (!confirm('Copy all tasks from the previous month?')) return;
  
  let prevMonth = currentMonth - 1;
  let prevYear = currentYear;
  
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  
  const prevYearMonth = getYearMonth(prevYear, prevMonth);
  const currentYearMonth = getYearMonth(currentYear, currentMonth);
  const tasksRef = getTasksRef();
  if (!tasksRef) return;
  
  get(child(tasksRef, prevYearMonth)).then((snapshot) => {
    const prevTasks = snapshot.val() || {};
    
    if (Object.keys(prevTasks).length === 0) {
      alert('No tasks found in previous month');
      return;
    }
    
    // Copy tasks (without day completions)
    const newTasks = {};
    Object.keys(prevTasks).forEach(taskName => {
      newTasks[taskName] = {};
    });
    
    set(child(tasksRef, currentYearMonth), newTasks).then(() => {
      // Reload tasks
      loadTasks();
    });
  });
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
window.addGoal = addGoal;
window.updateGoal = updateGoal;
window.toggleGoal = toggleGoal;
window.deleteGoal = deleteGoal;
window.showGoalHistory = showGoalHistory;
window.addNewTask = addNewTask;
window.updateTaskName = updateTaskName;
window.toggleTaskDay = toggleTaskDay;
window.copyTasksFromPreviousMonth = copyTasksFromPreviousMonth;
