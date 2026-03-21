'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import type { WeatherPayload } from "@/lib/weather";
import type { CalendarEvent, CalendarPayload } from "@/lib/calendar";
import { usePolling } from "@/components/hooks";
import { useGuestMode } from "@/components/HomeAssistantStatus";
import { nowInDashboardTz } from "@/lib/time";

const DEFAULT_CALENDAR_COLORS = ["#3B82F6", "#F59E0B", "#22C55E", "#EF4444"];

function getEventColor(evt: { calendarColor?: string }, index: number): string {
  if (evt.calendarColor) return evt.calendarColor;
  return DEFAULT_CALENDAR_COLORS[index % DEFAULT_CALENDAR_COLORS.length];
}

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

/** 12-hour clock, no am/pm */
function formatEventTime(iso: string) {
  try {
    return DateTime.fromISO(iso, { setZone: true }).toFormat("h:mm");
  } catch {
    return "";
  }
}

function useTodayEvents(calendar: CalendarPayload | null | undefined, guestMode: boolean) {
  return useMemo(() => {
    if (guestMode || !calendar?.today) {
      return [] as { evt: CalendarEvent; time: string | null }[];
    }
    const { allDay, timed } = calendar.today;
    const sortedTimed = [...timed].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    const rows: { evt: CalendarEvent; time: string | null }[] = [];
    for (const evt of allDay) {
      rows.push({ evt, time: null });
    }
    for (const evt of sortedTimed) {
      rows.push({ evt, time: formatEventTime(evt.start) });
    }
    return rows;
  }, [calendar, guestMode]);
}

export default function NestHomePage() {
  const [now, setNow] = useState<DateTime | null>(null);
  const weatherFetcher = useCallback(fetchWeather, []);
  const calendarFetcher = useCallback(fetchCalendar, []);
  const { data: weather } = usePolling<WeatherPayload>(weatherFetcher, { intervalMs: 6 * 60 * 1000, immediate: true });
  const { data: calendar } = usePolling<CalendarPayload>(calendarFetcher, { intervalMs: 5 * 60 * 1000, immediate: true });
  const { guestMode } = useGuestMode();
  const todayRows = useTodayEvents(calendar, guestMode);

  useEffect(() => {
    setNow(nowInDashboardTz());
    const id = setInterval(() => setNow(nowInDashboardTz()), 1000);
    return () => clearInterval(id);
  }, []);

  const clockSize = "clamp(72px, 20vmin, 200px)";

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden px-0.5 pb-0.5">
      {/* Time + weather — same row height (weather stretches to clock height) */}
      <section className="w-full shrink-0">
        <div className="flex flex-wrap items-stretch justify-center gap-x-3 gap-y-1">
          <div className="flex shrink-0 items-center">
            <div
              className="denboard-text-primary font-extrabold tabular-nums leading-none tracking-tight"
              style={{ fontSize: clockSize }}
              suppressHydrationWarning
            >
              {now ? now.toFormat("h:mm") : "–:––"}
            </div>
          </div>
          <div className="flex min-h-0 min-w-0 max-w-[11rem] flex-col self-stretch py-0.5">
            <div className="flex h-full min-h-0 flex-col items-start justify-center gap-0.5">
              <span className="leading-none" style={{ fontSize: "clamp(22px, 5.5vmin, 44px)" }}>
                {weatherIcon(weather?.conditionCode)}
              </span>
              <span
                className="denboard-text-primary font-bold tabular-nums leading-tight"
                style={{ fontSize: "clamp(18px, 4.5vmin, 36px)" }}
              >
                {formatTemp(weather?.temperatureCurrent, weather?.units)}
              </span>
              <span
                className="denboard-text-secondary line-clamp-2 capitalize leading-tight"
                style={{ fontSize: "clamp(9px, 1.5vmin, 14px)" }}
              >
                {weather?.conditionText ?? ""}
              </span>
            </div>
          </div>
        </div>
        <div
          className="denboard-text-secondary mt-0.5 text-center"
          style={{ fontSize: "clamp(11px, 2vmin, 20px)" }}
          suppressHydrationWarning
        >
          {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : ""}
        </div>
      </section>

      {/* Today’s events — boxed, calendar colors */}
      <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1.5 px-0.5">
          {todayRows.map(({ evt, time }, index) => {
            const color = getEventColor(evt, index);
            return (
              <li
                key={evt.id}
                className="rounded-2xl denboard-card-nested flex min-w-0 items-baseline gap-2 px-2.5 py-2 denboard-text-primary"
                style={{
                  backgroundColor: `${color}25`,
                  borderLeft: `3px solid ${color}`
                }}
              >
                <span
                  className="denboard-text-secondary shrink-0 tabular-nums"
                  style={{ fontSize: "clamp(10px, 1.8vmin, 16px)", minWidth: "3.5ch" }}
                >
                  {time ?? "\u00a0"}
                </span>
                <span className="min-w-0 truncate font-medium" style={{ fontSize: "clamp(11px, 2vmin, 18px)" }} title={evt.title}>
                  {evt.title}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
