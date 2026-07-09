"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RadarFrameTile, RadarPayload } from "@/lib/radar";
import { useDisplaySettings, usePolling, usePrefersReducedMotion } from "./hooks";

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

const HEIGHT_STYLES = {
  compact: "clamp(176px, min(22vmin, 28vh), 400px)",
  standard: "clamp(240px, min(30vmin, 40vh), 560px)"
} as const;

type Props = {
  className?: string;
};

export function WeatherRadarPanel({ className }: Props) {
  const display = useDisplaySettings();
  const reducedMotion = usePrefersReducedMotion();
  const refreshSeconds = display.weatherRadarRefreshSeconds;
  const frameSeconds = display.weatherRadarFrameSeconds;
  const heightMode = display.weatherRadarHeight;
  const animate =
    display.weatherRadarAnimate && !reducedMotion;

  const fetcher = useCallback(fetchRadar, []);
  const { data, loading } = usePolling<RadarPayload>(fetcher, {
    intervalMs: Math.max(30, refreshSeconds) * 1000,
    immediate: true
  });

  const [frameIndex, setFrameIndex] = useState(0);
  const [baseMapFailed, setBaseMapFailed] = useState(false);
  const [radarFailed, setRadarFailed] = useState(false);
  const [baseMapLoaded, setBaseMapLoaded] = useState(false);

  const frames = data?.frames ?? [];
  const latestIndex = Math.max(0, frames.length - 1);
  const displayIndex = animate
    ? frames.length > 0
      ? frameIndex % frames.length
      : 0
    : latestIndex;
  const currentFrame = frames[displayIndex];

  const radarByKey = useMemo(() => {
    const map = new Map<string, RadarFrameTile>();
    for (const t of currentFrame?.tiles ?? []) {
      map.set(`${t.x},${t.y}`, t);
    }
    return map;
  }, [currentFrame]);

  useEffect(() => {
    setFrameIndex(latestIndex);
    setBaseMapFailed(false);
    setRadarFailed(false);
    setBaseMapLoaded(false);
  }, [data?.fetchedAt, latestIndex]);

  useEffect(() => {
    if (!animate || frames.length < 2) return;
    const ms = Math.max(2, frameSeconds) * 1000;
    const id = setInterval(() => {
      setFrameIndex((i) => (i + 1) % frames.length);
    }, ms);
    return () => clearInterval(id);
  }, [animate, frames.length, frameSeconds]);

  const mapHeight = HEIGHT_STYLES[heightMode] ?? HEIGHT_STYLES.compact;
  const showFallback =
    !loading && (data?.isFallback || frames.length === 0 || baseMapFailed);
  const showRadarFallback =
    !showFallback && radarFailed && baseMapLoaded;

  return (
    <section
      className={`w-full min-w-0 flex flex-col ${className ?? ""}`}
      style={{ gap: "calc(var(--denboard-scale-gap) * 0.65)" }}
      aria-label="Weather radar"
    >
      <div className="flex items-center justify-between gap-3 px-0.5">
        <h3
          className="uppercase tracking-[0.22em] denboard-text-secondary font-semibold"
          style={{ fontSize: "var(--denboard-scale-status)" }}
        >
          Radar
        </h3>
        {currentFrame && !showFallback && (
          <span
            className="denboard-text-secondary tabular-nums"
            style={{ fontSize: "var(--denboard-scale-status)" }}
          >
            {formatRadarTime(currentFrame.time)}
          </span>
        )}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-2xl border border-white/12 denboard-card-nested"
        style={{
          height: mapHeight,
          backgroundColor: "rgba(15,23,42,0.75)"
        }}
      >
        {loading && !data ? (
          <div className="absolute inset-0 flex items-center justify-center denboard-text-secondary denboard-scale-status">
            Loading radar…
          </div>
        ) : showFallback ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center denboard-text-secondary denboard-scale-status">
            <span>Radar unavailable</span>
            {data?.message && (
              <span className="opacity-80 max-w-sm leading-snug">{data.message}</span>
            )}
            {baseMapFailed && (
              <span className="opacity-70">Map tiles could not be loaded.</span>
            )}
          </div>
        ) : (
          <>
            <div
              className="absolute inset-0 grid"
              style={{
                gridTemplateColumns: `repeat(${data?.gridCols ?? 3}, 1fr)`,
                gridTemplateRows: `repeat(${data?.gridRows ?? 2}, 1fr)`
              }}
            >
              {(data?.baseTiles ?? []).map((tile) => {
                const radar = radarByKey.get(`${tile.x},${tile.y}`);
                const span = radar?.span ?? 1;
                return (
                  <div
                    key={`${tile.x}-${tile.y}`}
                    className="relative min-h-0 min-w-0 overflow-hidden"
                  >
                    <img
                      src={tile.baseMapUrl}
                      alt=""
                      role="presentation"
                      className="absolute inset-0 h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      onLoad={() => setBaseMapLoaded(true)}
                      onError={() => setBaseMapFailed(true)}
                    />
                    {radar && !showRadarFallback && (
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={`${currentFrame?.time ?? 0}-${tile.x}-${tile.y}`}
                          src={radar.url}
                          alt=""
                          role="presentation"
                          className="absolute object-cover pointer-events-none"
                          style={{
                            width: `${span * 100}%`,
                            height: `${span * 100}%`,
                            left: `${-radar.offsetX * 100}%`,
                            top: `${-radar.offsetY * 100}%`,
                            opacity: 0.72,
                            mixBlendMode: "multiply",
                            imageRendering: span > 1 ? "auto" : undefined
                          }}
                          initial={animate ? { opacity: 0 } : false}
                          animate={{ opacity: 0.72 }}
                          exit={animate ? { opacity: 0 } : undefined}
                          transition={{ duration: animate ? 0.35 : 0 }}
                          referrerPolicy="no-referrer"
                          onError={() => setRadarFailed(true)}
                        />
                      </AnimatePresence>
                    )}
                  </div>
                );
              })}
            </div>

            {showRadarFallback && (
              <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/55 px-2 py-1 text-center denboard-text-secondary denboard-scale-status">
                Radar overlay unavailable — showing map only
              </div>
            )}

            {data?.marker && (
              <div
                className="pointer-events-none absolute z-10"
                style={{
                  left: `${data.marker.x}%`,
                  top: `${data.marker.y}%`,
                  transform: "translate(-50%, -100%)"
                }}
                aria-hidden
              >
                <span
                  className="block h-3 w-3 rounded-full border-2 border-white bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.85)]"
                />
                <span className="block mx-auto mt-0.5 h-2 w-0.5 bg-white/90" />
              </div>
            )}
          </>
        )}

        <div
          className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10"
          aria-hidden
        />
      </div>

      <p
        className="denboard-text-secondary text-center leading-snug opacity-75"
        style={{ fontSize: "calc(var(--denboard-scale-status) * 0.88)" }}
      >
        © OpenStreetMap · © CARTO · RainViewer
        {animate && frames.length > 1 && (
          <span className="block mt-0.5">
            {frames.length} frames · refreshes every {refreshSeconds}s
          </span>
        )}
      </p>
    </section>
  );
}
