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
    <div
      className="flex-1 flex flex-col max-w-6xl mx-auto w-full"
      style={{
        padding: "var(--denboard-scale-space-lg)",
        paddingTop: "var(--denboard-scale-space-lg)",
        paddingBottom: "var(--denboard-scale-space-xl)"
      }}
    >
      <SevereAlertBanner alerts={weather?.alerts} />

      <div
        className="flex justify-center"
        style={{
          paddingTop: "var(--denboard-scale-space-md)",
          paddingBottom: "var(--denboard-scale-gap-lg)"
        }}
      >
        <TimePanel />
      </div>

      <div
        className="flex-1 flex flex-col"
        style={{ gap: "var(--denboard-scale-gap-lg)" }}
      >
        <div
          className="grid grid-cols-1 lg:grid-cols-2"
          style={{ gap: "var(--denboard-scale-gap-lg)" }}
        >
          <section>
            <WeatherPanel />
          </section>
          <section
            className="flex flex-col"
            style={{ gap: "var(--denboard-scale-space-md)" }}
          >
            {!guestMode && <TodayEventsPanel />}
            <div
              className="rounded-3xl denboard-card denboard-scale-calendar-event denboard-text-primary"
              style={{ padding: "var(--denboard-scale-card-padding)" }}
            >
              <p className="uppercase tracking-[0.25em] denboard-text-secondary denboard-scale-status mb-1">
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

