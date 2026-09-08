export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** "2026-01" — the key tasks are stored under. */
export function yearMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** "2026-01-31" — the key weight entries are stored under. */
export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function toDateInput(date: Date): string {
  return dateKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function currentMonth(): number {
  return new Date().getMonth() + 1;
}

export function currentQuarter(): number {
  return Math.floor(new Date().getMonth() / 3) + 1;
}

export function isToday(year: number, month: number, day: number): boolean {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() + 1 === month && now.getDate() === day;
}

export function isWeekend(year: number, month: number, day: number): boolean {
  const dow = new Date(year, month - 1, day).getDay();
  return dow === 0 || dow === 6;
}

export function weekdayIndex(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day).getDay();
}

/** Parses "YYYY-MM-DD" without the UTC shift `new Date(str)` applies. */
export function parseDateKey(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function yearMonthOf(value: string): string {
  const d = parseDateKey(value);
  if (!d) return '';
  return yearMonthKey(d.getFullYear(), d.getMonth() + 1);
}

export function allDatesInYear(year: number): string[] {
  const out: string[] = [];
  for (let month = 1; month <= 12; month++) {
    const total = daysInMonth(year, month);
    for (let day = 1; day <= total; day++) out.push(dateKey(year, month, day));
  }
  return out;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysElapsedInMonth(year: number, month: number): number {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) return now.getDate();
  if (now.getFullYear() < year || (now.getFullYear() === year && now.getMonth() + 1 < month)) return 1;
  return daysInMonth(year, month);
}

export function daysElapsedInYear(year: number): number {
  const now = new Date();
  if (now.getFullYear() < year) return 1;
  if (now.getFullYear() > year) return isLeapYear(year) ? 366 : 365;
  const start = new Date(year, 0, 1);
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function monthsElapsedInYear(year: number): number {
  const now = new Date();
  if (now.getFullYear() < year) return 1;
  if (now.getFullYear() > year) return 12;
  return now.getMonth() + 1;
}

export function formatDateLabel(value: string): string {
  const d = parseDateKey(value);
  if (!d) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(value: string): string {
  const d = parseDateKey(value);
  if (!d) return value;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
