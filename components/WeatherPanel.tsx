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

  const currentTemp = data?.temperatureCurrent ?? null;

  return (
    <motion.div
      className="rounded-3xl denboard-card px-9 py-7 flex flex-col gap-6 min-w-[26rem]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-[0.28em] denboard-text-secondary">
            Weather
          </span>
          {currentTemp !== null ? (
            <div className="flex items-end gap-3 mt-1">
              <span className="text-6xl lg:text-7xl font-bold denboard-text-primary drop-shadow-[0_0_16px_rgba(0,0,0,0.9)]">
                {Math.round(currentTemp)}°
              </span>
              <span className="text-2xl font-semibold denboard-text-primary">
                {data?.conditionText}
              </span>
            </div>
          ) : (
            <span className="denboard-text-secondary text-lg">
              {loading ? "Loading..." : "Weather unavailable"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end text-right text-[11px] denboard-text-secondary">
          {data?.sunrise && (
            <span>Sunrise {formatClock(data.sunrise)}</span>
          )}
          {data?.sunset && (
            <span>Sunset {formatClock(data.sunset)}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm denboard-text-secondary">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full denboard-card-nested text-xl">
          {iconFor(data?.conditionCode)}
        </span>
        <span>{data?.conditionText ?? "Local conditions"}</span>
      </div>

      {data?.dailyForecast && data.dailyForecast.length > 0 && (
        <div className="mt-4 grid grid-cols-5 gap-4 text-center text-xs denboard-text-secondary">
          {data.dailyForecast.slice(0, 5).map((day) => (
            <div
              key={day.dateISO}
              className="flex flex-col items-center gap-2 rounded-2xl denboard-card-nested px-3 py-3"
            >
              <span className="text-[12px] uppercase tracking-wide denboard-text-secondary">
                {day.dayName}
              </span>
              <span className="text-2xl leading-none">
                {iconFor(day.iconCode)}
              </span>
              <span className="text-sm denboard-text-secondary">
                {Math.round(day.highTemp)}° /{" "}
                <span className="denboard-text-secondary">
                  {Math.round(day.lowTemp)}°
                </span>
              </span>
            </div>
          ))}
        </div>
      )}

      {data?.overlay && (
        <p className="text-[11px] denboard-text-secondary mt-2">
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

function iconFor(code?: number | string | null) {
  if (code === undefined || code === null) return "⛰";
  const iconKey = typeof code === "string" ? code : "";
  switch (iconKey) {
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

