'use client';

import { useEffect, useState, useCallback } from "react";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import type { CalendarPayload } from "@/lib/calendar";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
import { useGuestMode } from "@/components/HomeAssistantStatus";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import { nowInDashboardTz } from "@/lib/time";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load weather");
  return res.json();
}

async function fetchCalendar(): Promise<CalendarPayload> {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const params = new URLSearchParams();
  if (tz) params.set("tz", tz);
  params.set("now", new Date().toISOString());
  const res = await fetch(`/api/calendar?${params}`);
  if (!res.ok) throw new Error("Failed to load calendar");
  return res.json();
}

const DEFAULT_COLORS = ["#3B82F6", "#F59E0B", "#22C55E", "#EF4444"];

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function formatTemp(temp: number, units?: "imperial" | "metric" | null) {
  const n = Math.round(temp);
  return `${n}${units === "metric" ? "℃" : "°"}`;
}

function iconFor(code?: number | string | null) {
  if (code === undefined || code === null) return "⛰";
  const k = typeof code === "string" ? code.toLowerCase() : "";
  switch (k) {
    case "rain": case "rainy": case "pouring": return "🌧";
    case "snow": case "snowy": return "🌨";
    case "storm": case "lightning": return "⛈";
    case "cloudy": case "overcast": return "☁️";
    case "clear": case "sunny": return "☀️";
    case "clear-night": return "🌙";
    case "partlycloudy": case "partly cloudy": return "🌤";
    default:
      return k.includes("clear") ? "☀️" : k.includes("cloud") ? "☁️" : "⛰";
  }
}

function formatSunTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

export default function TvHomePage() {
  const [now, setNow] = useState<DateTime | null>(null);
  const { guestMode } = useGuestMode();
  const weatherFetcher = useCallback(fetchWeather, []);
  const calendarFetcher = useCallback(fetchCalendar, []);
  const { data: weather } = usePolling<WeatherPayload>(weatherFetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { data: calendar } = usePolling<CalendarPayload>(calendarFetcher, {
    intervalMs: 5 * 60 * 1000,
    immediate: true
  });

  useEffect(() => {
    setNow(nowInDashboardTz());
    const id = setInterval(() => setNow(nowInDashboardTz()), 1000);
    return () => clearInterval(id);
  }, []);

  const today = calendar?.today;
  const allEvents = [
    ...(today?.allDay ?? []).map((e) => ({ ...e, sortKey: 0 })),
    ...(today?.timed ?? []).map((e) => ({ ...e, sortKey: new Date(e.start).getTime() }))
  ].sort((a, b) => a.sortKey - b.sortKey);
  const visibleEvents = allEvents;

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <SevereAlertBanner alerts={weather?.alerts} />

      {/* Top: Left Time Block + Right Weather */}
      <div className="flex-1 flex items-center justify-between gap-12">
        {/* LEFT: Time block with gradient behind */}
        <div
          className="flex flex-col justify-center pl-0"
          style={{
            paddingRight: "clamp(48px, 5vw, 120px)"
          }}
        >
          <div
            className="denboard-text-primary font-extrabold tracking-tight whitespace-nowrap"
            style={{
              fontSize: "clamp(120px, 12vmin, 180px)",
              lineHeight: 1,
              textShadow: "0 0 24px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)"
            }}
            suppressHydrationWarning
          >
            {now ? `${now.toFormat("h:mm")} ${now.toFormat("a")}` : "–:–– ––"}
          </div>
          <div
            className="denboard-text-primary font-semibold mt-2 whitespace-nowrap"
            style={{
              fontSize: "clamp(24px, 2.2vmin, 44px)",
              textShadow: "0 0 16px rgba(0,0,0,0.5)"
            }}
            suppressHydrationWarning
          >
            {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : "––––––––––– • ––––––––"}
          </div>
        </div>

        {/* RIGHT: Weather card (glass) */}
        <motion.div
          className="rounded-3xl flex flex-col shrink-0 border border-white/10"
          style={{
            background: "rgba(0,0,0,0.35)",
            backdropFilter: "blur(18px)",
            padding: "clamp(24px, 2.5vmin, 48px)",
            minWidth: "clamp(280px, 26vw, 420px)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.4)"
          }}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex items-end gap-4">
            <span
              className="leading-none mb-1"
              style={{
                fontSize: "clamp(40px, 4.5vmin, 72px)"
              }}
            >
              {iconFor(weather?.conditionCode)}
            </span>
            <span
              className="denboard-text-primary font-bold"
              style={{
                fontSize: "clamp(64px, 7vmin, 110px)",
                lineHeight: 1,
                textShadow: "0 0 20px rgba(0,0,0,0.7)"
              }}
            >
              {weather?.temperatureCurrent != null
                ? formatTemp(weather.temperatureCurrent, weather.units)
                : "–°"}
            </span>
          </div>
          <div
            className="denboard-text-primary font-medium capitalize"
            style={{ fontSize: "clamp(20px, 1.8vmin, 32px)" }}
          >
            {weather?.conditionText ?? "Loading…"}
          </div>
          <div
            className="denboard-text-secondary flex flex-col gap-1 mt-2"
            style={{ fontSize: "clamp(14px, 1.3vmin, 22px)" }}
          >
            {weather?.sunrise && (
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                Sunrise {formatSunTime(weather.sunrise)}
              </span>
            )}
            {weather?.sunset && (
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/60 shrink-0" />
                Sunset {formatSunTime(weather.sunset)}
              </span>
            )}
          </div>
          {weather?.dailyForecast && weather.dailyForecast.length > 0 && (
            <div
              className="flex gap-4 mt-4 pt-4 border-t border-white/10"
              style={{ fontSize: "clamp(14px, 1.2vmin, 20px)" }}
            >
              {weather.dailyForecast.slice(0, 4).map((day) => (
                <div
                  key={day.dateISO}
                  className="flex flex-col items-center denboard-text-secondary flex-1 min-w-0"
                >
                  <span className="text-[10px] uppercase tracking-wider truncate w-full text-center">
                    {day.dayName}
                  </span>
                  <span
                    className="leading-none my-1"
                    style={{ fontSize: "clamp(28px, 3vmin, 50px)" }}
                  >
                    {iconFor(day.iconCode)}
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    {formatTemp(day.highTemp, weather.units)} / {formatTemp(day.lowTemp, weather.units)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* BOTTOM LEFT: Today's Schedule (hidden in privacy/guest mode) */}
      {!guestMode && (
        <div className="w-full flex justify-start pb-4">
          <motion.div
            className="flex flex-col w-full max-w-[50vw]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div
            className="rounded-2xl flex flex-col w-full border border-white/10"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(18px)",
              padding: "clamp(20px, 2vmin, 36px)",
              boxShadow: "0 12px 40px rgba(0,0,0,0.35)"
            }}
          >
            <div
              className="denboard-text-secondary uppercase tracking-widest font-semibold mb-3"
              style={{ fontSize: "clamp(14px, 1.2vmin, 20px)" }}
            >
              Today&apos;s Schedule
            </div>
            {!calendar ? (
              <div
                className="denboard-text-secondary"
                style={{ fontSize: "clamp(18px, 1.6vmin, 24px)" }}
              >
                Loading…
              </div>
            ) : visibleEvents.length === 0 ? (
              <div
                className="denboard-text-secondary"
                style={{ fontSize: "clamp(18px, 1.6vmin, 24px)" }}
              >
                No events today
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {visibleEvents.map((evt, i) => {
                  const color = evt.calendarColor ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length];
                  const timeStr = evt.allDay
                    ? "All day"
                    : formatTime(evt.start);
                  return (
                    <div
                      key={evt.id}
                      className="flex flex-col items-start gap-1"
                      style={{ fontSize: "clamp(18px, 1.6vmin, 24px)" }}
                    >
                      <span className="flex items-center gap-2 denboard-text-secondary tabular-nums">
                        <span
                          className="rounded-full shrink-0"
                          style={{
                            width: 10,
                            height: 10,
                            backgroundColor: color
                          }}
                        />
                        {timeStr}
                      </span>
                      <span className="denboard-text-primary truncate w-full">
                        {evt.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
        </div>
      )}
    </div>
  );
}
