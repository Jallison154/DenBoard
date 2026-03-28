'use client';

import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel, CurrentWeekGrid } from "@/components/CalendarPanels";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import { useGuestMode } from "@/components/HomeAssistantStatus";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
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

export default function TvHomePage() {
  const [now, setNow] = useState<DateTime | null>(null);
  const fetcher = useCallback(fetchWeather, []);
  const { guestMode } = useGuestMode();
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
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
    <div
      className="flex min-h-0 w-full max-w-6xl flex-1 flex-col overflow-hidden mx-auto"
      style={{
        paddingTop: "var(--denboard-scale-space-lg)",
        paddingBottom: "var(--denboard-scale-space-xl)",
        paddingLeft: "var(--denboard-scale-space-lg)",
        paddingRight: "var(--denboard-scale-space-lg)"
      }}
    >
      <SevereAlertBanner alerts={weather?.alerts} />

      {/* Hotel-style hero clock */}
      <div className="w-full flex flex-col items-center justify-center text-center">
        <div
          className="denboard-text-secondary font-semibold uppercase tracking-[0.28em]"
          style={{
            fontSize: "clamp(10px, 0.9vmin, 17px)",
            textShadow: "0 0 16px rgba(0,0,0,0.88), 0 2px 10px rgba(0,0,0,0.75)"
          }}
          suppressHydrationWarning
        >
          {greeting}
        </div>
        <div
          className="denboard-text-primary font-extrabold tracking-tight whitespace-nowrap"
          style={{
            fontSize: "clamp(85px, 9vmin, 150px)",
            lineHeight: 0.95,
            textShadow: "0 0 28px rgba(0,0,0,0.62), 0 4px 14px rgba(0,0,0,0.45)"
          }}
          suppressHydrationWarning
        >
          {now ? `${now.toFormat("h:mm")} ${now.toFormat("a")}` : "–:–– ––"}
        </div>
        <div
          className="denboard-text-primary font-semibold whitespace-nowrap"
          style={{
            fontSize: "clamp(17px, 1.5vmin, 28px)",
            textShadow: "0 0 18px rgba(0,0,0,0.55)"
          }}
          suppressHydrationWarning
        >
          {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : "––––––––––– • ––––––––"}
        </div>
      </div>

      {/* Content below in a clean grid */}
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{ gap: "calc(var(--denboard-scale-gap-lg) * 0.82)", paddingTop: "calc(var(--denboard-scale-gap-lg) * 0.8)" }}
      >
        <div
          className={`grid ${guestMode ? "grid-cols-1 max-w-2xl mx-auto" : "grid-cols-1 lg:grid-cols-2"}`}
          style={{ gap: "var(--denboard-scale-gap-lg)" }}
        >
          <section
            className="flex flex-col h-full"
            style={{ gap: "var(--denboard-scale-space-md)" }}
          >
            <WeatherPanel fullHeight largeForecast />
          </section>
          {/* Always mounted so calendar stays warm when toggling HA guest mode */}
          <section
            className={`flex flex-col h-full ${guestMode ? "hidden" : ""}`}
            style={{ gap: "var(--denboard-scale-space-md)" }}
            aria-hidden={guestMode}
          >
            <TodayEventsPanel fullHeight />
          </section>
        </div>
        <div className={`w-full ${guestMode ? "hidden" : ""}`} aria-hidden={guestMode}>
          <CurrentWeekGrid />
        </div>
        <div className="w-full">
          <DadJokePanel fullWidth />
        </div>
      </div>
    </div>
  );
}

