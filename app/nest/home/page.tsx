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

  return (
    <div className="flex min-h-0 w-full max-w-3xl flex-1 flex-col items-center justify-center text-center overflow-hidden">
      <div className="rounded-3xl denboard-card w-full max-w-2xl px-8 py-7 flex flex-col gap-6">
        <div className="denboard-text-secondary uppercase tracking-[0.22em]" style={{ fontSize: "clamp(14px, 1.8vmin, 22px)" }}>
          {guestMode ? "Guest Mode" : "Nest Home"}
        </div>

        <div className="denboard-text-primary font-extrabold tabular-nums whitespace-nowrap" style={{ fontSize: "clamp(72px, 11vmin, 152px)", lineHeight: 0.95 }}>
          {now ? `${now.toFormat("h:mm")} ${now.toFormat("a")}` : "–:–– ––"}
        </div>
        <div className="denboard-text-secondary" style={{ fontSize: "clamp(22px, 3vmin, 38px)" }}>
          {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : "Loading date..."}
        </div>

        <div
          className="rounded-2xl denboard-card-nested px-5 py-4 flex items-center justify-center gap-4 border border-white/10"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(14px)" }}
        >
          <span style={{ fontSize: "clamp(32px, 5vmin, 56px)" }}>{weatherIcon(weather?.conditionCode)}</span>
          <div className="flex flex-col items-start text-left">
            <span className="denboard-text-primary font-semibold" style={{ fontSize: "clamp(34px, 4.2vmin, 62px)", lineHeight: 1 }}>
              {formatTemp(weather?.temperatureCurrent, weather?.units)}
            </span>
            <span className="denboard-text-secondary capitalize" style={{ fontSize: "clamp(14px, 1.8vmin, 24px)" }}>
              {weather?.conditionText ?? "Loading weather..."}
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl denboard-card-nested px-5 py-4 text-left border border-white/10"
          style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(14px)" }}
        >
          <div className="denboard-text-secondary uppercase tracking-[0.18em]" style={{ fontSize: "clamp(12px, 1.5vmin, 18px)" }}>
            Next Event
          </div>
          {guestMode ? (
            <div className="denboard-text-primary font-medium mt-2" style={{ fontSize: "clamp(18px, 2.2vmin, 30px)" }}>
              Hidden in guest mode
            </div>
          ) : nextEvent ? (
            <div className="mt-2 flex flex-col gap-1">
              <div className="denboard-text-primary font-semibold truncate" style={{ fontSize: "clamp(22px, 2.7vmin, 36px)" }} title={nextEvent.title}>
                {nextEvent.title}
              </div>
              <div className="denboard-text-secondary" style={{ fontSize: "clamp(14px, 1.8vmin, 24px)" }}>
                {nextEvent.allDay ? "All day" : formatStart(nextEvent.start)}
              </div>
            </div>
          ) : (
            <div className="denboard-text-primary mt-2" style={{ fontSize: "clamp(18px, 2.2vmin, 30px)" }}>
              No upcoming events
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
