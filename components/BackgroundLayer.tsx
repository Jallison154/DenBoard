'use client';

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { BackgroundPayload } from "@/lib/background";
import type { WeatherPayload } from "@/lib/weather";
import { usePolling } from "./hooks";

type Props = {
  children: React.ReactNode;
};

type Combined = {
  background: BackgroundPayload | null;
  weather: WeatherPayload | null;
};

async function fetchCombined(): Promise<Combined> {
  const [bgRes, weatherRes] = await Promise.all([
    fetch("/api/background", { cache: "no-store" }),
    fetch("/api/weather", { cache: "no-store" })
  ]);

  if (!bgRes.ok || !weatherRes.ok) {
    throw new Error("Failed to load background data");
  }

  const [background, weather] = await Promise.all([
    bgRes.json(),
    weatherRes.json()
  ]);
  return { background, weather };
}

export function BackgroundLayer({ children }: Props) {
  const fetcher = useCallback(fetchCombined, []);
  const { data } = usePolling<Combined>(fetcher, {
    intervalMs: 45 * 60 * 1000,
    immediate: true
  });

  const imageUrl = data?.background?.imageUrl ?? null;
  const overlay = data?.weather?.overlay ?? null;

  return (
    <div className="relative min-h-screen denboard-gradient text-slate-50">
      {imageUrl && (
        <motion.div
          key={imageUrl}
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
          initial={{ opacity: 0.15 }}
          animate={{ opacity: 0.45 }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        >
          <img
            src={imageUrl}
            alt=""
            role="presentation"
            className="h-full w-full object-cover"
            style={{ filter: "blur(6px)" }}
            referrerPolicy="no-referrer"
          />
        </motion.div>
      )}

      <WeatherOverlayLayer kind={overlay} />

      <div className="relative min-h-screen denboard-content">{children}</div>
    </div>
  );
}

type OverlayKind = WeatherPayload["overlay"];

function WeatherOverlayLayer({ kind }: { kind: OverlayKind }) {
  if (!kind || kind === "clear") return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-0">
      {kind === "rain" && (
        <div className="absolute inset-0 opacity-40 mix-blend-screen overflow-hidden">
          <div className="denboard-rain" />
        </div>
      )}
      {kind === "snow" && (
        <div className="absolute inset-0 opacity-50 mix-blend-screen overflow-hidden">
          <div className="denboard-snow" />
        </div>
      )}
      {kind === "cloudy" && (
        <div className="absolute inset-0 bg-gradient-to-b from-haze/20 via-transparent to-haze/30" />
      )}
      {kind === "storm" && (
        <motion.div
          className="absolute inset-0 bg-black/40"
          initial={{ opacity: 0.2 }}
          animate={{ opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}

