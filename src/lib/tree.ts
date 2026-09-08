import { PILLARS, type AreaNode, type GrowthTree, type Pillar, type TaskNode, type TopicNode } from './types';

/** RTDB drops empty array slots and can hand arrays back as objects. */
export function normalizeList(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  if (typeof value === 'object') {
    return Object.keys(value as object)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (value as Record<string, unknown>)[k])
      .filter((v): v is Record<string, unknown> => !!v && typeof v === 'object');
  }
  return [];
}

function safeId(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeTasks(value: unknown, parentId: string): TaskNode[] {
  return normalizeList(value).map((n, i) => ({
    id: safeId(n.id, `${parentId}.${i + 1}`),
    name: (n.name as string) || `Item ${i + 1}`,
    description: (n.description as string) || '',
    completed: n.completed === true,
  }));
}

function normalizeTopics(value: unknown, parentId: string): TopicNode[] {
  return normalizeList(value).map((n, i) => {
    const id = safeId(n.id, `${parentId}.${i + 1}`);
    return { id, name: (n.name as string) || `Item ${i + 1}`, children: normalizeTasks(n.children, id) };
  });
}

function normalizeAreas(value: unknown): AreaNode[] {
  return normalizeList(value).map((n, i) => {
    const id = safeId(n.id, `${i + 1}`);
    return { id, name: (n.name as string) || `Item ${i + 1}`, children: normalizeTopics(n.children, id) };
  });
}

function emptyTree(): GrowthTree {
  return { Health: [], Relationships: [], Finance: [], 'Career & Studies': [] };
}

export function normalizeTree(raw: unknown): GrowthTree {
  const source = (raw ?? {}) as Record<string, unknown>;
  const out = emptyTree();
  PILLARS.forEach((p) => {
    out[p] = normalizeAreas(source[p]);
  });
  return out;
}

/** Ids are dotted paths ("2.3.1"); the next sibling takes max(last segment) + 1. */
export function createChildId(parentId: string | null, siblings: { id: string }[]): string {
  const max = siblings.reduce((acc, s) => {
    const parts = String(s.id ?? '').split('.');
    const seg = Number.parseInt(parts[parts.length - 1], 10);
    return Number.isFinite(seg) ? Math.max(acc, seg) : acc;
  }, 0);
  const next = max + 1;
  return parentId ? `${parentId}.${next}` : `${next}`;
}

export function topicProgress(topic: TopicNode): number {
  const tasks = topic.children ?? [];
  if (tasks.length === 0) return 0;
  return (tasks.filter((t) => t.completed).length / tasks.length) * 100;
}

export function areaProgress(area: AreaNode): number {
  const topics = area.children ?? [];
  if (topics.length === 0) return 0;
  return topics.reduce((sum, t) => sum + topicProgress(t), 0) / topics.length;
}

export function pillarProgress(areas: AreaNode[]): number {
  if (areas.length === 0) return 0;
  return areas.reduce((sum, a) => sum + areaProgress(a), 0) / areas.length;
}

export function countTasks(areas: AreaNode[]): { total: number; done: number } {
  let total = 0;
  let done = 0;
  areas.forEach((a) =>
    a.children.forEach((t) =>
      t.children.forEach((task) => {
        total += 1;
        if (task.completed) done += 1;
      }),
    ),
  );
  return { total, done };
}

const PILLAR_VARS: Record<Pillar, string> = {
  Health: 'health',
  Relationships: 'relationships',
  Finance: 'finance',
  'Career & Studies': 'career',
};

export function pillarVar(pillar: Pillar | null | undefined): string {
  return pillar ? `var(--pillar-${PILLAR_VARS[pillar]})` : 'var(--accent)';
}

export function pillarShortName(pillar: Pillar): string {
  return pillar === 'Career & Studies' ? 'Career' : pillar;
}
