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

        {/* Home Assistant entities */}
        <div className="w-full flex-shrink-0">
          <HomeAssistantStatus hideWhenGuest />
        </div>
        {/* Dad joke full width */}
        <div className="w-full flex-shrink-0" style={{ paddingTop: "var(--denboard-scale-gap)" }}>
          <DadJokePanel fullWidth />
        </div>
      </div>
    </div>
  );
}

