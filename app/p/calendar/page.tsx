'use client';

import { TimePanel } from "@/components/TimePanel";
import { DadJokePanel } from "@/components/DadJokePanel";
import { TodayEventsPanel, FourWeekGrid } from "@/components/CalendarPanels";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "@/components/hooks";
import { useCallback } from "react";
import { useGuestMode } from "@/components/HomeAssistantStatus";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load weather");
  }
  return res.json();
}

export default function PortraitCalendarPage() {
  const fetcher = useCallback(fetchWeather, []);
  const { data: weather } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { guestMode } = useGuestMode();

  return (
    <div className="flex-1 flex flex-col">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div className="flex-1 flex flex-col gap-5 pt-4 pb-6">
        <TimePanel />

        {!guestMode ? (
          <>
            <TodayEventsPanel />
            <FourWeekGrid />
          </>
        ) : (
          <div className="rounded-3xl bg-slate-950/70 border border-white/10 px-6 py-6 text-sm text-slate-200">
            <p className="text-[11px] uppercase tracking-[0.3em] text-slate-500 mb-2">
              Guest Mode
            </p>
            <p className="leading-relaxed">
              Personal calendar details are hidden while Guest Mode is on. Time,
              date, weather, forecasts, jokes, and severe alerts remain visible on
              the other DenBoard views.
            </p>
          </div>
        )}

        <div className="pt-2">
          <DadJokePanel />
        </div>
      </div>
    </div>
  );
}

