import { ref, type DatabaseReference } from 'firebase/database';
import { database } from './firebase';

type Section =
  | 'goals'
  | 'tasks'
  | 'expenses'
  | 'expenseCategories'
  | 'portfolio'
  | 'growthTree'
  | 'weight'
  | 'weightTargets';

export function sectionPath(uid: string, year: number, section: Section, ...rest: string[]): string {
  const tail = rest.length ? `/${rest.join('/')}` : '';
  return `users/${uid}/years/${year}/${section}${tail}`;
}

export function pathRef(path: string): DatabaseReference {
  return ref(database, path);
}
