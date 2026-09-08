/* Shapes stored under users/{uid}/years/{year}. Kept identical to the v1 schema. */

export type GoalType = 'yearly' | 'quarterly' | 'monthly';

export interface Goal {
  text: string;
  completed: boolean;
  createdAt: number;
}

export interface ArchivedGoal extends Goal {
  period: string;
  archivedAt: number;
}

export type GoalHistory = Partial<Record<GoalType, ArchivedGoal[]>>;

export interface GoalsNode {
  yearly?: Goal[];
  quarterly?: Goal[];
  monthly?: Goal[];
  history?: GoalHistory;
  _metadata?: { lastMonth?: number; lastQuarter?: number };
}

/** tasks/{YYYY-MM}/{taskName}/{day} = true */
export type TaskDays = Record<string, boolean>;
export type MonthTasks = Record<string, TaskDays>;

export interface Task {
  name: string;
  days: TaskDays;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  date: string;
  categoryId: string;
  place?: string;
  description?: string;
  createdAt: number;
  updatedAt?: number;
}

export type ExpenseDraft = Omit<Expense, 'id'>;

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export const PORTFOLIO_MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'may', 'jun',
  'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
] as const;

export type PortfolioMonthKey = (typeof PORTFOLIO_MONTHS)[number];

export type PortfolioFieldKey =
  | 'personal'
  | 'family'
  | 'rent'
  | 'loan'
  | 'misc'
  | 'mainIncome'
  | 'sideIncome';

export interface LineItem {
  date: string;
  description: string;
  amount: number;
}

export interface PortfolioCell {
  lineItems: LineItem[];
}

export type PortfolioMonth = Record<PortfolioFieldKey, PortfolioCell>;

export interface Portfolio {
  openingBalance: number;
  months: Record<PortfolioMonthKey, PortfolioMonth>;
}

export const PILLARS = ['Health', 'Relationships', 'Finance', 'Career & Studies'] as const;
export type Pillar = (typeof PILLARS)[number];

export interface TaskNode {
  id: string;
  name: string;
  description: string;
  completed: boolean;
}

export interface TopicNode {
  id: string;
  name: string;
  children: TaskNode[];
}

export interface AreaNode {
  id: string;
  name: string;
  children: TopicNode[];
}

export type GrowthTree = Record<Pillar, AreaNode[]>;

/** weight/{YYYY-MM-DD} = kg */
export type WeightLog = Record<string, number>;
/** weightTargets/{1..12} = kg */
export type WeightTargets = Record<string, number>;
