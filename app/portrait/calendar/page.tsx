'use client';

import { TimePanel } from "@/components/TimePanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel, FourWeekGrid } from "@/components/CalendarPanels";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
import { useCallback } from "react";
import { useGuestMode } from "@/components/HomeAssistantStatus";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load weather");
  }
  return res.json();
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
        className="flex-1 flex flex-col"
        style={{
          gap: "var(--denboard-scale-gap-lg)",
          paddingTop: "var(--denboard-scale-space-md)",
          paddingBottom: "var(--denboard-scale-gap-lg)"
        }}
      >
        <TimePanel />

        {!guestMode ? (
          <>
            <TodayEventsPanel />
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

        <div style={{ paddingTop: "var(--denboard-scale-gap)" }}>
          <DadJokePanel />
        </div>
      </div>
    </div>
  );
}

