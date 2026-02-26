'use client';

import { TimePanel } from "@/components/TimePanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
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
      <SevereAlertBanner alerts={weather?.severeAlerts} />

      <div className="flex-1 flex flex-col gap-5 pt-4 pb-6">
        <TimePanel />
        <WeatherPanel />
        <HomeAssistantStatus hideWhenGuest />
        <div className="pt-1">
          <DadJokePanel />
          {guestMode && (
            <p className="mt-2 text-xs text-slate-400">
              Guest Mode keeps the home dashboard welcoming while hiding personal
              details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

