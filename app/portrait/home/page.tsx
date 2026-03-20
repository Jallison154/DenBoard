'use client';

import { TimePanel } from "@/components/TimePanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel, FourWeekGrid } from "@/components/CalendarPanels";
import { HomeAssistantStatus, useGuestMode } from "@/components/HomeAssistantStatus";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
import { motion } from "framer-motion";
import { useCallback } from "react";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load weather");
  }
  return res.json();
}

function weatherIcon(code: number | string | null | undefined): string {
  if (code === undefined || code === null) return "⛰";
  const s = typeof code === "string" ? code.toLowerCase() : String(code);
  if (typeof code === "string") {
    if (["rain", "rainy", "pouring"].includes(s)) return "🌧";
    if (["snow", "snowy"].includes(s)) return "🌨";
    if (["storm", "lightning"].includes(s)) return "⛈";
    if (["cloudy", "overcast"].includes(s)) return "☁️";
    if (["clear", "sunny"].includes(s)) return "☀️";
    if (s === "clear-night") return "🌙";
    if (s.includes("cloud")) return "☁️";
    if (s.includes("clear")) return "☀️";
  }
  const n = typeof code === "number" ? code : parseInt(s, 10);
  if (!Number.isFinite(n)) return "⛰";
  if ([0].includes(n)) return "☀️";
  if ([1, 2, 3].includes(n)) return "🌤";
  if ([45, 48].includes(n)) return "☁️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(n)) return "🌧";
  if ([71, 73, 75, 77, 85, 86].includes(n)) return "🌨";
  if ([95, 96, 99].includes(n)) return "⛈";
  return "⛰";
}

function formatTemp(temp: number, units?: "imperial" | "metric" | null): string {
  const n = Math.round(temp);
  return `${n}${units === "metric" ? "℃" : "°"}`;
}

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

export default function PortraitHomePage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { guestMode } = useGuestMode();

  return (
    <div className="flex-1 flex flex-col">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div
        className="flex-1 flex flex-col min-h-0"
        style={{
          gap: "var(--denboard-scale-gap-lg)",
          paddingTop: "var(--denboard-scale-space-md)",
          paddingBottom: "var(--denboard-scale-gap-lg)"
        }}
      >
        <TimePanel />

        {!guestMode ? (
          <>
            <div className="flex flex-shrink-0 w-[50%] min-w-0 self-start mr-auto">
              <TodayEventsPanel stretchFromLeft />
            </div>
            <div className="flex-1 min-h-0" />
            <div className="w-full flex-shrink-0 rounded-2xl denboard-card border border-white/10 flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5">
              <div className="flex flex-col justify-center min-w-0 w-full sm:w-auto sm:min-w-[30%] sm:max-w-[45%]">
                <span className="uppercase tracking-[0.2em] denboard-text-secondary text-xs sm:text-sm mb-1">
                  Weather
                </span>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span
                    className="denboard-text-primary font-bold tabular-nums"
                    style={{ fontSize: "calc(var(--denboard-scale-time) * 0.5)" }}
                  >
                    {weather?.temperatureCurrent != null
                      ? formatTemp(weather.temperatureCurrent, weather.units)
                      : "–°"}
                  </span>
                  <motion.span
                    className="tabular-nums"
                    style={{ fontSize: "calc(var(--denboard-scale-time) * 0.35)" }}
                    animate={iconAnimationForCondition(currentConditionKey(weather?.conditionCode)).animate}
                    transition={iconAnimationForCondition(currentConditionKey(weather?.conditionCode)).transition}
                    aria-hidden
                  >
                    {weatherIcon(weather?.conditionCode)}
                  </motion.span>
                </div>
                <p className="denboard-text-primary font-medium text-base sm:text-lg mt-1 capitalize">
                  {weather?.conditionText ?? "—"}
                </p>
                {(weather?.sunrise || weather?.sunset) && (
                  <p className="denboard-text-secondary text-sm mt-2">
                    {weather?.sunrise && `Sunrise ${new Date(weather.sunrise).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                    {weather?.sunrise && weather?.sunset && " · "}
                    {weather?.sunset && `Sunset ${new Date(weather.sunset).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}
                  </p>
                )}
              </div>
              <div className="flex flex-col sm:border-l border-white/10 sm:pl-6 min-w-0 flex-1 sm:min-w-[50%]">
                <span className="uppercase tracking-[0.2em] denboard-text-secondary text-sm sm:text-base mb-2">
                  5-day forecast
                </span>
                {weather?.dailyForecast && weather.dailyForecast.length > 0 ? (
                  <div className="grid grid-cols-5 gap-3 sm:gap-4 flex-1">
                    {weather.dailyForecast.slice(0, 5).map((day) => (
                      <div
                        key={day.dateISO}
                        className="flex items-center justify-between gap-2 rounded-xl denboard-card-nested py-3 sm:py-4 px-3 sm:px-4"
                      >
                        <div className="flex flex-col items-start min-w-0 shrink">
                          <span
                            className="denboard-text-secondary font-semibold truncate w-full text-left"
                            style={{ fontSize: "clamp(14px, 2vmin, 22px)" }}
                          >
                            {day.dayName}
                          </span>
                          <motion.span
                            className="shrink-0 mt-0.5"
                            style={{ fontSize: "clamp(24px, 4vmin, 44px)" }}
                            animate={iconAnimationForCondition(currentConditionKey(day.iconCode)).animate}
                            transition={iconAnimationForCondition(currentConditionKey(day.iconCode)).transition}
                            aria-hidden
                          >
                            {weatherIcon(day.iconCode)}
                          </motion.span>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                          <span
                            className="denboard-text-primary font-bold tabular-nums"
                            style={{ fontSize: "clamp(28px, 5vmin, 56px)" }}
                          >
                            {Number.isFinite(day.highTemp) ? formatTemp(day.highTemp, weather.units) : "–"}
                          </span>
                          <span
                            className="denboard-text-secondary font-medium tabular-nums"
                            style={{ fontSize: "clamp(18px, 3vmin, 32px)" }}
                          >
                            {Number.isFinite(day.lowTemp) ? formatTemp(day.lowTemp, weather.units) : "–"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="denboard-text-secondary text-sm">
                    Forecast unavailable
                  </p>
                )}
              </div>
            </div>
            <FourWeekGrid />
          </>
        ) : (
          <div
            className="rounded-3xl denboard-card denboard-scale-calendar-event denboard-text-primary"
            style={{ padding: "var(--denboard-scale-card-padding)" }}
          >
            <p className="uppercase tracking-[0.3em] denboard-text-secondary denboard-scale-status mb-2">
              Guest Mode
            </p>
            <p className="leading-relaxed">
              Personal calendar details are hidden while Guest Mode is on. Time,
              date, weather, forecasts, jokes, and severe alerts remain visible on
              the other DenBoard views.
            </p>
          </div>
        )}

        <div className="w-full flex-shrink-0">
          <HomeAssistantStatus hideWhenGuest fullWidth />
        </div>
        <div className="w-full flex-shrink-0" style={{ paddingTop: "var(--denboard-scale-gap)" }}>
          <DadJokePanel fullWidth />
        </div>
      </div>
    </div>
  );
}

