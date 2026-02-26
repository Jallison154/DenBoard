'use client';

import { motion } from "framer-motion";
import { useCallback } from "react";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "./hooks";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load weather");
  }
  return res.json();
}

const overlayLabel: Record<NonNullable<WeatherPayload["overlay"]>, string> = {
  rain: "Rain passing through",
  snow: "Snow in the air",
  cloudy: "Clouds overhead",
  storm: "Storm conditions",
  clear: "Clear skies"
};

export function WeatherPanel() {
  const fetcher = useCallback(fetchWeather, []);
  const { data, loading } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  const current = data?.current ?? null;

  return (
    <motion.div
      className="rounded-3xl bg-white/3 border border-white/10 backdrop-blur-xl px-8 py-6 flex flex-col gap-4 min-w-[22rem]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Weather
          </span>
          {current ? (
            <div className="flex items-end gap-3">
              <span className="text-6xl font-semibold">
                {Math.round(current.temperature)}°
              </span>
              <span className="text-xl text-slate-200">{current.condition}</span>
            </div>
          ) : (
            <span className="text-slate-400 text-lg">
              {loading ? "Loading..." : "Weather unavailable"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end text-right text-xs text-slate-400">
          {current?.sunrise && <span>Sunrise {formatClock(current.sunrise)}</span>}
          {current?.sunset && <span>Sunset {formatClock(current.sunset)}</span>}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-300">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-900/70 border border-white/10 text-lg">
          {iconFor(current?.icon)}
        </span>
        <span>
          {current
            ? current.isDay
              ? "Daytime in the mountains"
              : "Night settling over the range"
            : "Calm mountain conditions"}
        </span>
      </div>

      {data?.forecast && data.forecast.length > 0 && (
        <div className="mt-2 grid grid-cols-5 gap-3 text-center text-xs text-slate-300">
          {data.forecast.slice(0, 5).map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1 rounded-2xl bg-slate-900/40 px-2 py-2"
            >
              <span className="text-[11px] uppercase tracking-wide text-slate-400">
                {weekdayShort(day.date)}
              </span>
              <span className="text-lg">{iconFor(day.icon)}</span>
              <span className="text-[11px]">
                {Math.round(day.max)}° /{" "}
                <span className="text-slate-500">{Math.round(day.min)}°</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {data?.overlay && (
        <p className="text-xs text-slate-400 mt-1">
          {overlayLabel[data.overlay] ?? "Mountain conditions"}
        </p>
      )}
    </motion.div>
  );
}

function formatClock(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function weekdayShort(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      weekday: "short"
    });
  } catch {
    return "";
  }
}

function iconFor(icon?: string | null) {
  switch (icon) {
    case "rain":
      return "🌧";
    case "snow":
      return "🌨";
    case "storm":
      return "⛈";
    case "cloudy":
      return "☁️";
    case "clear":
      return "☀️";
    default:
      return "⛰";
  }
}

