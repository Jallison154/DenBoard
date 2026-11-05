"use client";

import { DateTime } from "luxon";
import type { WeatherSlice } from "@/lib/types";

type Phase = "night" | "dawn" | "day" | "dusk";

/**
 * A quiet background: near-black with one soft wash of color that follows the sun.
 * Overcast/precip mutes it. Changes over minutes, never animates on its own.
 */
const GLOW: Record<Phase, string> = {
  night: "rgba(70, 90, 160, 0.16)",
  dawn: "rgba(236, 150, 110, 0.20)",
  day: "rgba(110, 160, 230, 0.18)",
  dusk: "rgba(210, 120, 150, 0.18)"
};

function phaseFor(now: DateTime, weather: WeatherSlice | null): Phase {
  const today = weather?.daily[0];
  if (!today) {
    const h = now.hour;
    return h < 6 || h >= 20 ? "night" : h < 8 ? "dawn" : h < 18 ? "day" : "dusk";
  }
  const rise = DateTime.fromISO(today.sunrise, { zone: now.zone });
  const set = DateTime.fromISO(today.sunset, { zone: now.zone });
  const m = (d: DateTime) => d.diff(now, "minutes").minutes;
  if (Math.abs(m(rise)) < 50) return "dawn";
  if (Math.abs(m(set)) < 50) return "dusk";
  return now > rise && now < set ? "day" : "night";
}

export function Sky({ now, weather }: { now: DateTime; weather: WeatherSlice | null }) {
  const phase = phaseFor(now, weather);
  const kind = weather?.current.kind ?? "clear";
  const muted = ["cloudy", "rain", "drizzle", "snow", "storm", "fog"].includes(kind);
  const glow = muted ? "rgba(150, 160, 180, 0.10)" : GLOW[phase];
  return (
    <div className="sky" aria-hidden>
      <div
        className="sky-wash"
        style={{ background: `radial-gradient(120% 60% at 85% 0%, ${glow} 0%, transparent 70%), radial-gradient(90% 50% at 0% 100%, rgba(255,255,255,0.025) 0%, transparent 70%)` }}
      />
    </div>
  );
}
