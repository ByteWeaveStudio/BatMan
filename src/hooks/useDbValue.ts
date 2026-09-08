import { useEffect, useMemo, useRef, useState } from 'react';
import { onValue } from 'firebase/database';
import { pathRef } from '../lib/paths';

interface DbState<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

/**
 * Live subscription to one RTDB path. `transform` runs on every snapshot, so
 * pass a stable function (module scope or useCallback) to avoid resubscribing.
 */
export function useDbValue<T>(path: string | null, transform: (raw: unknown) => T): DbState<T> {
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const emptyValue = useMemo(() => transformRef.current(null), []);
  const [state, setState] = useState<DbState<T>>({ data: emptyValue, loading: !!path, error: null });

  useEffect(() => {
    if (!path) {
      setState({ data: transformRef.current(null), loading: false, error: null });
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    return onValue(
      pathRef(path),
      (snapshot) => {
        setState({ data: transformRef.current(snapshot.val()), loading: false, error: null });
      },
      (error) => {
        setState({ data: transformRef.current(null), loading: false, error });
      },
    );
  }, [path]);

  return state;
}
