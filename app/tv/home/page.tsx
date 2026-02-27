'use client';

import { TimePanel } from "@/components/TimePanel";
import { WeatherPanel } from "@/components/WeatherPanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { HomeAssistantStatus, HomeModeBadge, useGuestMode } from "@/components/HomeAssistantStatus";
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
  const { guestMode } = useGuestMode();

  return (
    <div className="flex-1 flex flex-col pt-6 pb-6">
      <div className="px-10 lg:px-14">
        <SevereAlertBanner alerts={weather?.alerts} />
      </div>
      <div className="flex-1 grid grid-cols-12 gap-10 items-stretch px-10 lg:px-14">
        {/* Left column: time + date + dad joke */}
        <section className="col-span-5 flex flex-col justify-center gap-8">
          <TimePanel />
          <div className="max-w-2xl">
            <DadJokePanel />
          </div>
        </section>

        {/* Right column: weather + status */}
        <section className="col-span-7 flex flex-col justify-between gap-6 items-stretch">
          <div className="flex flex-col gap-4 items-end">
            <WeatherPanel />
          </div>
          <div className="flex items-end justify-between gap-4">
            {/* Hide detailed status tiles in Guest Mode */}
            <div className="max-w-xl">
              <HomeAssistantStatus hideWhenGuest />
            </div>
            <div className="hidden md:flex">
              <HomeModeBadge />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

