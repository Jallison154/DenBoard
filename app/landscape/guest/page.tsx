'use client';

import { TimePanel } from "@/components/TimePanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
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

export default function TvGuestPage() {
  const fetcher = useCallback(fetchWeather, []);
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
            <DadJokePanel />
          </section>
        </div>
      </div>
    </div>
  );
}

