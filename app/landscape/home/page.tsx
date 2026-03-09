'use client';

import { TimePanel } from "@/components/TimePanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel } from "@/components/CalendarPanels";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import { useGuestMode } from "@/components/HomeAssistantStatus";
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

export default function TvHomePage() {
  const fetcher = useCallback(fetchWeather, []);
  const { guestMode } = useGuestMode();
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  return (
    <div
      className="flex-1 flex flex-col max-w-6xl mx-auto w-full"
      style={{
        paddingTop: "var(--denboard-scale-space-lg)",
        paddingBottom: "var(--denboard-scale-space-xl)",
        paddingLeft: "var(--denboard-scale-space-lg)",
        paddingRight: "var(--denboard-scale-space-lg)"
      }}
    >
      <SevereAlertBanner alerts={weather?.alerts} />

      {/* Clock top centered */}
      <div
        className="flex justify-center"
        style={{
          paddingTop: "var(--denboard-scale-space-md)",
          paddingBottom: "var(--denboard-scale-gap-lg)"
        }}
      >
        <TimePanel />
      </div>

      {/* Content below in a clean grid */}
      <div
        className="flex-1 flex flex-col"
        style={{ gap: "var(--denboard-scale-gap-lg)" }}
      >
        <div
          className={`grid ${guestMode ? "grid-cols-1 max-w-2xl mx-auto" : "grid-cols-1 lg:grid-cols-2"}`}
          style={{ gap: "var(--denboard-scale-gap-lg)" }}
        >
          <section
            className="flex flex-col"
            style={{ gap: "var(--denboard-scale-space-md)" }}
          >
            <WeatherPanel />
          </section>
          {!guestMode && (
            <section
              className="flex flex-col"
              style={{ gap: "var(--denboard-scale-space-md)" }}
            >
              <TodayEventsPanel />
            </section>
          )}
        </div>
        <div className="flex justify-center">
          <div className="max-w-2xl w-full">
            <DadJokePanel />
          </div>
        </div>
      </div>
    </div>
  );
}

