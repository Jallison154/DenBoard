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

export default function TvHomePage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  return (
    <div className="flex-1 flex flex-col pt-10 pb-10">
      <div className="px-16">
        <SevereAlertBanner alerts={weather?.alerts} />
      </div>
      <div className="flex-1 grid grid-cols-12 gap-10 items-center px-16">
        {/* Left column: time + date + dad joke */}
        <section className="col-span-5 flex flex-col justify-center gap-6">
          <TimePanel />
          <div className="max-w-2xl">
            <DadJokePanel />
          </div>
        </section>

        {/* Right column: weather card */}
        <section className="col-span-7 flex justify-end">
          <div className="w-full max-w-3xl">
            <WeatherPanel />
          </div>
        </section>
      </div>
    </div>
  );
}

