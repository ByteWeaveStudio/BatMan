import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfirm } from '../../components/Confirm';
import { Icon } from '../../components/Icon';
import { EmptyState, Progress } from '../../components/primitives';
import { useAuth } from '../../context/AuthContext';
import { findArea, findTask, findTopic, type Selection, type useGrowthTree } from '../../hooks/useGrowthTree';
import { areaProgress, pillarProgress, pillarShortName, pillarVar, topicProgress } from '../../lib/tree';
import { PILLARS, type AreaNode, type Pillar, type TopicNode } from '../../lib/types';
import { AddRow, DescriptionField, EditableTitle } from './parts';

type Api = ReturnType<typeof useGrowthTree>;

/* Angles use the maths convention: 0° = east, counter-clockwise. */
const PILLAR_ANGLE: Record<Pillar, number> = {
  Health: 135,
  Finance: 45,
  'Career & Studies': 315,
  Relationships: 225,
};

const RING = { pillar: 200, area: 360, topic: 470 };
const RADIUS = { centre: 50, pillar: 40, area: 22, topic: 11 };
const VIEW = { x: -640, y: -520, w: 1280, h: 1040 };
const ZOOM = { min: 0.4, max: 3, step: 1.2 };
const DRAG_THRESHOLD = 4;

interface Point {
  x: number;
  y: number;
}

function polar(r: number, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  return { x: r * Math.cos(rad), y: -r * Math.sin(rad) };
}

function arcSpan(count: number, level: 'area' | 'topic'): number {
  if (count <= 1) return 0;
  if (level === 'area') {
    if (count === 2) return 28;
    if (count === 3) return 40;
    if (count <= 5) return 52;
    return 60;
  }
  if (count === 2) return 12;
  if (count === 3) return 16;
  if (count <= 5) return 20;
  return 24;
}

interface LaidTopic extends TopicNode {
  pos: Point;
  angle: number;
  progress: number;
}
interface LaidArea extends AreaNode {
  pos: Point;
  angle: number;
  progress: number;
  topics: LaidTopic[];
}
interface LaidPillar {
  pillar: Pillar;
  pos: Point;
  angle: number;
  progress: number;
  areas: LaidArea[];
}

export function MindMapView({
  api,
  selection,
  setSelection,
}: {
  api: Api;
  selection: Selection;
  setSelection: (next: Selection) => void;
}) {
  const layout = useMemo<LaidPillar[]>(
    () =>
      PILLARS.map((pillar) => {
        const base = PILLAR_ANGLE[pillar];
        const areas = api.areasOf(pillar);
        const span = arcSpan(areas.length, 'area');
        return {
          pillar,
          pos: polar(RING.pillar, base),
          angle: base,
          progress: pillarProgress(areas),
          areas: areas.map((area, i) => {
            const offset = areas.length === 1 ? 0 : (i / (areas.length - 1) - 0.5) * span;
            const angle = base + offset;
            const topics = area.children ?? [];
            const tSpan = arcSpan(topics.length, 'topic');
            return {
              ...area,
              pos: polar(RING.area, angle),
              angle,
              progress: areaProgress(area),
              topics: topics.map((topic, j) => {
                const tOffset = topics.length === 1 ? 0 : (j / (topics.length - 1) - 0.5) * tSpan;
                const tAngle = angle + tOffset;
                return { ...topic, pos: polar(RING.topic, tAngle), angle: tAngle, progress: topicProgress(topic) };
              }),
            };
          }),
        };
      }),
    [api.areasOf],
  );

  return (
    <div className="mindmap">
      <Canvas layout={layout} selection={selection} setSelection={setSelection} />
      <MapPanel api={api} selection={selection} setSelection={setSelection} />
    </div>
  );
}

/* ---------------- Canvas ---------------- */

function Canvas({
  layout,
  selection,
  setSelection,
}: {
  layout: LaidPillar[];
  selection: Selection;
  setSelection: (next: Selection) => void;
}) {
  const { user } = useAuth();
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState({ ...VIEW });
  const viewRef = useRef(view);
  viewRef.current = view;

  const [panning, setPanning] = useState(false);
  const drag = useRef({ active: false, moved: false, cx: 0, cy: 0, vx: 0, vy: 0 });
  const pinch = useRef({ active: false, dist: 0, view: { ...VIEW }, anchor: { x: 0, y: 0 } });
  const suppressClick = useRef(false);

  const clientToSvg = useCallback((clientX: number, clientY: number): Point => {
    const el = svgRef.current;
    const v = viewRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scale = Math.min(rect.width / v.w, rect.height / v.h);
    const offsetX = (rect.width - v.w * scale) / 2;
    const offsetY = (rect.height - v.h * scale) / 2;
    return { x: (clientX - rect.left - offsetX) / scale + v.x, y: (clientY - rect.top - offsetY) / scale + v.y };
  }, []);

  const svgScale = useCallback(() => {
    const el = svgRef.current;
    const v = viewRef.current;
    if (!el) return 1;
    const rect = el.getBoundingClientRect();
    return Math.min(rect.width / v.w, rect.height / v.h) || 1;
  }, []);

  const zoomAt = useCallback(
    (clientX: number, clientY: number, factor: number) => {
      const v = viewRef.current;
      const minW = VIEW.w / ZOOM.max;
      const maxW = VIEW.w / ZOOM.min;
      const nextW = Math.max(minW, Math.min(maxW, v.w * factor));
      if (nextW === v.w) return;
      const ratio = nextW / v.w;
      const anchor = clientToSvg(clientX, clientY);
      setView({
        x: anchor.x - (anchor.x - v.x) * ratio,
        y: anchor.y - (anchor.y - v.y) * ratio,
        w: nextW,
        h: VIEW.h * (nextW / VIEW.w),
      });
    },
    [clientToSvg],
  );

  const zoomCentre = useCallback(
    (factor: number) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
    },
    [zoomAt],
  );

  // Native listeners: React's synthetic wheel/touch handlers can't preventDefault.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? ZOOM.step : 1 / ZOOM.step);
    };

    const onTouchStart = (e: TouchEvent) => {
      suppressClick.current = false;
      if (e.touches.length === 1) {
        const t = e.touches[0];
        if ((document.elementFromPoint(t.clientX, t.clientY) as Element | null)?.closest('[data-node]')) return;
        drag.current = { active: true, moved: false, cx: t.clientX, cy: t.clientY, vx: viewRef.current.x, vy: viewRef.current.y };
      } else if (e.touches.length === 2) {
        e.preventDefault();
        drag.current.active = false;
        const [a, b] = [e.touches[0], e.touches[1]];
        pinch.current = {
          active: true,
          dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
          view: { ...viewRef.current },
          anchor: clientToSvg((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && drag.current.active) {
        const t = e.touches[0];
        const dx = t.clientX - drag.current.cx;
        const dy = t.clientY - drag.current.cy;
        if (!drag.current.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) drag.current.moved = true;
        if (!drag.current.moved) return;
        e.preventDefault();
        const scale = svgScale();
        setView((v) => ({ ...v, x: drag.current.vx - dx / scale, y: drag.current.vy - dy / scale }));
      } else if (e.touches.length === 2 && pinch.current.active) {
        e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
        if (dist <= 0 || pinch.current.dist <= 0) return;
        // sqrt damping so a given finger spread moves the zoom half as far.
        const factor = Math.pow(pinch.current.dist / dist, 0.5);
        const minW = VIEW.w / ZOOM.max;
        const maxW = VIEW.w / ZOOM.min;
        const nextW = Math.max(minW, Math.min(maxW, pinch.current.view.w * factor));
        const ratio = nextW / pinch.current.view.w;
        setView({
          x: pinch.current.anchor.x - (pinch.current.anchor.x - pinch.current.view.x) * ratio,
          y: pinch.current.anchor.y - (pinch.current.anchor.y - pinch.current.view.y) * ratio,
          w: nextW,
          h: VIEW.h * (nextW / VIEW.w),
        });
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        if (drag.current.active) suppressClick.current = drag.current.moved;
        drag.current.active = false;
        drag.current.moved = false;
        pinch.current.active = false;
      } else if (e.touches.length === 1) {
        pinch.current.active = false;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [zoomAt, clientToSvg, svgScale]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.cx;
      const dy = e.clientY - drag.current.cy;
      if (!drag.current.moved && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) drag.current.moved = true;
      if (!drag.current.moved) return;
      const scale = svgScale();
      setView((v) => ({ ...v, x: drag.current.vx - dx / scale, y: drag.current.vy - dy / scale }));
    };
    const onUp = () => {
      if (!drag.current.active) return;
      drag.current.active = false;
      suppressClick.current = drag.current.moved;
      drag.current.moved = false;
      setPanning(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [svgScale]);

  function onMouseDown(e: React.MouseEvent) {
    suppressClick.current = false;
    if (e.button !== 0) return;
    if ((e.target as Element).closest('[data-node]')) return;
    drag.current = { active: true, moved: false, cx: e.clientX, cy: e.clientY, vx: view.x, vy: view.y };
    setPanning(true);
  }

  function select(next: Selection) {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    setSelection(next);
  }

  const dimmed = selection.pillar !== null;
  const centreName = (user?.displayName || user?.email || 'You').split('@')[0];

  return (
    <div className="mindmap__canvas-wrap">
      <svg
        ref={svgRef}
        className={`mindmap__canvas${panning ? ' is-panning' : ''}`}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={onMouseDown}
        onClick={(e) => {
          if ((e.target as Element).closest('[data-node]')) return;
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
          setSelection({ pillar: null, areaId: null, topicId: null, taskId: null });
        }}
        role="application"
        aria-label="Growth mind map. Use the list below to navigate with a keyboard."
      >
        {/* Branches, then nodes on top. */}
        {layout.map((p) => {
          const colour = pillarVar(p.pillar);
          const onBranch = selection.pillar === p.pillar;
          return (
            <g key={`b-${p.pillar}`}>
              <line
                className={`link${onBranch ? ' is-lit' : ''}`}
                x1={0}
                y1={0}
                x2={p.pos.x}
                y2={p.pos.y}
                stroke={colour}
                strokeWidth={onBranch ? 4.5 : 3.5}
                opacity={branchOpacity(p.progress, onBranch, dimmed)}
              />
              {p.areas.map((a) => {
                const litArea = onBranch && (!selection.areaId || selection.areaId === a.id);
                return (
                  <g key={`b-${p.pillar}-${a.id}`}>
                    <line
                      className={`link${litArea ? ' is-lit' : ''}`}
                      x1={p.pos.x}
                      y1={p.pos.y}
                      x2={a.pos.x}
                      y2={a.pos.y}
                      stroke={colour}
                      strokeWidth={litArea ? 2.5 : 2}
                      opacity={branchOpacity(a.progress, litArea, dimmed)}
                    />
                    {a.topics.map((tp) => {
                      const litTopic = litArea && (!selection.topicId || selection.topicId === tp.id);
                      return (
                        <line
                          key={`b-${tp.id}`}
                          className={`link${litTopic ? ' is-lit' : ''}`}
                          x1={a.pos.x}
                          y1={a.pos.y}
                          x2={tp.pos.x}
                          y2={tp.pos.y}
                          stroke={colour}
                          strokeWidth={litTopic ? 2 : 1.4}
                          opacity={branchOpacity(tp.progress, litTopic, dimmed)}
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          );
        })}

        {/* Ghost stubs invite the first child. */}
        {layout.map((p) => {
          const colour = pillarVar(p.pillar);
          if (p.areas.length === 0) {
            const tip = polar(RING.pillar + 80, p.angle);
            return (
              <g key={`hint-${p.pillar}`}>
                <line className="link is-ghost" x1={p.pos.x} y1={p.pos.y} x2={tip.x} y2={tip.y} stroke={colour} strokeWidth={1.5} opacity={0.5} />
                <AddHint
                  x={tip.x}
                  y={tip.y}
                  label={`Add an area to ${p.pillar}`}
                  onClick={() => select({ pillar: p.pillar, areaId: null, topicId: null, taskId: null })}
                />
              </g>
            );
          }
          return (
            <g key={`hint-${p.pillar}`}>
              {p.areas
                .filter((a) => a.topics.length === 0)
                .map((a) => {
                  const tip = polar(RING.area + 70, a.angle);
                  return (
                    <g key={`hint-${a.id}`}>
                      <line className="link is-ghost" x1={a.pos.x} y1={a.pos.y} x2={tip.x} y2={tip.y} stroke={colour} strokeWidth={1.5} opacity={0.45} />
                      <AddHint
                        x={tip.x}
                        y={tip.y}
                        label={`Add a topic to ${a.name}`}
                        onClick={() => select({ pillar: p.pillar, areaId: a.id, topicId: null, taskId: null })}
                      />
                    </g>
                  );
                })}
            </g>
          );
        })}

        {/* Topic dots */}
        {layout.map((p) =>
          p.areas.map((a) =>
            a.topics.map((tp) => {
              const colour = pillarVar(p.pillar);
              const selected = selection.pillar === p.pillar && selection.areaId === a.id && selection.topicId === tp.id;
              const dim = dimmed && !selected && (selection.pillar !== p.pillar || (!!selection.areaId && selection.areaId !== a.id));
              const label = polar(RADIUS.topic + 12, tp.angle);
              return (
                <g
                  key={tp.id}
                  data-node
                  className={`mm-node mm-node--topic${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
                  onClick={() => select({ pillar: p.pillar, areaId: a.id, topicId: tp.id, taskId: null })}
                  style={{ ['--mm-accent' as string]: colour }}
                >
                  <circle className="mm-hit" cx={tp.pos.x} cy={tp.pos.y} r={RADIUS.topic + 12} />
                  <circle className="mm-node__circle" cx={tp.pos.x} cy={tp.pos.y} r={RADIUS.topic} fill={colour} fillOpacity={0.18} stroke={colour} strokeWidth={1.5} />
                  {tp.progress > 0 ? <ProgressArc cx={tp.pos.x} cy={tp.pos.y} r={RADIUS.topic + 4} pct={tp.progress} colour={colour} width={1.8} /> : null}
                  <text
                    className="mm-node__label"
                    x={tp.pos.x + label.x}
                    y={tp.pos.y + label.y}
                    textAnchor={anchorFor(tp.angle)}
                    dominantBaseline={baselineFor(tp.angle)}
                  >
                    {truncate(tp.name, 18)}
                  </text>
                </g>
              );
            }),
          ),
        )}

        {/* Area dots */}
        {layout.map((p) =>
          p.areas.map((a) => {
            const colour = pillarVar(p.pillar);
            const selected = selection.pillar === p.pillar && selection.areaId === a.id && !selection.topicId;
            const dim = dimmed && selection.pillar !== p.pillar;
            const label = polar(RADIUS.area + 18, a.angle);
            return (
              <g
                key={a.id}
                data-node
                className={`mm-node mm-node--area${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
                onClick={() => select({ pillar: p.pillar, areaId: a.id, topicId: null, taskId: null })}
                style={{ ['--mm-accent' as string]: colour }}
              >
                <circle className="mm-hit" cx={a.pos.x} cy={a.pos.y} r={RADIUS.area + 10} />
                <circle className="mm-node__circle" cx={a.pos.x} cy={a.pos.y} r={RADIUS.area} fill={colour} fillOpacity={0.2} stroke={colour} strokeWidth={2} />
                {a.progress > 0 ? <ProgressArc cx={a.pos.x} cy={a.pos.y} r={RADIUS.area + 5} pct={a.progress} colour={colour} width={2.5} /> : null}
                {a.progress > 0 ? (
                  <text className="mm-node__pct" x={a.pos.x} y={a.pos.y + 3} textAnchor="middle" style={{ fill: colour }}>
                    {Math.round(a.progress)}%
                  </text>
                ) : null}
                <text
                  className="mm-node__label"
                  x={a.pos.x + label.x}
                  y={a.pos.y + label.y}
                  textAnchor={anchorFor(a.angle)}
                  dominantBaseline={baselineFor(a.angle)}
                >
                  {truncate(a.name, 22)}
                </text>
              </g>
            );
          }),
        )}

        {/* Pillars */}
        {layout.map((p) => {
          const colour = pillarVar(p.pillar);
          const selected = selection.pillar === p.pillar && !selection.areaId;
          const dim = dimmed && selection.pillar !== p.pillar;
          const empty = p.areas.length === 0;
          const label = polar(RADIUS.pillar + 26, p.angle);
          return (
            <g
              key={p.pillar}
              data-node
              className={`mm-node mm-node--pillar${selected ? ' is-selected' : ''}${dim ? ' is-dim' : ''}`}
              onClick={() => select({ pillar: p.pillar, areaId: null, topicId: null, taskId: null })}
              style={{ ['--mm-accent' as string]: colour }}
            >
              <circle className="mm-hit" cx={p.pos.x} cy={p.pos.y} r={RADIUS.pillar + 8} />
              <circle className="mm-node__circle" cx={p.pos.x} cy={p.pos.y} r={RADIUS.pillar} fill={empty ? 'var(--border-strong)' : colour} />
              <ProgressArc cx={p.pos.x} cy={p.pos.y} r={RADIUS.pillar + 6} pct={p.progress} colour={colour} width={3.5} />
              {!empty ? (
                <text className="mm-node__pct mm-node__pct--on-fill" x={p.pos.x} y={p.pos.y + 5} textAnchor="middle">
                  {Math.round(p.progress)}%
                </text>
              ) : null}
              <text
                className="mm-node__label mm-node__label--pillar"
                x={p.pos.x + label.x}
                y={p.pos.y + label.y}
                textAnchor={anchorFor(p.angle)}
                dominantBaseline={baselineFor(p.angle)}
              >
                {p.pillar}
              </text>
            </g>
          );
        })}

        {/* Centre */}
        <g
          data-node
          className="mm-node mm-node--centre"
          onClick={() => select({ pillar: null, areaId: null, topicId: null, taskId: null })}
        >
          <circle className="mm-node__circle" cx={0} cy={0} r={RADIUS.centre} />
          <text className="mm-node__kicker" x={0} y={-8} textAnchor="middle">
            LIFE OS
          </text>
          <text className="mm-node__centre-label" x={0} y={10} textAnchor="middle">
            {truncate(centreName, 10).toUpperCase()}
          </text>
        </g>
      </svg>

      <div className="mindmap__zoom">
        <button type="button" className="zoom-btn" onClick={() => zoomCentre(1 / ZOOM.step)} aria-label="Zoom in">
          <Icon name="plus" />
        </button>
        <button type="button" className="zoom-btn" onClick={() => zoomCentre(ZOOM.step)} aria-label="Zoom out">
          <Icon name="minus" />
        </button>
        <button type="button" className="zoom-btn" onClick={() => setView({ ...VIEW })} aria-label="Reset view">
          <Icon name="refresh" />
        </button>
      </div>

      <p className="mindmap__hint">Drag to pan · pinch or scroll to zoom · tap a node to focus</p>
    </div>
  );
}

function AddHint({ x, y, label, onClick }: { x: number; y: number; label: string; onClick: () => void }) {
  return (
    <g data-node className="mm-hint" transform={`translate(${x} ${y})`} onClick={onClick} role="button" aria-label={label}>
      <circle className="mm-hint__circle" r={12} />
      <path className="mm-hint__plus" d="M-5 0h10M0 -5v10" />
    </g>
  );
}

function ProgressArc({ cx, cy, r, pct, colour, width }: { cx: number; cy: number; r: number; pct: number; colour: string; width: number }) {
  if (pct <= 0) return null;
  if (pct >= 100) return <circle className="mm-arc" cx={cx} cy={cy} r={r} stroke={colour} strokeWidth={width} />;
  const angle = (pct / 100) * 360;
  const endRad = ((-90 + angle) * Math.PI) / 180;
  const endX = cx + r * Math.cos(endRad);
  const endY = cy + r * Math.sin(endRad);
  const largeArc = angle > 180 ? 1 : 0;
  return (
    <path
      className="mm-arc"
      d={`M ${cx} ${cy - r} A ${r} ${r} 0 ${largeArc} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`}
      stroke={colour}
      strokeWidth={width}
    />
  );
}

function branchOpacity(progress: number, lit: boolean, anySelection: boolean): number {
  if (lit) return 1;
  if (anySelection) return 0.28;
  return Math.max(0.3, Math.min(1, 0.3 + (progress / 100) * 0.7));
}

function anchorFor(angle: number): 'start' | 'middle' | 'end' {
  const a = ((angle % 360) + 360) % 360;
  if (a > 95 && a < 265) return 'end';
  if (a >= 85 && a <= 95) return 'middle';
  if (a >= 265 && a <= 275) return 'middle';
  return 'start';
}

function baselineFor(angle: number): 'auto' | 'hanging' | 'middle' {
  const a = ((angle % 360) + 360) % 360;
  if (a > 30 && a < 150) return 'auto';
  if (a > 210 && a < 330) return 'hanging';
  return 'middle';
}

function truncate(text: string, max: number): string {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/* ---------------- Side panel ---------------- */

function MapPanel({
  api,
  selection,
  setSelection,
}: {
  api: Api;
  selection: Selection;
  setSelection: (next: Selection) => void;
}) {
  const confirm = useConfirm();
  const [adding, setAdding] = useState<'area' | 'topic' | 'task' | null>(null);

  const area = findArea(api.tree, selection.pillar, selection.areaId);
  const topic = findTopic(api.tree, selection);
  const task = findTask(api.tree, selection);
  const accent = pillarVar(selection.pillar);

  if (!selection.pillar) {
    return (
      <aside className="mindmap__panel">
        <EmptyState
          icon="spark"
          title="Tap a node to focus"
          sub="Areas, topics and tasks appear here for editing. Tap the centre or empty space to clear."
        />
      </aside>
    );
  }

  async function del(label: string, cascade: boolean) {
    return confirm({
      title: `Delete “${label}”?`,
      message: cascade ? 'Everything nested under it goes too. This can’t be undone.' : 'This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
  }

  const pillar = selection.pillar;

  return (
    <aside className="mindmap__panel" style={{ ['--panel-accent' as string]: accent }}>
      <div className="map-card">
        {!area ? (
          <>
            <p className="panel__breadcrumb">Pillar</p>
            <h2 className="panel__title">{pillar}</h2>
            <PanelMeta
              left={`${api.areasOf(pillar).length} area${api.areasOf(pillar).length === 1 ? '' : 's'}`}
              pct={pillarProgress(api.areasOf(pillar))}
              accent={accent}
            />
            <Section
              label="Areas"
              onAdd={() => setAdding('area')}
              adding={adding === 'area'}
              addPlaceholder="New area name…"
              onCancel={() => setAdding(null)}
              onSubmit={async (name) => {
                const id = await api.addArea(pillar, name);
                setAdding(null);
                if (id) setSelection({ pillar, areaId: id, topicId: null, taskId: null });
              }}
            >
              {api.areasOf(pillar).length === 0 ? (
                <p className="map-empty">No areas yet.</p>
              ) : (
                api.areasOf(pillar).map((a) => (
                  <ChildRow
                    key={a.id}
                    name={a.name}
                    pct={areaProgress(a)}
                    selected={false}
                    onClick={() => setSelection({ pillar, areaId: a.id, topicId: null, taskId: null })}
                  />
                ))
              )}
            </Section>
          </>
        ) : !topic ? (
          <>
            <p className="panel__breadcrumb truncate">{pillar}</p>
            <TitleRow
              value={area.name}
              onRename={(next) => void api.rename(pillar, area.id, null, null, next)}
              onDelete={async () => {
                if (await del(area.name, true)) {
                  await api.removeNode(pillar, area.id, null, null);
                  setSelection({ pillar, areaId: null, topicId: null, taskId: null });
                }
              }}
            />
            <PanelMeta
              left={`${area.children.length} topic${area.children.length === 1 ? '' : 's'}`}
              pct={areaProgress(area)}
              accent={accent}
            />
            <Section
              label="Topics"
              onAdd={() => setAdding('topic')}
              adding={adding === 'topic'}
              addPlaceholder="New topic name…"
              onCancel={() => setAdding(null)}
              onSubmit={async (name) => {
                const id = await api.addTopic(pillar, area.id, name);
                setAdding(null);
                if (id) setSelection({ pillar, areaId: area.id, topicId: id, taskId: null });
              }}
            >
              {area.children.length === 0 ? (
                <p className="map-empty">No topics yet.</p>
              ) : (
                area.children.map((tp) => (
                  <ChildRow
                    key={tp.id}
                    name={tp.name}
                    pct={topicProgress(tp)}
                    selected={false}
                    onClick={() => setSelection({ pillar, areaId: area.id, topicId: tp.id, taskId: null })}
                  />
                ))
              )}
            </Section>
          </>
        ) : (
          <>
            <p className="panel__breadcrumb truncate">{`${pillarShortName(pillar)} › ${area.name}`}</p>
            <TitleRow
              value={topic.name}
              onRename={(next) => void api.rename(pillar, area.id, topic.id, null, next)}
              onDelete={async () => {
                if (await del(topic.name, true)) {
                  await api.removeNode(pillar, area.id, topic.id, null);
                  setSelection({ pillar, areaId: area.id, topicId: null, taskId: null });
                }
              }}
            />
            <PanelMeta
              left={`${topic.children.filter((t) => t.completed).length} of ${topic.children.length} done`}
              pct={topicProgress(topic)}
              accent={accent}
            />
            <Section
              label="Tasks"
              onAdd={() => setAdding('task')}
              adding={adding === 'task'}
              addPlaceholder="New task name…"
              onCancel={() => setAdding(null)}
              onSubmit={async (name) => {
                const id = await api.addTask(pillar, area.id, topic.id, name);
                setAdding(null);
                if (id) setSelection({ pillar, areaId: area.id, topicId: topic.id, taskId: id });
              }}
            >
              {topic.children.length === 0 ? (
                <p className="map-empty">No tasks yet.</p>
              ) : (
                topic.children.map((tk) => (
                  <div key={tk.id} className={`map-task${tk.completed ? ' is-done' : ''}${selection.taskId === tk.id ? ' is-selected' : ''}`}>
                    <input
                      type="checkbox"
                      className="check"
                      checked={tk.completed}
                      onChange={(e) => void api.toggleTask(pillar, area.id, topic.id, tk.id, e.target.checked)}
                      aria-label={`Mark “${tk.name}” ${tk.completed ? 'not done' : 'done'}`}
                    />
                    <button
                      type="button"
                      className="map-task__name truncate"
                      onClick={() => setSelection({ pillar, areaId: area.id, topicId: topic.id, taskId: tk.id })}
                    >
                      {tk.name}
                    </button>
                  </div>
                ))
              )}
            </Section>

            {task ? (
              <div className="map-detail">
                <TitleRow
                  value={task.name}
                  small
                  onRename={(next) => void api.rename(pillar, area.id, topic.id, task.id, next)}
                  onDelete={async () => {
                    if (await del(task.name, false)) {
                      await api.removeNode(pillar, area.id, topic.id, task.id);
                      setSelection({ pillar, areaId: area.id, topicId: topic.id, taskId: null });
                    }
                  }}
                />
                <label className="task-status">
                  <input
                    type="checkbox"
                    className="check check--accent"
                    checked={task.completed}
                    onChange={(e) => void api.toggleTask(pillar, area.id, topic.id, task.id, e.target.checked)}
                  />
                  {task.completed ? 'Completed' : 'Mark as complete'}
                </label>
                <div className="field">
                  <label className="label" htmlFor={`map-desc-${task.id}`}>
                    Notes
                  </label>
                  <DescriptionField
                    id={`map-desc-${task.id}`}
                    value={task.description}
                    onCommit={(next) => void api.setDescription(pillar, area.id, topic.id, task.id, next)}
                  />
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

function TitleRow({
  value,
  onRename,
  onDelete,
  small,
}: {
  value: string;
  onRename: (next: string) => void;
  onDelete: () => void;
  small?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  useEffect(() => setEditing(false), [value]);

  return (
    <div className="panel__title-row">
      <EditableTitle
        value={value}
        editing={editing}
        onEditingChange={setEditing}
        onCommit={onRename}
        className={small ? 'panel__title panel__title--sm' : 'panel__title'}
      />
      <div className="panel__actions">
        {!editing ? (
          <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={`Rename ${value}`} title="Rename">
            <Icon name="edit" />
          </button>
        ) : null}
        <button type="button" className="icon-btn icon-btn--danger" onClick={onDelete} aria-label={`Delete ${value}`} title="Delete">
          <Icon name="trash" />
        </button>
      </div>
    </div>
  );
}

function PanelMeta({ left, pct, accent }: { left: string; pct: number; accent: string }) {
  return (
    <>
      <div className="panel__meta-row">
        <span className="panel__meta">{left}</span>
        <span className="panel__pct">{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} color={accent} thin />
    </>
  );
}

function Section({
  label,
  onAdd,
  adding,
  addPlaceholder,
  onCancel,
  onSubmit,
  children,
}: {
  label: string;
  onAdd: () => void;
  adding: boolean;
  addPlaceholder: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="map-section">
      <div className="map-section__head">
        <h3 className="map-section__label">{label}</h3>
        {!adding ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={onAdd}>
            <Icon name="plus" />
            Add
          </button>
        ) : null}
      </div>
      <div className="map-section__body">{children}</div>
      {adding ? <AddRow placeholder={addPlaceholder} onAdd={onSubmit} onCancel={onCancel} /> : null}
    </section>
  );
}

function ChildRow({ name, pct, selected, onClick }: { name: string; pct: number; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`map-child${selected ? ' is-selected' : ''}`} onClick={onClick}>
      <span className="map-child__name truncate">{name}</span>
      <span className="map-child__pct">{Math.round(pct)}%</span>
    </button>
  );
}
