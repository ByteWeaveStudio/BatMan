import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useUid } from '../context/AuthContext';
import { useYear } from '../context/YearContext';
import { EMPTY_SELECTION, useGrowthTree, type Selection } from '../hooks/useGrowthTree';
import { countTasks, pillarProgress } from '../lib/tree';
import { percent } from '../lib/format';
import { PILLARS } from '../lib/types';
import { PageHeader, Segmented, Spinner, Stat } from '../components/primitives';
import { TreeView } from './growth/TreeView';
import { MindMapView } from './growth/MindMapView';

type View = 'tree' | 'map';

export function Growth() {
  const uid = useUid();
  const { year } = useYear();
  const api = useGrowthTree(uid, year);
  const [params, setParams] = useSearchParams();
  const view: View = params.get('view') === 'map' ? 'map' : 'tree';
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);

  const summary = useMemo(() => {
    const all = PILLARS.flatMap((p) => api.areasOf(p));
    const { total, done } = countTasks(all);
    const overall = PILLARS.reduce((sum, p) => sum + pillarProgress(api.areasOf(p)), 0) / PILLARS.length;
    const strongest = PILLARS.map((p) => ({ pillar: p, pct: pillarProgress(api.areasOf(p)) })).sort((a, b) => b.pct - a.pct)[0];
    return { total, done, overall, strongest };
  }, [api.areasOf]);

  function setView(next: View) {
    const nextParams = new URLSearchParams(params);
    if (next === 'map') nextParams.set('view', 'map');
    else nextParams.delete('view');
    setParams(nextParams, { replace: true });
  }

  return (
    <>
      <PageHeader
        title="Growth"
        sub={`Health, relationships, finance and career across ${year}`}
        actions={
          <Segmented
            value={view}
            onChange={setView}
            ariaLabel="Growth view"
            options={[
              { value: 'tree', label: 'Tree' },
              { value: 'map', label: 'Mind map' },
            ]}
          />
        }
      />

      <div className="stat-row">
        <Stat label="Overall progress" value={percent(summary.overall)} meta="Average across the four pillars" />
        <Stat label="Tasks done" value={`${summary.done} / ${summary.total}`} meta="Across every topic" />
        <Stat
          label="Strongest pillar"
          value={summary.strongest && summary.strongest.pct > 0 ? summary.strongest.pillar.replace(' & Studies', '') : '—'}
          meta={summary.strongest && summary.strongest.pct > 0 ? percent(summary.strongest.pct) : 'Nothing completed yet'}
        />
      </div>

      {api.loading ? (
        <Spinner large label="Loading your growth tree" />
      ) : view === 'tree' ? (
        <TreeView api={api} selection={selection} setSelection={setSelection} />
      ) : (
        <MindMapView api={api} selection={selection} setSelection={setSelection} />
      )}
    </>
  );
}
