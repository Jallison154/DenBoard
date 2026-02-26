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

export default function TvWeatherPage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });

  return (
    <div className="flex-1 flex flex-col">
      <SevereAlertBanner alerts={weather?.severeAlerts} />

      <div className="flex-1 grid grid-cols-12 gap-8 items-center pt-6 pb-6">
        <section className="col-span-5 flex flex-col justify-center gap-8">
          <TimePanel />
          <div className="max-w-md">
            <DadJokePanel />
          </div>
        </section>
        <section className="col-span-7 flex flex-col gap-6">
          <WeatherPanel />
          <div className="rounded-3xl bg-slate-950/60 border border-white/10 px-6 py-4 text-sm text-slate-200 max-w-xl">
            <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-1">
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
    </div>
  );
}

