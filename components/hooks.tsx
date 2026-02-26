'use client';

import { useEffect, useRef, useState } from "react";

type PollOptions = {
  intervalMs: number;
  immediate?: boolean;
};

export function usePolling<T>(
  fetcher: () => Promise<T>,
  { intervalMs, immediate = true }: PollOptions
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(immediate);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    async function runOnce() {
      try {
        setError(null);
        if (immediate) setLoading(true);
        const next = await fetcher();
        if (!mountedRef.current) return;
        setData(next);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(String(err));
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
      }
    }

    if (immediate) {
      void runOnce();
    }

    timerRef.current = setInterval(() => {
      void runOnce();
    }, intervalMs);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [fetcher, immediate, intervalMs]);

  return { data, loading, error };
}

