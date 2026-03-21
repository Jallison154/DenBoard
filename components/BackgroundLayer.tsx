'use client';

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BackgroundPayload } from "@/lib/background";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "./hooks";

type Props = {
  children: React.ReactNode;
  /** "hotel" = lighter overlay, scenic image prominent, for /tv/home */
  variant?: "default" | "hotel";
};

type Combined = {
  background: BackgroundPayload | null;
  weather: WeatherPayload | null;
  enableWeatherEffects: boolean;
};

function safeJson<T>(res: Response): Promise<T | null> {
  return res.ok ? res.json().catch(() => null) : Promise.resolve(null);
}

async function fetchCombined(): Promise<Combined> {
  let background: BackgroundPayload | null = null;
  let weather: WeatherPayload | null = null;
  let enableWeatherEffects = true;

  try {
    const [bgRes, weatherRes, settingsRes] = await Promise.all([
      fetch("/api/background", { cache: "no-store" }),
      fetch("/api/weather", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" })
    ]);

    const [bgData, weatherData, settingsData] = await Promise.all([
      safeJson<BackgroundPayload>(bgRes),
      safeJson<WeatherPayload>(weatherRes),
      settingsRes.ok ? settingsRes.json().catch(() => null) : Promise.resolve(null)
    ]);

    background = bgData ?? null;
    weather = weatherData ?? null;
    if (settingsData && typeof settingsData.display?.enableWeatherEffects === "boolean") {
      enableWeatherEffects = settingsData.display.enableWeatherEffects;
    }
  } catch {
    // Never throw: allow page to render with gradient-only background
  }

  return {
    background,
    weather,
    enableWeatherEffects
  };
}

function isValidImageUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("https") && url.length > 10;
}

export function BackgroundLayer({ children, variant = "default" }: Props) {
  const fetcher = useCallback(fetchCombined, []);
  const { data } = usePolling<Combined>(fetcher, {
    intervalMs: 45 * 60 * 1000,
    immediate: true
  });

  const rawUrl = data?.background?.imageUrl;
  const imageUrl = isValidImageUrl(rawUrl) ? rawUrl : null;
  const overlay = data?.weather?.overlay ?? null;
  const isHotel = variant === "hotel";
  const showWeatherEffects = data?.enableWeatherEffects ?? true;

  return (
    <div
      className={`relative flex min-h-0 w-full flex-1 flex-col denboard-content-area ${!isHotel ? "denboard-gradient" : ""}`}
    >
      <AnimatePresence initial={false}>
        {imageUrl && (
          <motion.div
            key={imageUrl}
            className="pointer-events-none fixed inset-0 z-0"
            initial={{ opacity: isHotel ? 0.5 : 0.12 }}
            animate={{ opacity: isHotel ? 0.95 : 0.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          >
            <img
              src={imageUrl}
              alt=""
              role="presentation"
              className="h-full w-full object-cover"
              style={{ filter: isHotel ? "brightness(0.92) contrast(1.02)" : "blur(10px) brightness(1.05) contrast(1.05)" }}
              referrerPolicy="no-referrer"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {isHotel ? (
        <div className="pointer-events-none fixed inset-0 z-10 denboard-hotel-overlay" />
      ) : (
        <div className="denboard-overlay-strong" />
      )}

      {showWeatherEffects && <WeatherOverlayLayer kind={overlay} />}

      <div className="relative z-20 flex min-h-0 flex-1 flex-col overflow-hidden denboard-content">
        {children}
      </div>
    </div>
  );
}

type OverlayKind = WeatherPayload["overlay"];

function WeatherOverlayLayer({ kind }: { kind: OverlayKind }) {
  if (!kind || kind === "clear") return null;

  /* z-[15] above overlay (z-10). Single-layer gradients + one cheap CSS opacity pulse. */
  return (
    <div className="pointer-events-none fixed inset-0 z-[15]">
      {kind === "rain" && (
        <div
          className="denboard-weather-subtle absolute inset-0 bg-gradient-to-b from-slate-500/8 via-transparent to-slate-600/12"
          aria-hidden
        />
      )}
      {kind === "snow" && (
        <div
          className="denboard-weather-subtle absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-slate-300/8"
          aria-hidden
        />
      )}
      {kind === "cloudy" && (
        <div
          className="denboard-weather-subtle absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/18"
          aria-hidden
        />
      )}
      {kind === "storm" && (
        <div
          className="denboard-weather-subtle absolute inset-0 rounded-[4rem] border border-amber-400/30 shadow-[0_0_40px_rgba(251,191,36,0.25)]"
          aria-hidden
        />
      )}
    </div>
  );
}

