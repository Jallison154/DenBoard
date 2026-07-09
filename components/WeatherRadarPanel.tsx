"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { RadarPayload } from "@/lib/radar";
import { usePolling } from "./hooks";

async function fetchRadar(): Promise<RadarPayload> {
  const res = await fetch("/api/weather/radar", { cache: "no-store" });
  if (!res.ok) throw new Error("Radar unavailable");
  return res.json();
}

function formatRadarTime(epochSec: number) {
  try {
    return new Date(epochSec * 1000).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

type Props = {
  cycleSeconds?: number;
  compact?: boolean;
};

export function WeatherRadarPanel({ cycleSeconds = 30, compact }: Props) {
  const fetcher = useCallback(fetchRadar, []);
  const { data, loading } = usePolling<RadarPayload>(fetcher, {
    intervalMs: 5 * 60 * 1000,
    immediate: true
  });
  const [frameIndex, setFrameIndex] = useState(0);

  const frames = data?.frames ?? [];
  const safeIndex = frames.length > 0 ? frameIndex % frames.length : 0;
  const current = frames[safeIndex];

  useEffect(() => {
    setFrameIndex(0);
  }, [frames.length, data?.fetchedAt]);

  useEffect(() => {
    if (frames.length < 2) return;
    const ms = Math.max(5, cycleSeconds) * 1000;
    const id = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, ms);
    return () => clearInterval(id);
  }, [frames.length, cycleSeconds]);

  const pad = compact
    ? "calc(var(--denboard-scale-card-padding) * 0.75)"
    : "var(--denboard-scale-card-padding)";

  return (
    <div
      className="rounded-3xl denboard-card flex flex-col min-w-0 overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: pad,
        gap: "var(--denboard-scale-gap)"
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h3
          className="uppercase tracking-[0.22em] denboard-text-secondary font-semibold"
          style={{ fontSize: "var(--denboard-scale-status)" }}
        >
          Radar
        </h3>
        {current && (
          <span
            className="denboard-text-secondary tabular-nums"
            style={{ fontSize: "var(--denboard-scale-status)" }}
          >
            {formatRadarTime(current.time)}
          </span>
        )}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl denboard-card-nested aspect-[16/10] min-h-[clamp(120px,18vmin,280px)]"
        style={{ backgroundColor: "rgba(15,23,42,0.65)" }}
      >
        {loading && !data ? (
          <div className="absolute inset-0 flex items-center justify-center denboard-text-secondary denboard-scale-status">
            Loading radar…
          </div>
        ) : data?.isFallback || frames.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center denboard-text-secondary denboard-scale-status">
            <span>Radar unavailable</span>
            {data?.message && (
              <span className="opacity-80 max-w-sm">{data.message}</span>
            )}
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.img
              key={current?.imageUrl ?? "frame"}
              src={current?.imageUrl}
              alt="Weather radar near your location"
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
        )}
        <div
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10"
          aria-hidden
        />
      </div>

      {frames.length > 1 && (
        <p
          className="denboard-text-secondary text-center"
          style={{ fontSize: "calc(var(--denboard-scale-status) * 0.95)" }}
        >
          Cycling last {frames.length} frames · every {cycleSeconds}s
        </p>
      )}
    </div>
  );
}
