'use client';

import { TimePanel } from "@/components/TimePanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { HomeAssistantStatus } from "@/components/HomeAssistantStatus";
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

export default function PortraitHomePage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  return (
    <div className="flex-1 flex flex-col">
      <SevereAlertBanner alerts={weather?.severeAlerts} />

      <div className="flex-1 flex flex-col gap-6 pt-4 pb-6">
        <section className="flex flex-col gap-6">
          <TimePanel />
          <WeatherPanel />
        </section>
        <section className="flex flex-col gap-4 pt-2">
          <HomeAssistantStatus hideWhenGuest />
          <DadJokePanel />
        </section>
      </div>
    </div>
  );
}

