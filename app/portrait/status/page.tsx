'use client';

import { TimePanel } from "@/components/TimePanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel } from "@/components/CalendarPanels";
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

export default function PortraitStatusPage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { guestMode } = useGuestMode();

  return (
    <div className="flex-1 flex flex-col">
      <SevereAlertBanner alerts={weather?.alerts} />

      {guestMode ? (
        <div
          className="flex-1 flex flex-col items-center"
          style={{
            paddingTop: "18vh",
            paddingBottom: "var(--denboard-scale-gap-lg)",
            gap: "var(--denboard-scale-gap-lg)"
          }}
        >
          {/* Guest portrait: use more vertical space with centered, larger clock */}
          <div
            className="w-full flex justify-center"
            style={{ transform: "scale(1.15)", transformOrigin: "top center" }}
          >
            <TimePanel />
          </div>
          <div className="w-full max-w-2xl">
            <WeatherPanel />
          </div>
          <div className="w-full max-w-2xl">
            <DadJokePanel fullWidth />
          </div>
          <p
            className="denboard-text-secondary denboard-scale-status text-center"
            style={{ marginTop: "var(--denboard-scale-gap)" }}
          >
            Guest Mode keeps the home dashboard welcoming while hiding personal
            details.
          </p>
        </div>
      ) : (
        <div
          className="flex-1 flex flex-col"
          style={{
            gap: "var(--denboard-scale-gap-lg)",
            paddingTop: "var(--denboard-scale-space-md)",
            paddingBottom: "var(--denboard-scale-gap-lg)"
          }}
        >
          <TimePanel />
          <TodayEventsPanel />
          <WeatherPanel />
          <HomeAssistantStatus hideWhenGuest />
          <div style={{ paddingTop: "var(--denboard-scale-space)" }}>
            <DadJokePanel />
          </div>
        </div>
      )}
    </div>
  );
}

