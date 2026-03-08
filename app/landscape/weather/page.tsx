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

export default function TvWeatherPage() {
  const fetcher = useCallback(fetchWeather, []);
  const { guestMode } = useGuestMode();
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  return (
    <div className="flex-1 flex flex-col pt-6 pb-10">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div className="flex justify-center pt-4 pb-6">
        <TimePanel />
      </div>

      <div className="flex-1 flex flex-col gap-6 px-16 max-w-6xl mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section>
            <WeatherPanel />
          </section>
          <section className="flex flex-col gap-4">
            {!guestMode && <TodayEventsPanel />}
            <div className="rounded-3xl denboard-card px-6 py-4 text-sm denboard-text-primary">
              <p className="text-[11px] uppercase tracking-[0.25em] denboard-text-secondary mb-1">
                Outlook
              </p>
              <p className="leading-relaxed">
                A calm, mountain-focused view of the next few days. Conditions update
                automatically every few minutes to stay in sync with the weather over
                your home.
              </p>
            </div>
          </section>
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

