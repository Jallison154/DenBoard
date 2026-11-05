"use client";

import { useMemo } from "react";
import { DateTime } from "luxon";
import type { WeatherSlice } from "@/lib/types";

type Phase = "night" | "dawn" | "day" | "dusk";

/** Sky gradients per phase; precipitation/cloud cover desaturates them. */
const SKIES: Record<Phase, [string, string, string]> = {
  night: ["#03060F", "#0A1428", "#16213D"],
  dawn: ["#1B2A4A", "#5C4A7A", "#E8956B"],
  day: ["#1F5FA8", "#4C8CD0", "#9CC6EA"],
  dusk: ["#141C3A", "#5B3B6E", "#F08A5D"]
};
const OVERCAST: Record<Phase, [string, string, string]> = {
  night: ["#05080F", "#0E1420", "#1A2130"],
  dawn: ["#2A3242", "#4A5263", "#7A7F8C"],
  day: ["#4B5768", "#6E7A8C", "#9AA4B3"],
  dusk: ["#1F2533", "#3E4253", "#6A6470"]
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
  if (Math.abs(m(rise)) < 45) return "dawn";
  if (Math.abs(m(set)) < 45) return "dusk";
  return now > rise && now < set ? "day" : "night";
}

// Deterministic star field so it doesn't reshuffle on every render
const STARS = Array.from({ length: 90 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin(i * 9301 + n * 49297) * 233280;
    return x - Math.floor(x);
  };
  const q = (v: number) => Math.round(v * 100) / 100;
  return { x: q(r(1) * 100), y: q(r(2) * 62), s: q(1 + r(3) * 2.2), d: q(r(4) * 6), o: q(0.35 + r(5) * 0.65) };
});

export function Sky({ now, weather }: { now: DateTime; weather: WeatherSlice | null }) {
  const phase = phaseFor(now, weather);
  const kind = weather?.current.kind ?? "clear";
  const overcast = ["cloudy", "rain", "drizzle", "snow", "storm", "fog"].includes(kind);
  const [a, b, c] = (overcast ? OVERCAST : SKIES)[phase];
  const showStars = phase === "night" && !overcast;
  const precip = kind === "rain" || kind === "drizzle" || kind === "storm" ? "rain" : kind === "snow" ? "snow" : null;

  const ridge = useMemo(
    () =>
      phase === "day"
        ? ["#2B4A6B", "#1C334F", "#0F1E33"]
        : phase === "night"
          ? ["#0D1528", "#0A101F", "#060A14"]
          : ["#2A2440", "#1A1830", "#0E0E1E"],
    [phase]
  );

  return (
    <div className="sky" aria-hidden>
      <div className="sky-gradient" style={{ background: `linear-gradient(180deg, ${a} 0%, ${b} 55%, ${c} 100%)` }} />
      {showStars && (
        <div className="stars">
          {STARS.map((s, i) => (
            <span
              key={i}
              style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, opacity: s.o, animationDelay: `${s.d}s` }}
            />
          ))}
        </div>
      )}
      {(phase === "dawn" || phase === "dusk") && !overcast && <div className="sun-glow" />}
      {(overcast || kind === "partly") && (
        <div className="clouds">
          <span className="c1" />
          <span className="c2" />
          <span className="c3" />
        </div>
      )}
      <svg className="ridges" viewBox="0 0 1000 300" preserveAspectRatio="none">
        <path d="M0 170 L90 120 L160 150 L250 80 L340 140 L420 100 L520 160 L610 90 L700 130 L790 70 L880 120 L1000 95 L1000 300 L0 300Z" fill={ridge[0]} opacity=".9" />
        <path d="M0 210 L120 160 L210 195 L300 150 L400 200 L500 165 L600 210 L720 160 L820 205 L920 170 L1000 190 L1000 300 L0 300Z" fill={ridge[1]} />
        <path d="M0 250 L140 220 L260 245 L380 215 L500 250 L640 225 L760 255 L880 228 L1000 245 L1000 300 L0 300Z" fill={ridge[2]} />
      </svg>
      {precip && <div className={`precip precip-${precip}`} />}
      <div className="sky-vignette" />
    </div>
  );
}
