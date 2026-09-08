import { useCallback } from 'react';
import { set } from 'firebase/database';
import { pathRef, sectionPath } from '../lib/paths';
import { useDbValue } from './useDbValue';
import { createChildId, normalizeTree } from '../lib/tree';
import type { AreaNode, GrowthTree, Pillar, TaskNode, TopicNode } from '../lib/types';

export interface Selection {
  pillar: Pillar | null;
  areaId: string | null;
  topicId: string | null;
  taskId: string | null;
}

export const EMPTY_SELECTION: Selection = { pillar: null, areaId: null, topicId: null, taskId: null };

export function useGrowthTree(uid: string, year: number) {
  const path = uid ? sectionPath(uid, year, 'growthTree') : null;
  // normalizeTree guarantees all four pillars client-side, so an empty year
  // needs no seed write — the first add creates its pillar branch.
  const { data: tree, loading } = useDbValue<GrowthTree>(path, normalizeTree);

  const base = useCallback(
    (...rest: string[]) => sectionPath(uid, year, 'growthTree', ...rest),
    [uid, year],
  );

  const areasOf = useCallback((pillar: Pillar) => tree[pillar] ?? [], [tree]);

  const indexOf = useCallback(
    (pillar: Pillar | null, areaId: string | null, topicId?: string | null, taskId?: string | null) => {
      if (!pillar) return null;
      const areas = tree[pillar] ?? [];
      const a = areas.findIndex((n) => n.id === areaId);
      if (a === -1) return null;
      if (topicId === undefined) return { a, t: -1, k: -1 };
      const topics = areas[a].children ?? [];
      const t = topics.findIndex((n) => n.id === topicId);
      if (t === -1) return { a, t: -1, k: -1 };
      if (taskId === undefined || taskId === null) return { a, t, k: -1 };
      const tasks = topics[t].children ?? [];
      const k = tasks.findIndex((n) => n.id === taskId);
      return { a, t, k };
    },
    [tree],
  );

  const addArea = useCallback(
    async (pillar: Pillar, name: string): Promise<string | null> => {
      const clean = name.trim();
      if (!uid || !clean) return null;
      const siblings = [...areasOf(pillar)];
      const node: AreaNode = { id: createChildId(null, siblings), name: clean, children: [] };
      siblings.push(node);
      await set(pathRef(base(pillar)), siblings);
      return node.id;
    },
    [uid, base, areasOf],
  );

  const addTopic = useCallback(
    async (pillar: Pillar, areaId: string, name: string): Promise<string | null> => {
      const clean = name.trim();
      const idx = indexOf(pillar, areaId);
      if (!uid || !clean || !idx) return null;
      const area = areasOf(pillar)[idx.a];
      const siblings = [...(area.children ?? [])];
      const node: TopicNode = { id: createChildId(area.id, siblings), name: clean, children: [] };
      siblings.push(node);
      await set(pathRef(base(pillar, String(idx.a), 'children')), siblings);
      return node.id;
    },
    [uid, base, areasOf, indexOf],
  );

  const addTask = useCallback(
    async (pillar: Pillar, areaId: string, topicId: string, name: string): Promise<string | null> => {
      const clean = name.trim();
      const idx = indexOf(pillar, areaId, topicId);
      if (!uid || !clean || !idx || idx.t === -1) return null;
      const topic = areasOf(pillar)[idx.a].children[idx.t];
      const siblings = [...(topic.children ?? [])];
      const node: TaskNode = { id: createChildId(topic.id, siblings), name: clean, description: '', completed: false };
      siblings.push(node);
      await set(pathRef(base(pillar, String(idx.a), 'children', String(idx.t), 'children')), siblings);
      return node.id;
    },
    [uid, base, areasOf, indexOf],
  );

  const rename = useCallback(
    async (pillar: Pillar, areaId: string, topicId: string | null, taskId: string | null, name: string) => {
      const clean = name.trim();
      if (!uid || !clean) return;
      const idx = indexOf(pillar, areaId, topicId ?? undefined, taskId ?? undefined);
      if (!idx) return;
      if (taskId) {
        if (idx.t === -1 || idx.k === -1) return;
        await set(pathRef(base(pillar, String(idx.a), 'children', String(idx.t), 'children', String(idx.k), 'name')), clean);
      } else if (topicId) {
        if (idx.t === -1) return;
        await set(pathRef(base(pillar, String(idx.a), 'children', String(idx.t), 'name')), clean);
      } else {
        await set(pathRef(base(pillar, String(idx.a), 'name')), clean);
      }
    },
    [uid, base, indexOf],
  );

  const removeNode = useCallback(
    async (pillar: Pillar, areaId: string, topicId: string | null, taskId: string | null) => {
      if (!uid) return;
      const idx = indexOf(pillar, areaId, topicId ?? undefined, taskId ?? undefined);
      if (!idx) return;
      const areas = areasOf(pillar);

      if (taskId) {
        if (idx.t === -1 || idx.k === -1) return;
        const next = [...areas[idx.a].children[idx.t].children];
        next.splice(idx.k, 1);
        await set(pathRef(base(pillar, String(idx.a), 'children', String(idx.t), 'children')), next);
        return;
      }
      if (topicId) {
        if (idx.t === -1) return;
        const next = [...areas[idx.a].children];
        next.splice(idx.t, 1);
        await set(pathRef(base(pillar, String(idx.a), 'children')), next);
        return;
      }
      const next = [...areas];
      next.splice(idx.a, 1);
      await set(pathRef(base(pillar)), next);
    },
    [uid, base, areasOf, indexOf],
  );

  const toggleTask = useCallback(
    async (pillar: Pillar, areaId: string, topicId: string, taskId: string, completed: boolean) => {
      const idx = indexOf(pillar, areaId, topicId, taskId);
      if (!uid || !idx || idx.t === -1 || idx.k === -1) return;
      await set(
        pathRef(base(pillar, String(idx.a), 'children', String(idx.t), 'children', String(idx.k), 'completed')),
        completed,
      );
    },
    [uid, base, indexOf],
  );

  const setDescription = useCallback(
    async (pillar: Pillar, areaId: string, topicId: string, taskId: string, description: string) => {
      const idx = indexOf(pillar, areaId, topicId, taskId);
      if (!uid || !idx || idx.t === -1 || idx.k === -1) return;
      await set(
        pathRef(base(pillar, String(idx.a), 'children', String(idx.t), 'children', String(idx.k), 'description')),
        description,
      );
    },
    [uid, base, indexOf],
  );

  return { tree, loading, areasOf, addArea, addTopic, addTask, rename, removeNode, toggleTask, setDescription };
}

export function findArea(tree: GrowthTree, pillar: Pillar | null, areaId: string | null): AreaNode | null {
  if (!pillar || !areaId) return null;
  return (tree[pillar] ?? []).find((n) => n.id === areaId) ?? null;
}

export function findTopic(tree: GrowthTree, sel: Selection): TopicNode | null {
  const area = findArea(tree, sel.pillar, sel.areaId);
  if (!area || !sel.topicId) return null;
  return area.children.find((n) => n.id === sel.topicId) ?? null;
}

export function findTask(tree: GrowthTree, sel: Selection): TaskNode | null {
  const topic = findTopic(tree, sel);
  if (!topic || !sel.taskId) return null;
  return topic.children.find((n) => n.id === sel.taskId) ?? null;
}
