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

/** 24h, no am/pm */
function formatEventTime(iso: string) {
  try {
    return DateTime.fromISO(iso).toFormat("HH:mm");
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

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden px-0.5 pb-0.5">
      {/* Time + weather (weather where am/pm was) */}
      <section className="w-full shrink-0">
        <div className="flex flex-wrap items-end justify-center gap-x-3 gap-y-1">
          <div
            className="denboard-text-primary font-extrabold tabular-nums leading-none tracking-tight"
            style={{ fontSize: "clamp(72px, 20vmin, 200px)" }}
            suppressHydrationWarning
          >
            {now ? now.toFormat("HH:mm") : "––:––"}
          </div>
          <div className="flex flex-col items-start justify-end pb-[clamp(4px,0.8vmin,12px)] min-w-0">
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
              className="denboard-text-secondary line-clamp-2 capitalize leading-tight max-w-[12rem]"
              style={{ fontSize: "clamp(9px, 1.5vmin, 14px)" }}
            >
              {weather?.conditionText ?? ""}
            </span>
          </div>
        </div>
        <div
          className="denboard-text-secondary text-center mt-0.5"
          style={{ fontSize: "clamp(11px, 2vmin, 20px)" }}
          suppressHydrationWarning
        >
          {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : ""}
        </div>
      </section>

      {/* Today’s events — below time + weather, no boxes */}
      <section className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <ul className="flex flex-col gap-1 px-0.5">
          {todayRows.map(({ evt, time }) => (
            <li
              key={evt.id}
              className="flex items-baseline gap-2 min-w-0 denboard-text-primary"
              style={{ fontSize: "clamp(11px, 2vmin, 18px)" }}
            >
              {time != null ? (
                <span className="denboard-text-secondary tabular-nums shrink-0" style={{ fontSize: "0.92em" }}>
                  {time}
                </span>
              ) : (
                <span className="shrink-0 w-[2.75ch]" aria-hidden />
              )}
              <span className="min-w-0 truncate font-medium">{evt.title}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
