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

async function fetchCombined(): Promise<Combined> {
  const [bgRes, weatherRes, settingsRes] = await Promise.all([
    fetch("/api/background", { cache: "no-store" }),
    fetch("/api/weather", { cache: "no-store" }),
    fetch("/api/settings", { cache: "no-store" })
  ]);

  if (!bgRes.ok || !weatherRes.ok) {
    throw new Error("Failed to load background data");
  }

  const [background, weather, settings] = await Promise.all([
    bgRes.json(),
    weatherRes.json(),
    settingsRes.ok ? settingsRes.json() : Promise.resolve({ display: { enableWeatherEffects: true } })
  ]);
  return {
    background,
    weather,
    enableWeatherEffects: settings?.display?.enableWeatherEffects ?? true
  };
}

export function BackgroundLayer({ children, variant = "default" }: Props) {
  const fetcher = useCallback(fetchCombined, []);
  const { data } = usePolling<Combined>(fetcher, {
    intervalMs: 45 * 60 * 1000,
    immediate: true
  });

  const imageUrl = data?.background?.imageUrl ?? null;
  const overlay = data?.weather?.overlay ?? null;
  const isHotel = variant === "hotel";
  const showWeatherEffects = data?.enableWeatherEffects ?? true;

  return (
    <div className={`relative min-h-screen denboard-content-area ${!isHotel ? "denboard-gradient" : ""}`}>
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

      <div className="relative min-h-screen denboard-content z-20">{children}</div>
    </div>
  );
}

type OverlayKind = WeatherPayload["overlay"];

function WeatherOverlayLayer({ kind }: { kind: OverlayKind }) {
  if (!kind || kind === "clear") return null;

  /* z-[15] above overlay (z-10). Rain/snow: subtle tint only (particle grid removed). */
  return (
    <div className="pointer-events-none fixed inset-0 z-[15]">
      {kind === "rain" && (
        <div className="absolute inset-0 bg-gradient-to-b from-slate-500/8 via-transparent to-slate-600/12" />
      )}
      {kind === "snow" && (
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-slate-300/8" />
      )}
      {kind === "cloudy" && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/18" />
      )}
      {kind === "storm" && (
        <motion.div
          className="absolute inset-0 rounded-[4rem] border border-amberSoft/40 shadow-[0_0_55px_rgba(251,191,36,0.45)]"
          initial={{ opacity: 0.4 }}
          animate={{ opacity: [0.4, 0.75, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

