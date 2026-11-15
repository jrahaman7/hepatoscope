import { useEffect, useState } from 'react';

export interface AsyncState<T> { data: T | null; error: string | null; loading: boolean }

/** Runs an async loader whenever deps change; ignores stale responses. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ data: null, error: null, loading: enabled });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!enabled) { setState({ data: null, error: null, loading: false }); return; }
    let live = true;
    setState((s) => ({ data: s.data, error: null, loading: true }));
    fn().then(
      (data) => { if (live) setState({ data, error: null, loading: false }); },
      (e: unknown) => { if (live) setState({ data: null, error: e instanceof Error ? e.message : String(e), loading: false }); },
    );
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);
  return { ...state, reload: () => setTick((t) => t + 1) };
}
