"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { WeatherPayload } from "@/lib/weather";
import {
  currentConditionKey,
  formatForecastTemp,
  iconAnimationForCondition,
  OVERLAY_LABEL,
  overlayToConditionKey,
  weatherIcon
} from "@/lib/weatherDisplay";
import { usePolling, usePrefersReducedMotion } from "./hooks";

async function fetchWeather(): Promise<WeatherPayload> {
  const res = await fetch("/api/weather", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load weather");
  return res.json();
}

type Props = {
  open: boolean;
  onClose: () => void;
  animationsEnabled?: boolean;
};

function formatClock(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function FullscreenWeatherBackdrop({
  kind,
  animationsEnabled
}: {
  kind: ReturnType<typeof overlayToConditionKey>;
  animationsEnabled: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const animate = animationsEnabled && !reduced;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/55 via-slate-900/35 to-slate-950/70" />
      {kind === "rain" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-sky-400/12 via-transparent to-slate-600/18 denboard-weather-subtle"
          animate={animate ? { opacity: [0.75, 1, 0.75] } : undefined}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {kind === "snow" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-slate-300/10 denboard-weather-subtle"
          animate={animate ? { opacity: [0.8, 1, 0.8] } : undefined}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {kind === "cloudy" && (
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/25 denboard-weather-subtle" />
      )}
      {kind === "storm" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-b from-amber-500/10 via-transparent to-indigo-950/30"
          animate={animate ? { opacity: [0.7, 1, 0.7] } : undefined}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      {kind === "clear" && (
        <div className="absolute inset-0 bg-gradient-to-b from-amber-200/8 via-transparent to-sky-900/15 denboard-weather-subtle" />
      )}
    </div>
  );
}

export function WeatherFullscreenOverlay({
  open,
  onClose,
  animationsEnabled = true
}: Props) {
  const fetcher = useCallback(fetchWeather, []);
  const { data, loading } = usePolling<WeatherPayload>(fetcher, {
    intervalMs: 6 * 60 * 1000,
    immediate: true
  });
  const reduced = usePrefersReducedMotion();
  const motionOn = animationsEnabled && !reduced;

  const overlayKind = overlayToConditionKey(data?.overlay);
  const conditionKind = currentConditionKey(data?.conditionCode ?? overlayKind);
  const iconMotion = iconAnimationForCondition(conditionKind, motionOn);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const temp =
    data?.temperatureCurrent != null
      ? formatForecastTemp(data.temperatureCurrent, data.units)
      : null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex flex-col"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.5, ease: "easeOut" }}
          role="dialog"
          aria-modal="true"
          aria-label="Outside weather conditions"
        >
          <FullscreenWeatherBackdrop
            kind={overlayKind}
            animationsEnabled={motionOn}
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-10 rounded-full border border-white/20 bg-black/40 px-4 py-2 denboard-text-primary denboard-scale-status hover:bg-black/55 transition-colors"
          >
            Close
          </button>

          <div className="relative z-[1] flex flex-1 flex-col items-center justify-center px-[clamp(1rem,4vw,4rem)] py-[clamp(1.5rem,5vh,4rem)] text-center">
            <p
              className="denboard-text-secondary uppercase tracking-[0.32em] font-semibold mb-[clamp(0.75rem,2vh,1.5rem)]"
              style={{ fontSize: "clamp(0.85rem, 1.8vmin, 1.35rem)" }}
            >
              Outside now
            </p>
            <motion.div
              className="leading-none mb-[clamp(0.5rem,2vh,1.5rem)]"
              style={{ fontSize: "clamp(3.5rem, min(14vmin, 16vh), 11rem)" }}
              animate={iconMotion.animate}
              transition={iconMotion.transition}
            >
              {weatherIcon(data?.conditionCode ?? conditionKind)}
            </motion.div>

            {temp ? (
              <div
                className="font-extrabold denboard-text-primary tracking-tight"
                style={{
                  fontSize: "clamp(4rem, min(18vmin, 22vh), 14rem)",
                  lineHeight: 0.95,
                  textShadow: "0 0 40px rgba(0,0,0,0.65)"
                }}
              >
                {temp}
              </div>
            ) : (
              <div
                className="denboard-text-secondary"
                style={{ fontSize: "clamp(1.25rem, 3vmin, 2.5rem)" }}
              >
                {loading ? "Loading weather…" : "Weather unavailable"}
              </div>
            )}

            <p
              className="denboard-text-primary font-semibold mt-[clamp(0.5rem,2vh,1.25rem)] max-w-[28ch]"
              style={{ fontSize: "clamp(1.25rem, min(3.5vmin, 4vh), 3rem)" }}
            >
              {data?.conditionText ?? "Local conditions"}
            </p>

            {(data?.sunrise || data?.sunset) && (
              <p
                className="denboard-text-secondary mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1"
                style={{ fontSize: "clamp(0.9rem, 1.8vmin, 1.35rem)" }}
              >
                {data.sunrise && <span>Sunrise {formatClock(data.sunrise)}</span>}
                {data.sunset && <span>Sunset {formatClock(data.sunset)}</span>}
              </p>
            )}

            {data?.overlay && (
              <p
                className="denboard-text-secondary mt-4"
                style={{ fontSize: "clamp(0.85rem, 1.6vmin, 1.2rem)" }}
              >
                {OVERLAY_LABEL[data.overlay]}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Toggle + brief auto-intro for fullscreen weather when enabled in settings. */
export function WeatherFullscreenController({
  enabled,
  animationsEnabled
}: {
  enabled: boolean;
  animationsEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setOpen(false);
      return;
    }
    const intro = window.setTimeout(() => setOpen(true), 2500);
    const dismiss = window.setTimeout(() => setOpen(false), 22_000);
    return () => {
      clearTimeout(intro);
      clearTimeout(dismiss);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "w" || e.key === "W") setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--denboard-scale-space-lg)+3.25rem)] right-[max(1rem,env(safe-area-inset-right))] z-[60] rounded-full border border-white/15 bg-black/45 px-3 py-2 denboard-text-primary denboard-scale-status backdrop-blur-sm hover:bg-black/60 transition-colors"
        aria-label="Outside weather"
        title="Outside conditions (W)"
      >
        Outside
      </button>
      <WeatherFullscreenOverlay
        open={open}
        onClose={() => setOpen(false)}
        animationsEnabled={animationsEnabled}
      />
    </>
  );
}
