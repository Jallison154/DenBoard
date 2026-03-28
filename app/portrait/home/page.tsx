'use client';

import { TimePanel } from "@/components/TimePanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel, FourWeekGrid } from "@/components/CalendarPanels";
import { HomeAssistantStatus, useGuestMode } from "@/components/HomeAssistantStatus";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
import { motion } from "framer-motion";
import { nowInDashboardTz } from "@/lib/time";
import { DateTime } from "luxon";
import { useCallback, useEffect, useState } from "react";

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
  const [now, setNow] = useState<DateTime | null>(null);
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { guestMode } = useGuestMode();

  useEffect(() => {
    setNow(nowInDashboardTz());
    const id = setInterval(() => setNow(nowInDashboardTz()), 1000);
    return () => clearInterval(id);
  }, []);

  const greeting =
    now
      ? now.hour < 12
        ? "Good morning"
        : now.hour < 17
        ? "Good afternoon"
        : "Good evening"
      : "Welcome";

  return (
    <div className="flex min-h-0 w-full max-h-full flex-1 flex-col overflow-hidden">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{
          gap: "var(--denboard-scale-gap-lg)",
          paddingTop: "var(--denboard-scale-space-md)",
          paddingBottom: "var(--denboard-scale-gap-lg)"
        }}
      >
        {/* Stacked crossfade: both views stay mounted; inactive layer fades out (no layout jump from `hidden`) */}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Family layout */}
        <div
          className={
            guestMode
              ? "absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden opacity-0 pointer-events-none transition-opacity duration-500 ease-in-out motion-reduce:transition-none motion-reduce:duration-0"
              : "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden opacity-100 transition-opacity duration-500 ease-in-out motion-reduce:transition-none motion-reduce:duration-0"
          }
          aria-hidden={guestMode}
        >
          <TimePanel />
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
          <div className="w-full flex-shrink-0" style={{ paddingTop: "var(--denboard-scale-gap-lg)" }}>
            <HomeAssistantStatus hideWhenGuest fullWidth hideModeBadge />
          </div>
          <div className="w-full flex-shrink-0" style={{ paddingTop: "var(--denboard-scale-gap)" }}>
            <DadJokePanel fullWidth />
          </div>
        </div>

        {/* Guest layout */}
        <div
          className={
            !guestMode
              ? "absolute inset-0 z-0 flex min-h-0 flex-col overflow-hidden opacity-0 pointer-events-none transition-opacity duration-500 ease-in-out motion-reduce:transition-none motion-reduce:duration-0"
              : "relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden opacity-100 transition-opacity duration-500 ease-in-out motion-reduce:transition-none motion-reduce:duration-0"
          }
          aria-hidden={!guestMode}
        >
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overflow-x-hidden py-4">
            <div
              className="w-full max-w-[min(980px,94vw)] mx-auto flex flex-col"
              style={{ gap: "clamp(16px, 2vmin, 32px)" }}
            >
              <div className="w-full flex flex-col items-center justify-center text-center shrink-0">
                <div
                  className="denboard-text-secondary font-semibold uppercase tracking-[0.28em]"
                  style={{
                    fontSize: "clamp(14px, 1.55vmin, 24px)",
                    textShadow: "0 0 14px rgba(0,0,0,0.86), 0 2px 9px rgba(0,0,0,0.72)"
                  }}
                  suppressHydrationWarning
                >
                  {greeting}
                </div>
                <div
                  className="denboard-text-primary font-extrabold tracking-tight whitespace-nowrap max-w-full px-1"
                  style={{
                    fontSize:
                      "clamp(72px, min(14vmin, 19vw), 220px)",
                    lineHeight: 0.93,
                    textShadow: "0 0 28px rgba(0,0,0,0.66), 0 4px 12px rgba(0,0,0,0.48)"
                  }}
                  suppressHydrationWarning
                >
                  {now ? `${now.toFormat("h:mm")} ${now.toFormat("a")}` : "–:–– ––"}
                </div>
                <div
                  className="denboard-text-primary font-semibold whitespace-nowrap"
                  style={{
                    fontSize: "clamp(22px, 2.6vmin, 42px)",
                    textShadow: "0 0 16px rgba(0,0,0,0.58)"
                  }}
                  suppressHydrationWarning
                >
                  {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : "––––––––––– • ––––––––"}
                </div>
              </div>

              <div
                className="w-full rounded-3xl denboard-card border border-white/15"
                style={{
                  padding: "clamp(14px, 1.5vmin, 28px)",
                  background: "linear-gradient(180deg, rgba(15,23,42,0.62), rgba(2,6,23,0.56))",
                  boxShadow: "0 16px 44px rgba(0,0,0,0.42)"
                }}
              >
                <div className="uppercase tracking-[0.2em] denboard-text-secondary text-xs sm:text-sm mb-2">
                  Weather
                </div>
                <div className="flex items-end justify-between gap-3 flex-wrap">
                  <div className="flex items-end gap-3">
                    <motion.span
                      className="tabular-nums"
                      style={{ fontSize: "clamp(30px, 4.2vmin, 58px)" }}
                      animate={iconAnimationForCondition(currentConditionKey(weather?.conditionCode)).animate}
                      transition={iconAnimationForCondition(currentConditionKey(weather?.conditionCode)).transition}
                      aria-hidden
                    >
                      {weatherIcon(weather?.conditionCode)}
                    </motion.span>
                    <span
                      className="denboard-text-primary font-bold tabular-nums"
                      style={{
                        fontSize: "clamp(52px, min(7vmin, 12vw), 108px)",
                        lineHeight: 1
                      }}
                    >
                      {weather?.temperatureCurrent != null
                        ? formatTemp(weather.temperatureCurrent, weather.units)
                        : "–°"}
                    </span>
                  </div>
                  <span className="denboard-text-primary font-medium text-lg sm:text-xl capitalize text-right min-w-0">
                    {weather?.conditionText ?? "—"}
                  </span>
                </div>

                {weather?.dailyForecast && weather.dailyForecast.length > 0 && (
                  <div
                    className="grid grid-cols-5 gap-2 sm:gap-4 mt-4 pt-4 border-t border-white/10"
                    style={{ minHeight: "min(28vmin, 200px)" }}
                  >
                    {weather.dailyForecast.slice(0, 5).map((day) => (
                      <div
                        key={day.dateISO}
                        className="flex flex-col items-center justify-center text-center rounded-2xl denboard-card-nested min-h-0 min-w-0"
                        style={{
                          padding: "clamp(10px, 1.8vmin, 20px) clamp(4px, 1vmin, 12px)"
                        }}
                      >
                        <span
                          className="denboard-text-secondary font-semibold truncate w-full"
                          style={{ fontSize: "clamp(14px, 2.2vmin, 22px)" }}
                        >
                          {day.dayName}
                        </span>
                        <div className="flex flex-col items-center justify-center gap-1 mt-1 w-full flex-1 justify-center">
                          <motion.span
                            style={{
                              fontSize: "clamp(32px, min(5.5vmin, 9vw), 64px)",
                              lineHeight: 1
                            }}
                            animate={iconAnimationForCondition(currentConditionKey(day.iconCode)).animate}
                            transition={iconAnimationForCondition(currentConditionKey(day.iconCode)).transition}
                            aria-hidden
                          >
                            {weatherIcon(day.iconCode)}
                          </motion.span>
                          <div className="flex flex-col items-center leading-none w-full gap-0.5">
                            <span
                              className="denboard-text-primary font-bold tabular-nums"
                              style={{ fontSize: "clamp(20px, 3.4vmin, 40px)" }}
                            >
                              {Number.isFinite(day.highTemp) ? formatTemp(day.highTemp, weather.units) : "–"}
                            </span>
                            <span
                              className="denboard-text-secondary font-medium tabular-nums"
                              style={{ fontSize: "clamp(15px, 2.4vmin, 28px)" }}
                            >
                              {Number.isFinite(day.lowTemp) ? formatTemp(day.lowTemp, weather.units) : "–"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="w-full shrink" style={{ paddingTop: "var(--denboard-scale-gap)" }}>
                <DadJokePanel fullWidth />
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}

