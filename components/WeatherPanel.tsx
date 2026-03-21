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

function currentConditionKey(code?: number | string | null): "rain" | "snow" | "storm" | "cloudy" | "clear" | "other" {
  if (code == null) return "other";
  const k = typeof code === "string" ? code.toLowerCase() : "";
  if (["rain", "rainy", "pouring"].includes(k)) return "rain";
  if (["snow", "snowy"].includes(k)) return "snow";
  if (["storm", "lightning", "lightning-rainy"].includes(k)) return "storm";
  if (["cloudy", "overcast", "partlycloudy", "partly cloudy"].includes(k)) return "cloudy";
  if (["clear", "sunny", "clear-night"].includes(k)) return "clear";
  return "other";
}

function iconAnimationForCondition(kind: ReturnType<typeof currentConditionKey>) {
  switch (kind) {
    case "rain":
      return {
        animate: { y: [0, 3, 0], opacity: [0.94, 1, 0.94] },
        transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "snow":
      return {
        animate: { y: [0, 2, 0], rotate: [0, 2, -2, 0] },
        transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "storm":
      return {
        animate: { scale: [1, 1.07, 1], opacity: [0.9, 1, 0.9] },
        transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "cloudy":
      return {
        animate: { x: [0, 2, 0] },
        transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "clear":
      return {
        animate: { rotate: [0, 5, 0], scale: [1, 1.03, 1] },
        transition: { duration: 4.6, repeat: Infinity, ease: "easeInOut" as const }
      };
    default:
      return {
        animate: { opacity: [0.95, 1, 0.95] },
        transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const }
      };
  }
}

type WeatherPanelProps = {
  fullHeight?: boolean;
  largeForecast?: boolean;
};

export function WeatherPanel({ fullHeight, largeForecast }: WeatherPanelProps = {}) {
  const fetcher = useCallback(fetchWeather, []);
  const { data, loading } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  const currentTemp = data?.temperatureCurrent ?? null;
  const currentIconMotion = iconAnimationForCondition(currentConditionKey(data?.conditionCode));

  return (
    <motion.div
      className={`rounded-3xl denboard-card flex flex-col min-w-[min(26rem,90vw)] ${fullHeight ? "h-full" : ""}`}
      style={{
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "blur(18px)",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
        padding: "var(--denboard-scale-card-padding)",
        gap: "var(--denboard-scale-gap-lg)"
      }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex flex-col">
          <span className="uppercase tracking-[0.3em] denboard-text-secondary denboard-scale-status">
            Weather
          </span>
          {currentTemp !== null ? (
            <div
              className="flex items-end"
              style={{ gap: "var(--denboard-scale-space-md)", marginTop: "var(--denboard-scale-space)" }}
            >
              <span className="denboard-scale-temp font-bold denboard-text-primary drop-shadow-[0_0_16px_rgba(0,0,0,0.9)]">
                {formatForecastTemp(currentTemp, data?.units)}
              </span>
              <span
                className="font-semibold denboard-text-primary"
                style={{
                  fontSize: "calc(var(--denboard-scale-date) * 1.08)",
                  textShadow: "0 0 12px rgba(0,0,0,0.62)"
                }}
              >
                {data?.conditionText}
              </span>
            </div>
          ) : (
            <span
              className="denboard-text-secondary"
              style={{ fontSize: "var(--denboard-scale-date)", marginTop: "var(--denboard-scale-space)" }}
            >
              {loading ? "Loading..." : "Weather unavailable"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end text-right denboard-text-secondary denboard-scale-status">
          {data?.sunrise && (
            <span>Sunrise {formatClock(data.sunrise)}</span>
          )}
          {data?.sunset && (
            <span>Sunset {formatClock(data.sunset)}</span>
          )}
        </div>
      </div>

      <div
        className="flex items-center denboard-text-secondary"
        style={{
          gap: "var(--denboard-scale-gap)",
          fontSize: "var(--denboard-scale-date)",
          paddingTop: "var(--denboard-scale-space-md)",
          borderTop: "1px solid rgba(255,255,255,0.1)"
        }}
      >
        <motion.span
          className="inline-flex items-center justify-center rounded-full denboard-card-nested"
          style={{
            width: "var(--denboard-scale-forecast-icon)",
            height: "var(--denboard-scale-forecast-icon)",
            fontSize: "var(--denboard-scale-forecast-icon)",
            backgroundColor: "rgba(255,255,255,0.06)"
          }}
          animate={currentIconMotion.animate}
          transition={currentIconMotion.transition}
        >
          {iconFor(data?.conditionCode)}
        </motion.span>
        <span>{data?.conditionText ?? "Local conditions"}</span>
      </div>

      {data?.dailyForecast && data.dailyForecast.length > 0 && (
        <div
          className="grid grid-cols-5 denboard-forecast-grid text-center denboard-text-secondary"
          style={{ marginTop: "var(--denboard-scale-space-md)" }}
        >
          {data.dailyForecast.slice(0, 5).map((day) => (
            <div
              key={day.dateISO}
              className="flex flex-col items-center rounded-2xl denboard-card-nested denboard-forecast-tile"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              <span
                className="uppercase tracking-wide denboard-text-secondary denboard-scale-status"
                style={largeForecast ? { fontSize: "calc(var(--denboard-scale-status) * 1.2)" } : undefined}
              >
                {day.dayName}
              </span>
              <motion.span
                className="denboard-forecast-icon leading-none"
                style={largeForecast ? { fontSize: "calc(var(--denboard-scale-forecast-icon) * 1.2)" } : undefined}
                animate={iconAnimationForCondition(currentConditionKey(day.iconCode)).animate}
                transition={iconAnimationForCondition(currentConditionKey(day.iconCode)).transition}
              >
                {iconFor(day.iconCode)}
              </motion.span>
              <div
                className="denboard-forecast-temp denboard-text-secondary flex flex-col items-center leading-tight"
                style={largeForecast ? { fontSize: "calc(var(--denboard-scale-forecast-temp) * 1.18)" } : undefined}
              >
                <span className="whitespace-nowrap">
                  {formatForecastTemp(day.highTemp, data?.units)}
                </span>
                <span className="whitespace-nowrap">
                  {formatForecastTemp(day.lowTemp, data?.units)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {data?.overlay && (
        <p
          className="denboard-text-secondary denboard-scale-status"
          style={{ marginTop: "var(--denboard-scale-gap)" }}
        >
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

function formatForecastTemp(
  temp: number,
  units?: "imperial" | "metric" | null
): string {
  const n = Math.round(temp);
  const sym = units === "metric" ? "℃" : "℉";
  return `${n}${sym}`;
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

