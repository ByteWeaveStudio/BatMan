import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '../../components/Confirm';
import { Icon } from '../../components/Icon';
import { EmptyState, Progress } from '../../components/primitives';
import { useIsTablet } from '../../hooks/useMediaQuery';
import { EMPTY_SELECTION, findArea, findTask, findTopic, type Selection, type useGrowthTree } from '../../hooks/useGrowthTree';
import { areaProgress, pillarProgress, pillarShortName, pillarVar, topicProgress } from '../../lib/tree';
import { PILLARS, type AreaNode, type Pillar, type TaskNode, type TopicNode } from '../../lib/types';
import { AddRow, DescriptionField, EditableTitle, NodeRow } from './parts';

type Api = ReturnType<typeof useGrowthTree>;

interface TreeViewProps {
  api: Api;
  selection: Selection;
  setSelection: (next: Selection) => void;
}

export function TreeView(props: TreeViewProps) {
  const isTablet = useIsTablet();
  return isTablet ? <ColumnLayout {...props} /> : <DrillLayout {...props} />;
}

/* ---------------- Shared panel pieces ---------------- */

function Panel({
  accent,
  breadcrumb,
  title,
  meta,
  progress,
  onAdd,
  onRename,
  onDelete,
  children,
  className = '',
}: {
  accent: string;
  breadcrumb?: string;
  title: string;
  meta?: string;
  progress?: number;
  onAdd?: () => void;
  onRename?: (next: string) => void;
  onDelete?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  // A different node in the same slot must not inherit edit mode.
  useEffect(() => setEditing(false), [title]);

  return (
    <section className={`panel ${className}`.trim()} style={{ ['--panel-accent' as string]: accent }}>
      <header className="panel__header">
        {breadcrumb ? <p className="panel__breadcrumb truncate">{breadcrumb}</p> : null}
        <div className="panel__title-row">
          {onRename ? (
            <EditableTitle value={title} editing={editing} onEditingChange={setEditing} onCommit={onRename} />
          ) : (
            <h2 className="panel__title truncate">{title}</h2>
          )}
          <div className="panel__actions">
            {onAdd ? (
              <button type="button" className="icon-btn" onClick={onAdd} aria-label={`Add to ${title}`} title="Add">
                <Icon name="plus" />
              </button>
            ) : null}
            {onRename && !editing ? (
              <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={`Rename ${title}`} title="Rename">
                <Icon name="edit" />
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" className="icon-btn icon-btn--danger" onClick={onDelete} aria-label={`Delete ${title}`} title="Delete">
                <Icon name="trash" />
              </button>
            ) : null}
          </div>
        </div>
        {meta !== undefined || progress !== undefined ? (
          <div className="panel__meta-row">
            {meta ? <span className="panel__meta">{meta}</span> : <span />}
            {progress !== undefined ? <span className="panel__pct">{Math.round(progress)}%</span> : null}
          </div>
        ) : null}
        {progress !== undefined ? <Progress value={progress} color={accent} thin /> : null}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}

function AreaList({
  areas,
  accent,
  selectedId,
  onSelect,
  adding,
  onStartAdd,
  onCancelAdd,
  onAdd,
  emptyLabel,
}: {
  areas: AreaNode[];
  accent: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  adding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (name: string) => void;
  emptyLabel: string;
}) {
  return (
    <>
      {areas.length === 0 && !adding ? (
        <EmptyState
          icon="spark"
          title={emptyLabel}
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={onStartAdd}>
              <Icon name="plus" />
              Add the first one
            </button>
          }
          inline
        />
      ) : (
        <div className="node-list">
          {areas.map((area) => (
            <NodeRow
              key={area.id}
              name={area.name}
              progress={areaProgress(area)}
              accent={accent}
              selected={selectedId === area.id}
              onSelect={() => onSelect(area.id)}
            />
          ))}
        </div>
      )}
      {adding ? <AddRow placeholder="Name…" onAdd={onAdd} onCancel={onCancelAdd} /> : null}
    </>
  );
}

function TopicList({
  topics,
  accent,
  selectedId,
  onSelect,
  adding,
  onStartAdd,
  onCancelAdd,
  onAdd,
}: {
  topics: TopicNode[];
  accent: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  adding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (name: string) => void;
}) {
  return (
    <>
      {topics.length === 0 && !adding ? (
        <EmptyState
          icon="spark"
          title="No topics yet"
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={onStartAdd}>
              <Icon name="plus" />
              Add a topic
            </button>
          }
          inline
        />
      ) : (
        <div className="node-list">
          {topics.map((topic) => (
            <NodeRow
              key={topic.id}
              name={topic.name}
              progress={topicProgress(topic)}
              accent={accent}
              selected={selectedId === topic.id}
              onSelect={() => onSelect(topic.id)}
            />
          ))}
        </div>
      )}
      {adding ? <AddRow placeholder="Topic name…" onAdd={onAdd} onCancel={onCancelAdd} /> : null}
    </>
  );
}

function TaskList({
  tasks,
  accent,
  selectedId,
  onSelect,
  onToggle,
  adding,
  onStartAdd,
  onCancelAdd,
  onAdd,
}: {
  tasks: TaskNode[];
  accent: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string, next: boolean) => void;
  adding: boolean;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onAdd: (name: string) => void;
}) {
  return (
    <>
      {tasks.length === 0 && !adding ? (
        <EmptyState
          icon="target"
          title="No tasks yet"
          action={
            <button type="button" className="btn btn--secondary btn--sm" onClick={onStartAdd}>
              <Icon name="plus" />
              Add a task
            </button>
          }
          inline
        />
      ) : (
        <div className="node-list">
          {tasks.map((task) => (
            <NodeRow
              key={task.id}
              name={task.name}
              accent={accent}
              selected={selectedId === task.id}
              completed={task.completed}
              onSelect={() => onSelect(task.id)}
              checkbox={{
                checked: task.completed,
                onChange: (next) => onToggle(task.id, next),
                label: `Mark “${task.name}” ${task.completed ? 'not done' : 'done'}`,
              }}
            />
          ))}
        </div>
      )}
      {adding ? <AddRow placeholder="Task name…" onAdd={onAdd} onCancel={onCancelAdd} /> : null}
    </>
  );
}

function TaskDetail({
  task,
  accent,
  onToggle,
  onDescription,
}: {
  task: TaskNode;
  accent: string;
  onToggle: (next: boolean) => void;
  onDescription: (next: string) => void;
}) {
  return (
    <div className="stack">
      <label className="task-status" style={{ ['--panel-accent' as string]: accent }}>
        <input type="checkbox" className="check check--accent" checked={task.completed} onChange={(e) => onToggle(e.target.checked)} />
        {task.completed ? 'Completed' : 'Mark as complete'}
      </label>
      <div className="field">
        <label className="label" htmlFor={`desc-${task.id}`}>
          Notes
        </label>
        <DescriptionField id={`desc-${task.id}`} value={task.description} onCommit={onDescription} />
      </div>
    </div>
  );
}

/* ---------------- Add-mode bookkeeping ---------------- */

type AddLevel = 'area' | 'topic' | 'task' | null;

function useAdding() {
  const [level, setLevel] = useState<AddLevel>(null);
  const [pillar, setPillar] = useState<Pillar | null>(null);
  return {
    level,
    pillar,
    start(next: AddLevel, forPillar: Pillar | null = null) {
      setLevel(next);
      setPillar(forPillar);
    },
    cancel() {
      setLevel(null);
      setPillar(null);
    },
  };
}

/* ---------------- Tablet / desktop columns ---------------- */

function ColumnLayout({ api, selection, setSelection }: TreeViewProps) {
  const confirm = useConfirm();
  const adding = useAdding();

  const area = findArea(api.tree, selection.pillar, selection.areaId);
  const topic = findTopic(api.tree, selection);
  const task = findTask(api.tree, selection);
  const accent = pillarVar(selection.pillar);

  async function confirmDelete(label: string, cascade: boolean) {
    return confirm({
      title: `Delete “${label}”?`,
      message: cascade ? 'Everything nested under it goes too. This can’t be undone.' : 'This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
  }

  return (
    <>
      <div className="pillar-grid">
        {PILLARS.map((pillar) => {
          const areas = api.areasOf(pillar);
          const pAccent = pillarVar(pillar);
          return (
            <Panel
              key={pillar}
              accent={pAccent}
              title={pillar}
              progress={pillarProgress(areas)}
              meta={`${areas.length} area${areas.length === 1 ? '' : 's'}`}
              className={selection.pillar === pillar ? 'is-active' : ''}
              onAdd={() => adding.start('area', pillar)}
            >
              <AreaList
                areas={areas}
                accent={pAccent}
                selectedId={selection.pillar === pillar ? selection.areaId : null}
                onSelect={(id) => {
                  adding.cancel();
                  setSelection({ pillar, areaId: id, topicId: null, taskId: null });
                }}
                adding={adding.level === 'area' && adding.pillar === pillar}
                onStartAdd={() => adding.start('area', pillar)}
                onCancelAdd={adding.cancel}
                onAdd={async (name) => {
                  const id = await api.addArea(pillar, name);
                  adding.cancel();
                  if (id) setSelection({ pillar, areaId: id, topicId: null, taskId: null });
                }}
                emptyLabel="No areas yet"
              />
            </Panel>
          );
        })}
      </div>

      {area && selection.pillar ? (
        <div className="detail-grid">
          <Panel
            accent={accent}
            breadcrumb={selection.pillar}
            title={area.name}
            progress={areaProgress(area)}
            meta={`${area.children.length} topic${area.children.length === 1 ? '' : 's'}`}
            onAdd={() => adding.start('topic')}
            onRename={(next) => void api.rename(selection.pillar!, area.id, null, null, next)}
            onDelete={async () => {
              if (await confirmDelete(area.name, true)) {
                await api.removeNode(selection.pillar!, area.id, null, null);
                setSelection({ ...selection, areaId: null, topicId: null, taskId: null });
              }
            }}
          >
            <TopicList
              topics={area.children}
              accent={accent}
              selectedId={selection.topicId}
              onSelect={(id) => {
                adding.cancel();
                setSelection({ ...selection, topicId: id, taskId: null });
              }}
              adding={adding.level === 'topic'}
              onStartAdd={() => adding.start('topic')}
              onCancelAdd={adding.cancel}
              onAdd={async (name) => {
                const id = await api.addTopic(selection.pillar!, area.id, name);
                adding.cancel();
                if (id) setSelection({ ...selection, topicId: id, taskId: null });
              }}
            />
          </Panel>

          {topic ? (
            <Panel
              accent={accent}
              breadcrumb={`${pillarShortName(selection.pillar)} › ${area.name}`}
              title={topic.name}
              progress={topicProgress(topic)}
              meta={`${topic.children.filter((t) => t.completed).length} of ${topic.children.length} done`}
              onAdd={() => adding.start('task')}
              onRename={(next) => void api.rename(selection.pillar!, area.id, topic.id, null, next)}
              onDelete={async () => {
                if (await confirmDelete(topic.name, true)) {
                  await api.removeNode(selection.pillar!, area.id, topic.id, null);
                  setSelection({ ...selection, topicId: null, taskId: null });
                }
              }}
            >
              <TaskList
                tasks={topic.children}
                accent={accent}
                selectedId={selection.taskId}
                onSelect={(id) => {
                  adding.cancel();
                  setSelection({ ...selection, taskId: id });
                }}
                onToggle={(id, next) => void api.toggleTask(selection.pillar!, area.id, topic.id, id, next)}
                adding={adding.level === 'task'}
                onStartAdd={() => adding.start('task')}
                onCancelAdd={adding.cancel}
                onAdd={async (name) => {
                  const id = await api.addTask(selection.pillar!, area.id, topic.id, name);
                  adding.cancel();
                  if (id) setSelection({ ...selection, taskId: id });
                }}
              />
            </Panel>
          ) : null}

          {topic && task ? (
            <Panel
              accent={accent}
              breadcrumb={`${pillarShortName(selection.pillar)} › ${area.name} › ${topic.name}`}
              title={task.name}
              className="panel--detail"
              onRename={(next) => void api.rename(selection.pillar!, area.id, topic.id, task.id, next)}
              onDelete={async () => {
                if (await confirmDelete(task.name, false)) {
                  await api.removeNode(selection.pillar!, area.id, topic.id, task.id);
                  setSelection({ ...selection, taskId: null });
                }
              }}
            >
              <TaskDetail
                task={task}
                accent={accent}
                onToggle={(next) => void api.toggleTask(selection.pillar!, area.id, topic.id, task.id, next)}
                onDescription={(next) => void api.setDescription(selection.pillar!, area.id, topic.id, task.id, next)}
              />
            </Panel>
          ) : null}
        </div>
      ) : (
        <p className="tree-hint">Pick an area above to drill into its topics and tasks.</p>
      )}
    </>
  );
}

/* ---------------- Phone drill-down ---------------- */

function DrillLayout({ api, selection, setSelection }: TreeViewProps) {
  const confirm = useConfirm();
  const adding = useAdding();

  const area = findArea(api.tree, selection.pillar, selection.areaId);
  const topic = findTopic(api.tree, selection);
  const task = findTask(api.tree, selection);
  const accent = pillarVar(selection.pillar);

  const level: 0 | 1 | 2 | 3 | 4 = task && topic ? 4 : topic ? 3 : area ? 2 : selection.pillar ? 1 : 0;

  const crumbs = useMemo(() => {
    const out: { label: string; onClick: () => void }[] = [{ label: 'Pillars', onClick: () => setSelection(EMPTY_SELECTION) }];
    if (selection.pillar) {
      out.push({
        label: pillarShortName(selection.pillar),
        onClick: () => setSelection({ pillar: selection.pillar, areaId: null, topicId: null, taskId: null }),
      });
    }
    if (area) out.push({ label: area.name, onClick: () => setSelection({ ...selection, topicId: null, taskId: null }) });
    if (topic) out.push({ label: topic.name, onClick: () => setSelection({ ...selection, taskId: null }) });
    if (task) out.push({ label: task.name, onClick: () => undefined });
    return out;
  }, [selection, area, topic, task, setSelection]);

  function back() {
    adding.cancel();
    if (level === 4) return setSelection({ ...selection, taskId: null });
    if (level === 3) return setSelection({ ...selection, topicId: null, taskId: null });
    if (level === 2) return setSelection({ pillar: selection.pillar, areaId: null, topicId: null, taskId: null });
    setSelection(EMPTY_SELECTION);
  }

  async function confirmDelete(label: string, cascade: boolean) {
    return confirm({
      title: `Delete “${label}”?`,
      message: cascade ? 'Everything nested under it goes too. This can’t be undone.' : 'This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
  }

  return (
    <div className="drill">
      {level > 0 ? (
        <div className="drill__bar">
          <button type="button" className="btn btn--ghost btn--sm" onClick={back}>
            <Icon name="arrowLeft" />
            Back
          </button>
          <nav className="drill__crumbs scroll-x" aria-label="Breadcrumb">
            {crumbs.map((c, i) => (
              <span key={`${c.label}-${i}`} className="drill__crumb">
                {i > 0 ? <Icon name="chevronRight" className="drill__sep" /> : null}
                <button type="button" onClick={c.onClick} disabled={i === crumbs.length - 1}>
                  {c.label}
                </button>
              </span>
            ))}
          </nav>
        </div>
      ) : null}

      {level === 0 ? (
        <div className="stack stack--sm">
          {PILLARS.map((pillar) => {
            const areas = api.areasOf(pillar);
            const pct = pillarProgress(areas);
            return (
              <button
                key={pillar}
                type="button"
                className="pillar-tile"
                style={{ ['--panel-accent' as string]: pillarVar(pillar) }}
                onClick={() => setSelection({ pillar, areaId: null, topicId: null, taskId: null })}
              >
                <span className="pillar-tile__top">
                  <span className="pillar-tile__name">{pillar}</span>
                  <span className="pillar-tile__pct">{Math.round(pct)}%</span>
                </span>
                <Progress value={pct} color={pillarVar(pillar)} thin />
                <span className="pillar-tile__meta">
                  {areas.length} area{areas.length === 1 ? '' : 's'}
                  <Icon name="chevronRight" />
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {level === 1 && selection.pillar ? (
        <Panel
          accent={accent}
          title={selection.pillar}
          progress={pillarProgress(api.areasOf(selection.pillar))}
          meta="Areas"
          onAdd={() => adding.start('area', selection.pillar)}
        >
          <AreaList
            areas={api.areasOf(selection.pillar)}
            accent={accent}
            selectedId={null}
            onSelect={(id) => setSelection({ ...selection, areaId: id, topicId: null, taskId: null })}
            adding={adding.level === 'area'}
            onStartAdd={() => adding.start('area', selection.pillar)}
            onCancelAdd={adding.cancel}
            onAdd={async (name) => {
              const id = await api.addArea(selection.pillar!, name);
              adding.cancel();
              if (id) setSelection({ ...selection, areaId: id, topicId: null, taskId: null });
            }}
            emptyLabel="No areas yet"
          />
        </Panel>
      ) : null}

      {level === 2 && area && selection.pillar ? (
        <Panel
          accent={accent}
          breadcrumb={selection.pillar}
          title={area.name}
          progress={areaProgress(area)}
          meta="Topics"
          onAdd={() => adding.start('topic')}
          onRename={(next) => void api.rename(selection.pillar!, area.id, null, null, next)}
          onDelete={async () => {
            if (await confirmDelete(area.name, true)) {
              await api.removeNode(selection.pillar!, area.id, null, null);
              setSelection({ pillar: selection.pillar, areaId: null, topicId: null, taskId: null });
            }
          }}
        >
          <TopicList
            topics={area.children}
            accent={accent}
            selectedId={null}
            onSelect={(id) => setSelection({ ...selection, topicId: id, taskId: null })}
            adding={adding.level === 'topic'}
            onStartAdd={() => adding.start('topic')}
            onCancelAdd={adding.cancel}
            onAdd={async (name) => {
              const id = await api.addTopic(selection.pillar!, area.id, name);
              adding.cancel();
              if (id) setSelection({ ...selection, topicId: id, taskId: null });
            }}
          />
        </Panel>
      ) : null}

      {level === 3 && area && topic && selection.pillar ? (
        <Panel
          accent={accent}
          breadcrumb={area.name}
          title={topic.name}
          progress={topicProgress(topic)}
          meta={`${topic.children.filter((t) => t.completed).length} of ${topic.children.length} done`}
          onAdd={() => adding.start('task')}
          onRename={(next) => void api.rename(selection.pillar!, area.id, topic.id, null, next)}
          onDelete={async () => {
            if (await confirmDelete(topic.name, true)) {
              await api.removeNode(selection.pillar!, area.id, topic.id, null);
              setSelection({ ...selection, topicId: null, taskId: null });
            }
          }}
        >
          <TaskList
            tasks={topic.children}
            accent={accent}
            selectedId={null}
            onSelect={(id) => setSelection({ ...selection, taskId: id })}
            onToggle={(id, next) => void api.toggleTask(selection.pillar!, area.id, topic.id, id, next)}
            adding={adding.level === 'task'}
            onStartAdd={() => adding.start('task')}
            onCancelAdd={adding.cancel}
            onAdd={async (name) => {
              const id = await api.addTask(selection.pillar!, area.id, topic.id, name);
              adding.cancel();
              if (id) setSelection({ ...selection, taskId: id });
            }}
          />
        </Panel>
      ) : null}

      {level === 4 && area && topic && task && selection.pillar ? (
        <Panel
          accent={accent}
          breadcrumb={topic.name}
          title={task.name}
          className="panel--detail"
          onRename={(next) => void api.rename(selection.pillar!, area.id, topic.id, task.id, next)}
          onDelete={async () => {
            if (await confirmDelete(task.name, false)) {
              await api.removeNode(selection.pillar!, area.id, topic.id, task.id);
              setSelection({ ...selection, taskId: null });
            }
          }}
        >
          <TaskDetail
            task={task}
            accent={accent}
            onToggle={(next) => void api.toggleTask(selection.pillar!, area.id, topic.id, task.id, next)}
            onDescription={(next) => void api.setDescription(selection.pillar!, area.id, topic.id, task.id, next)}
          />
        </Panel>
      ) : null}
    </div>
  );
}
