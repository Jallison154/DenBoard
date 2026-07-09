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
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const isFirstRunRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    isFirstRunRef.current = true;
    async function runOnce() {
      try {
        setError(null);
        if (immediate && isFirstRunRef.current) {
          setLoading(true);
          isFirstRunRef.current = false;
        }
        const next = await fetcher();
        if (!mountedRef.current) return;
        setData(next);
        setLastFetchedAt(new Date());
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

  return { data, loading, error, lastFetchedAt };
}

export type DisplaySettingsSnapshot = {
  enableDadJokes: boolean;
  enableWeatherEffects: boolean;
  enableWeatherAnimations: boolean;
  enableFullscreenWeatherOverlay: boolean;
  enableWeatherRadar: boolean;
  weatherRadarCycleSeconds: number;
};

const DEFAULT_DISPLAY: DisplaySettingsSnapshot = {
  enableDadJokes: true,
  enableWeatherEffects: true,
  enableWeatherAnimations: true,
  enableFullscreenWeatherOverlay: false,
  enableWeatherRadar: true,
  weatherRadarCycleSeconds: 30
};

export function useDisplaySettings(pollMs = 60_000) {
  const [display, setDisplay] = useState<DisplaySettingsSnapshot>(DEFAULT_DISPLAY);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const res = await fetch("/api/settings", { cache: "no-store" });
        if (!res.ok || !mounted) return;
        const data = await res.json();
        const d = data?.display;
        if (!d || typeof d !== "object") return;
        setDisplay({
          enableDadJokes: d.enableDadJokes !== false,
          enableWeatherEffects: d.enableWeatherEffects !== false,
          enableWeatherAnimations: d.enableWeatherAnimations !== false,
          enableFullscreenWeatherOverlay: d.enableFullscreenWeatherOverlay === true,
          enableWeatherRadar: d.enableWeatherRadar !== false,
          weatherRadarCycleSeconds:
            typeof d.weatherRadarCycleSeconds === "number" &&
            d.weatherRadarCycleSeconds >= 5
              ? d.weatherRadarCycleSeconds
              : 30
        });
      } catch {
        // keep defaults
      }
    }

    void load();
    const id = setInterval(() => void load(), pollMs);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return display;
}

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

