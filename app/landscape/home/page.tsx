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
    <div className="flex-1 flex flex-col pt-6 pb-10">
      <div className="px-16">
        <SevereAlertBanner alerts={weather?.alerts} />
      </div>

      {/* Clock top centered */}
      <div className="flex justify-center pt-4 pb-6">
        <TimePanel />
      </div>

      {/* Content below in a clean grid */}
      <div className="flex-1 flex flex-col gap-6 px-16 max-w-6xl mx-auto w-full">
        <div className={`grid gap-6 ${guestMode ? "grid-cols-1 max-w-2xl mx-auto" : "grid-cols-1 lg:grid-cols-2"}`}>
          <section className="flex flex-col gap-4">
            <WeatherPanel />
          </section>
          {!guestMode && (
            <section className="flex flex-col gap-4">
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

