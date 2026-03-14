'use client';

import { TimePanel } from "@/components/TimePanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel, FourWeekGrid } from "@/components/CalendarPanels";
import { HomeAssistantStatus, useGuestMode } from "@/components/HomeAssistantStatus";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
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

export default function PortraitCalendarPage() {
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
            {/* Today view: stretches from far left to center */}
            <div className="flex flex-shrink-0 w-[50%] min-w-0 self-start mr-auto">
              <TodayEventsPanel stretchFromLeft />
            </div>
            {/* Full-width weather: current (left) + 5-day forecast (right) */}
            <div className="w-full flex-shrink-0 rounded-2xl denboard-card border border-white/10 flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5">
              <div className="flex flex-col justify-center min-w-0 flex-1">
                <span className="uppercase tracking-[0.2em] denboard-text-secondary text-xs sm:text-sm mb-1">
                  Weather
                </span>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="denboard-text-primary font-bold text-4xl sm:text-5xl md:text-6xl tabular-nums">
                    {weather?.temperatureCurrent != null
                      ? formatTemp(weather.temperatureCurrent, weather.units)
                      : "–°"}
                  </span>
                  <span className="text-2xl sm:text-3xl" aria-hidden>
                    {weatherIcon(weather?.conditionCode)}
                  </span>
                </div>
                <p className="denboard-text-primary font-medium text-lg sm:text-xl mt-1 capitalize">
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
              <div className="flex flex-col sm:border-l border-white/10 sm:pl-6 min-w-0">
                <span className="uppercase tracking-[0.2em] denboard-text-secondary text-xs sm:text-sm mb-2">
                  5-day forecast
                </span>
                {weather?.dailyForecast && weather.dailyForecast.length > 0 ? (
                  <div className="grid grid-cols-5 gap-2 sm:gap-3">
                    {weather.dailyForecast.slice(0, 5).map((day) => (
                      <div
                        key={day.dateISO}
                        className="flex flex-col items-center text-center rounded-xl denboard-card-nested py-2 px-1"
                      >
                        <span className="denboard-text-secondary text-xs font-medium truncate w-full">
                          {day.dayName}
                        </span>
                        <span className="text-lg sm:text-xl my-0.5" aria-hidden>
                          {weatherIcon(day.iconCode)}
                        </span>
                        <span className="denboard-text-primary text-sm font-semibold tabular-nums">
                          {Number.isFinite(day.highTemp) ? formatTemp(day.highTemp, weather.units) : "–"}
                        </span>
                        <span className="denboard-text-secondary text-xs tabular-nums">
                          {Number.isFinite(day.lowTemp) ? formatTemp(day.lowTemp, weather.units) : "–"}
                        </span>
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
            {/* Spacer pushes calendar to bottom */}
            <div className="flex-1 min-h-0" />
            {/* Calendar at bottom */}
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

        {/* Home Assistant entities – full width, tiles shrink as more are added */}
        <div className="w-full flex-shrink-0">
          <HomeAssistantStatus hideWhenGuest fullWidth />
        </div>
        {/* Dad joke full width */}
        <div className="w-full flex-shrink-0" style={{ paddingTop: "var(--denboard-scale-gap)" }}>
          <DadJokePanel fullWidth />
        </div>
      </div>
    </div>
  );
}

