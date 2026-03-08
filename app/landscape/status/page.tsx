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

export default function TvStatusPage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { guestMode } = useGuestMode();

  return (
    <div className="flex-1 flex flex-col pt-6 pb-10">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div className="flex justify-center pt-4 pb-6">
        <TimePanel />
      </div>

      <div className="flex-1 flex flex-col gap-6 px-16 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="flex flex-col gap-6">
            <WeatherPanel />
            {!guestMode && <TodayEventsPanel />}
          </section>
          <section className="flex flex-col gap-6">
            <HomeAssistantStatus hideWhenGuest />
            <div className="max-w-xl">
              <DadJokePanel />
              {guestMode && (
                <p className="mt-2 text-xs denboard-text-secondary">
                  Guest Mode hides detailed home tiles while keeping time, weather,
                  forecasts, jokes, and alerts visible.
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

