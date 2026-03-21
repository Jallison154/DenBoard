'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import type { WeatherPayload } from "@/lib/weather";
import type { CalendarEvent, CalendarPayload } from "@/lib/calendar";
import { usePolling } from "@/components/hooks";
import { useGuestMode } from "@/components/HomeAssistantStatus";
import { nowInDashboardTz } from "@/lib/time";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load weather");
  return res.json();
}

async function fetchCalendar(): Promise<CalendarPayload> {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const now = new Date().toISOString();
  const params = new URLSearchParams();
  if (tz) params.set("tz", tz);
  params.set("now", now);
  const res = await fetch(`/api/calendar?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load calendar");
  return res.json();
}

function weatherIcon(code?: number | string | null) {
  if (code === undefined || code === null) return "⛰";
  const k = typeof code === "string" ? code.toLowerCase() : "";
  if (["rain", "rainy", "pouring"].includes(k)) return "🌧";
  if (["snow", "snowy"].includes(k)) return "🌨";
  if (["storm", "lightning", "lightning-rainy"].includes(k)) return "⛈";
  if (["cloudy", "overcast", "partlycloudy", "partly cloudy"].includes(k)) return "☁️";
  if (["clear", "sunny"].includes(k)) return "☀️";
  if (k === "clear-night") return "🌙";
  const n = typeof code === "number" ? code : parseInt(String(code), 10);
  if (!Number.isFinite(n)) return "⛰";
  if (n === 0) return "☀️";
  if ([1, 2, 3].includes(n)) return "🌤";
  if ([45, 48].includes(n)) return "☁️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(n)) return "🌧";
  if ([71, 73, 75, 77, 85, 86].includes(n)) return "🌨";
  if ([95, 96, 99].includes(n)) return "⛈";
  return "⛰";
}

function formatTemp(temp?: number | null, units?: "imperial" | "metric" | null) {
  if (temp == null) return "–°";
  return `${Math.round(temp)}${units === "metric" ? "℃" : "°"}`;
}

function formatStart(iso: string) {
  try {
    return DateTime.fromISO(iso).toFormat("h:mm a");
  } catch {
    return "";
  }
}

function getNextEvent(data: CalendarPayload | null | undefined, now: DateTime): CalendarEvent | null {
  if (!data?.grid.days?.length) return null;
  const nowMs = now.toMillis();
  let next: CalendarEvent | null = null;
  let nextMs = Number.POSITIVE_INFINITY;

  for (const day of data.grid.days) {
    for (const evt of day.events ?? []) {
      const dt = DateTime.fromISO(evt.start, { setZone: true });
      const ms = dt.toMillis();
      if (!Number.isFinite(ms) || ms < nowMs) continue;
      if (ms < nextMs) {
        nextMs = ms;
        next = evt;
      }
    }
  }
  return next;
}

export default function NestHomePage() {
  const [now, setNow] = useState<DateTime | null>(null);
  const weatherFetcher = useCallback(fetchWeather, []);
  const calendarFetcher = useCallback(fetchCalendar, []);
  const { data: weather } = usePolling<WeatherPayload>(weatherFetcher, { intervalMs: 6 * 60 * 1000, immediate: true });
  const { data: calendar } = usePolling<CalendarPayload>(calendarFetcher, { intervalMs: 5 * 60 * 1000, immediate: true });
  const { guestMode } = useGuestMode();

  useEffect(() => {
    setNow(nowInDashboardTz());
    const id = setInterval(() => setNow(nowInDashboardTz()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextEvent = useMemo(() => (now ? getNextEvent(calendar, now) : null), [calendar, now]);

  const panelStyle = {
    background: "rgba(0,0,0,0.35)",
    backdropFilter: "blur(12px)" as const
  };

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden px-0.5 pb-0.5">
      {/* Clock — dominant top block */}
      <section className="w-full shrink-0 text-center pt-0.5">
        <div
          className="denboard-text-secondary uppercase tracking-[0.2em] mb-0.5"
          style={{ fontSize: "clamp(9px, 1.4vmin, 14px)" }}
        >
          {guestMode ? "Guest" : "Nest"}
        </div>
        <div
          className="denboard-text-primary font-extrabold tabular-nums whitespace-nowrap leading-none"
          style={{ fontSize: "clamp(88px, 22vmin, 220px)" }}
          suppressHydrationWarning
        >
          {now ? `${now.toFormat("h:mm")} ${now.toFormat("a")}` : "–:–– ––"}
        </div>
        <div
          className="denboard-text-secondary mt-0.5"
          style={{ fontSize: "clamp(12px, 2.2vmin, 22px)" }}
          suppressHydrationWarning
        >
          {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : "…"}
        </div>
      </section>

      {/* Weather | Calendar */}
      <section className="grid min-h-0 flex-1 grid-cols-2 gap-1.5" style={{ minHeight: 0 }}>
        {/* Left: weather */}
        <div
          className="flex min-h-0 min-w-0 flex-col justify-center rounded-xl border border-white/10 px-2 py-2"
          style={panelStyle}
        >
          <div
            className="denboard-text-secondary uppercase tracking-[0.15em] text-center"
            style={{ fontSize: "clamp(8px, 1.2vmin, 12px)" }}
          >
            Weather
          </div>
          <div className="mt-1 flex flex-1 flex-col items-center justify-center gap-1">
            <span className="leading-none" style={{ fontSize: "clamp(28px, 7vmin, 52px)" }}>
              {weatherIcon(weather?.conditionCode)}
            </span>
            <span
              className="denboard-text-primary font-bold tabular-nums"
              style={{ fontSize: "clamp(26px, 6vmin, 44px)", lineHeight: 1 }}
            >
              {formatTemp(weather?.temperatureCurrent, weather?.units)}
            </span>
            <span
              className="denboard-text-secondary line-clamp-2 text-center capitalize leading-tight"
              style={{ fontSize: "clamp(10px, 1.6vmin, 16px)" }}
            >
              {weather?.conditionText ?? "…"}
            </span>
          </div>
        </div>

        {/* Right: next event / calendar */}
        <div
          className="flex min-h-0 min-w-0 flex-col justify-center rounded-xl border border-white/10 px-2 py-2 text-left"
          style={panelStyle}
        >
          <div
            className="denboard-text-secondary uppercase tracking-[0.15em] text-center"
            style={{ fontSize: "clamp(8px, 1.2vmin, 12px)" }}
          >
            Next
          </div>
          <div className="mt-1 flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
            {guestMode ? (
              <p className="denboard-text-secondary text-center leading-snug" style={{ fontSize: "clamp(11px, 1.8vmin, 18px)" }}>
                Hidden in guest mode
              </p>
            ) : nextEvent ? (
              <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                <div
                  className="denboard-text-primary font-semibold line-clamp-3 leading-tight"
                  style={{ fontSize: "clamp(12px, 2.4vmin, 22px)" }}
                  title={nextEvent.title}
                >
                  {nextEvent.title}
                </div>
                <div className="denboard-text-secondary truncate" style={{ fontSize: "clamp(10px, 1.5vmin, 15px)" }}>
                  {nextEvent.allDay ? "All day" : formatStart(nextEvent.start)}
                </div>
              </div>
            ) : (
              <p className="denboard-text-secondary text-center leading-snug" style={{ fontSize: "clamp(11px, 1.8vmin, 18px)" }}>
                No upcoming events
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
