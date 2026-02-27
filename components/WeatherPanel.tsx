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
      className="rounded-3xl bg-slate-900/75 border border-white/15 shadow-[0_18px_45px_rgba(0,0,0,0.65)] backdrop-blur-2xl px-8 py-6 flex flex-col gap-5 min-w-[24rem]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.28em] text-slate-300/80">
            Weather
          </span>
          {current ? (
            <div className="flex items-end gap-3 mt-1">
              <span className="text-6xl lg:text-7xl font-bold text-[#F5F5F3] drop-shadow-[0_0_16px_rgba(0,0,0,0.9)]">
                {Math.round(current.temperature)}°
              </span>
              <span className="text-2xl font-semibold text-slate-100">
                {current.condition}
              </span>
            </div>
          ) : (
            <span className="text-slate-300 text-lg">
              {loading ? "Loading..." : "Weather unavailable"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end text-right text-[11px] text-slate-300/90">
          {current?.sunrise && (
            <span>Sunrise {formatClock(current.sunrise)}</span>
          )}
          {current?.sunset && (
            <span>Sunset {formatClock(current.sunset)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-100/90">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/80 border border-white/15 text-xl">
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
        <div className="mt-3 grid grid-cols-5 gap-3 text-center text-xs text-slate-200">
          {data.forecast.slice(0, 5).map((day) => (
            <div
              key={day.date}
              className="flex flex-col items-center gap-1.5 rounded-2xl bg-slate-900/70 border border-white/10 px-2.5 py-2"
            >
              <span className="text-[11px] uppercase tracking-wide text-slate-300/90">
                {weekdayShort(day.date)}
              </span>
              <span className="text-lg leading-none">
                {iconFor(day.icon)}
              </span>
              <span className="text-[11px]">
                {Math.round(day.max)}° /{" "}
                <span className="text-slate-400">
                  {Math.round(day.min)}°
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {data?.overlay && (
        <p className="text-[11px] text-slate-300/90 mt-2">
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

