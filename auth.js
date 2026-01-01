// Authentication utilities (Modular Firebase v9+)
import { auth, database } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { ref, child } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js';

/**
 * Check if user is authenticated
 * Redirects to login if not authenticated
 */
export function requireAuth() {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        window.location.href = 'login.html';
        reject(new Error('User not authenticated'));
      }
    });
  });
}

/**
 * Get current user
 * Returns null if not authenticated
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Get current user UID
 */
export function getCurrentUserId() {
  const user = getCurrentUser();
  return user ? user.uid : null;
}

/**
 * Get current year (default) or selected year
 */
export function getCurrentYear() {
  const stored = localStorage.getItem('selectedYear');
  return stored ? parseInt(stored) : new Date().getFullYear();
}

/**
 * Set selected year
 */
export function setSelectedYear(year) {
  localStorage.setItem('selectedYear', year.toString());
}

/**
 * Get current month (1-12)
 */
export function getCurrentMonth() {
  return new Date().getMonth() + 1;
}

/**
 * Get year-month string (e.g., "2026-01")
 */
export function getYearMonth(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Get database reference for user's year data
 */
export function getUserYearRef(year = null) {
  const uid = getCurrentUserId();
  if (!uid) return null;
  const selectedYear = year || getCurrentYear();
  return ref(database, `users/${uid}/years/${selectedYear}`);
}

/**
 * Get database reference for user's goals
 */
export function getGoalsRef(year = null) {
  const yearRef = getUserYearRef(year);
  return yearRef ? child(yearRef, 'goals') : null;
}

/**
 * Get database reference for user's tasks
 */
export function getTasksRef(year = null) {
  const yearRef = getUserYearRef(year);
  return yearRef ? child(yearRef, 'tasks') : null;
}

/**
 * Get database reference for user's expenses
 */
export function getExpensesRef(year = null) {
  const yearRef = getUserYearRef(year);
  return yearRef ? child(yearRef, 'expenses') : null;
}

/**
 * Handle logout
 */
export async function handleLogout() {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Logout error:', error);
    alert('Error logging out. Please try again.');
  }
}
