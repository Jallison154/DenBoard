"use client";

import { useEffect, useState, useCallback } from "react";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import type { WeatherPayload } from "@/lib/weather";
import type { DadJokePayload } from "@/lib/dadJoke";
import { usePolling } from "@/components/hooks";
import { SevereAlertBanner } from "@/components/SevereAlertBanner";
import { nowInDashboardTz } from "@/lib/time";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load weather");
  return res.json();
}

async function fetchDadJoke(): Promise<DadJokePayload> {
  const res = await fetch("/api/dadjoke", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load dad joke");
  return res.json();
}

function formatTemp(temp: number, units?: "imperial" | "metric" | null) {
  const n = Math.round(temp);
  return `${n}${units === "metric" ? "℃" : "°"}`;
}

function iconFor(code?: number | string | null) {
  if (code === undefined || code === null) return "⛰";
  const k = typeof code === "string" ? code.toLowerCase() : "";
  switch (k) {
    case "rain":
    case "rainy":
    case "pouring":
      return "🌧";
    case "snow":
    case "snowy":
      return "🌨";
    case "storm":
    case "lightning":
      return "⛈";
    case "cloudy":
    case "overcast":
      return "☁️";
    case "clear":
    case "sunny":
      return "☀️";
    case "clear-night":
      return "🌙";
    case "partlycloudy":
    case "partly cloudy":
      return "🌤";
    default:
      return k.includes("clear") ? "☀️" : k.includes("cloud") ? "☁️" : "⛰";
  }
}

function formatSunTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function currentConditionKey(
  code?: number | string | null
): "rain" | "snow" | "storm" | "cloudy" | "clear" | "other" {
  if (code == null) return "other";
  const k = typeof code === "string" ? code.toLowerCase() : "";
  if (["rain", "rainy", "pouring"].includes(k)) return "rain";
  if (["snow", "snowy"].includes(k)) return "snow";
  if (["storm", "lightning", "lightning-rainy"].includes(k)) return "storm";
  if (["cloudy", "overcast", "partlycloudy", "partly cloudy"].includes(k))
    return "cloudy";
  if (["clear", "sunny", "clear-night"].includes(k)) return "clear";
  return "other";
}

function iconAnimationForCondition(
  kind: ReturnType<typeof currentConditionKey>
) {
  switch (kind) {
    case "rain":
      return {
        animate: { y: [0, 4, 0], opacity: [0.95, 1, 0.95] },
        transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "snow":
      return {
        animate: { y: [0, 3, 0], rotate: [0, 2, -2, 0] },
        transition: { duration: 2.8, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "storm":
      return {
        animate: { scale: [1, 1.08, 1], opacity: [0.92, 1, 0.92] },
        transition: { duration: 1.1, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "cloudy":
      return {
        animate: { x: [0, 3, 0] },
        transition: { duration: 3.6, repeat: Infinity, ease: "easeInOut" as const }
      };
    case "clear":
      return {
        animate: { rotate: [0, 6, 0], scale: [1, 1.04, 1] },
        transition: { duration: 4.8, repeat: Infinity, ease: "easeInOut" as const }
      };
    default:
      return {
        animate: { opacity: [0.95, 1, 0.95] },
        transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" as const }
      };
  }
}

/**
 * Hotel-style 16:9 dashboard: hero clock + weather strip + dad joke (matches `/tv/home`).
 */
export default function HotelTvDashboard() {
  const [now, setNow] = useState<DateTime | null>(null);
  const weatherFetcher = useCallback(fetchWeather, []);
  const dadJokeFetcher = useCallback(fetchDadJoke, []);
  const { data: weather } = usePolling<WeatherPayload>(weatherFetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const { data: dadJoke } = usePolling<DadJokePayload>(dadJokeFetcher, {
    intervalMs: 45 * 60 * 1000,
    immediate: true
  });

  useEffect(() => {
    setNow(nowInDashboardTz());
    const id = setInterval(() => setNow(nowInDashboardTz()), 1000);
    return () => clearInterval(id);
  }, []);

  const greeting =
    now
      ? now.hour < 12
        ? "Good morning"
        : now.hour < 17
        ? "Good afternoon"
        : "Good evening"
      : "Welcome";
  const conditionKey = currentConditionKey(weather?.conditionCode);
  const iconMotion = iconAnimationForCondition(conditionKey);

  return (
    <div className="flex min-h-0 w-full max-h-full flex-1 flex-col overflow-hidden">
      <SevereAlertBanner alerts={weather?.alerts} />

      <div
        className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden"
        style={{
          gap: "clamp(36px, 3.4vmin, 72px)",
          paddingTop: "clamp(18px, 1.8vmin, 36px)",
          paddingBottom: "clamp(18px, 1.8vmin, 36px)"
        }}
      >
        <div className="w-full flex flex-col items-center justify-center text-center">
          <div
            className="denboard-text-secondary font-semibold uppercase tracking-[0.28em]"
            style={{ fontSize: "clamp(12px, 1.05vmin, 20px)" }}
            suppressHydrationWarning
          >
            {greeting}
          </div>
          <div
            className="denboard-text-primary font-extrabold tracking-tight whitespace-nowrap"
            style={{
              fontSize: "clamp(85px, 9vmin, 150px)",
              lineHeight: 0.95,
              textShadow: "0 0 28px rgba(0,0,0,0.62), 0 4px 14px rgba(0,0,0,0.45)"
            }}
            suppressHydrationWarning
          >
            {now ? `${now.toFormat("h:mm")} ${now.toFormat("a")}` : "–:–– ––"}
          </div>
          <div
            className="denboard-text-primary font-semibold whitespace-nowrap"
            style={{
              fontSize: "clamp(17px, 1.5vmin, 28px)",
              textShadow: "0 0 18px rgba(0,0,0,0.55)"
            }}
            suppressHydrationWarning
          >
            {now ? `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}` : "––––––––––– • ––––––––"}
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 items-stretch">
          <motion.div
            className="col-span-8 rounded-3xl flex flex-col border border-white/10"
            style={{
              background: "rgba(0,0,0,0.35)",
              backdropFilter: "blur(18px)",
              padding: "clamp(28px, 2.6vmin, 52px)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)"
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="flex items-end gap-6">
              <motion.span
                className="leading-none mb-1"
                style={{ fontSize: "clamp(62px, 5.6vmin, 100px)" }}
                animate={iconMotion.animate}
                transition={iconMotion.transition}
              >
                {iconFor(weather?.conditionCode)}
              </motion.span>
              <span
                className="denboard-text-primary font-bold"
                style={{
                  fontSize: "clamp(94px, 9.5vmin, 156px)",
                  lineHeight: 1,
                  textShadow: "0 0 20px rgba(0,0,0,0.7)"
                }}
              >
                {weather?.temperatureCurrent != null
                  ? formatTemp(weather.temperatureCurrent, weather.units)
                  : "–°"}
              </span>
              <span
                className="denboard-text-primary font-medium capitalize"
                style={{ fontSize: "clamp(31px, 2.7vmin, 47px)" }}
              >
                {weather?.conditionText ?? "Loading…"}
              </span>
            </div>
            <div
              className="denboard-text-secondary flex items-center gap-6 mt-2"
              style={{ fontSize: "clamp(20px, 1.8vmin, 29px)" }}
            >
              {weather?.sunrise && <span>Sunrise {formatSunTime(weather.sunrise)}</span>}
              {weather?.sunset && <span>Sunset {formatSunTime(weather.sunset)}</span>}
            </div>
            {weather?.dailyForecast && weather.dailyForecast.length > 0 && (
              <div className="grid grid-cols-5 gap-5 mt-6 pt-6 border-t border-white/10">
                {weather.dailyForecast.slice(0, 5).map((day) => (
                  <div key={day.dateISO} className="flex flex-col items-center text-center">
                    <span className="denboard-text-secondary uppercase tracking-wide denboard-forecast-hotel-day">
                      {day.dayName}
                    </span>
                    <motion.span
                      className="denboard-forecast-hotel-icon"
                      animate={iconAnimationForCondition(currentConditionKey(day.iconCode)).animate}
                      transition={iconAnimationForCondition(currentConditionKey(day.iconCode)).transition}
                    >
                      {iconFor(day.iconCode)}
                    </motion.span>
                    <span className="denboard-text-primary font-semibold denboard-forecast-hotel-temp">
                      {formatTemp(day.highTemp, weather.units)}
                    </span>
                    <span className="denboard-text-secondary denboard-forecast-hotel-temp">
                      {formatTemp(day.lowTemp, weather.units)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div
            className="col-span-4 rounded-3xl denboard-card border border-sandstone/40 denboard-text-primary"
            style={{ padding: "clamp(28px, 2.3vmin, 46px)" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.12 }}
          >
            <div
              className="uppercase tracking-[0.3em] text-sandstone/90"
              style={{ fontSize: "clamp(18px, 1.35vmin, 25px)" }}
            >
              Dad Joke
            </div>
            <div
              className="leading-relaxed mt-3"
              style={{ fontSize: "clamp(31px, 2.7vmin, 49px)" }}
            >
              {dadJoke?.joke ?? "Loading a mountain-grade dad joke..."}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
