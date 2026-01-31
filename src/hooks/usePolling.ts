import { useEffect, useRef, useState } from 'react';

export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  enabled = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        if (!cancelled) setLoading(true);
        const res = await fetcher();
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to fetch');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (!enabled) {
      setLoading(false);
      return;
    }

    tick();
    timer.current = window.setInterval(tick, intervalMs);

    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
    };
  }, [fetcher, intervalMs, enabled]);

  return { data, error, loading };
}
