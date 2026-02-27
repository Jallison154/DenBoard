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

export default function TvStatusPage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { guestMode } = useGuestMode();

  return (
    <div className="flex-1 flex flex-col">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div className="flex-1 grid grid-cols-12 gap-8 items-stretch pt-6 pb-6">
        <section className="col-span-5 flex flex-col justify-between gap-8">
          <TimePanel />
          <WeatherPanel />
        </section>
        <section className="col-span-7 flex flex-col justify-between gap-6">
          <HomeAssistantStatus hideWhenGuest />
          <div className="max-w-xl">
            <DadJokePanel />
            {guestMode && (
              <p className="mt-2 text-xs text-slate-400">
                Guest Mode hides detailed home tiles while keeping time, weather,
                forecasts, jokes, and alerts visible.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

