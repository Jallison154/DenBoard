'use client';

import { useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { HomeAssistantPayload } from "@/lib/homeAssistant";
import { usePolling } from "./hooks";

async function fetchHomeAssistant(): Promise<HomeAssistantPayload> {
  const res = await fetch("/api/home-assistant", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load Home Assistant state");
  }
  return res.json();
}

type Props = {
  hideWhenGuest?: boolean;
};

export function useGuestMode() {
  const fetcher = useCallback(fetchHomeAssistant, []);
  const { data } = usePolling<HomeAssistantPayload>(fetcher, {
    intervalMs: 10 * 1000,
    immediate: true
  });
  return {
    guestMode: data?.guestMode ?? false,
    payload: data
  };
}

export function HomeAssistantStatus({ hideWhenGuest }: Props) {
  const { guestMode, payload } = useGuestMode();

  const showTiles = !(hideWhenGuest && guestMode);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs denboard-text-secondary">
        <span className="uppercase tracking-[0.25em] denboard-text-secondary">
          Home Status
        </span>
        <span className="h-1 w-1 rounded-full bg-slate-600" />
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10px] ${
            guestMode
              ? "bg-slate-800/90 text-slate-100"
              : "bg-emerald-700/80 text-emerald-50"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              guestMode ? "bg-slate-300" : "bg-emerald-300"
            }`}
          />
          {guestMode ? "Guest Mode" : "Family Mode"}
        </span>
      </div>

      <AnimatePresence mode="sync">
        {showTiles && payload && (
          <motion.div
            key={guestMode ? "guest-off" : "guest-on"}
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-w-xl"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {payload.entities.map((entity) => (
              <div
                key={entity.id}
                className="rounded-2xl denboard-card px-3 py-2 flex flex-col gap-1"
              >
                <div className="text-[11px] denboard-text-secondary uppercase tracking-wide">
                  {entity.label}
                </div>
                <div className="text-lg font-semibold denboard-text-primary">
                  {formatState(entity.state)}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function HomeModeBadge() {
  const { guestMode } = useGuestMode();

  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-slate-950/80 border border-white/20 px-3 py-2 text-xs text-slate-100 shadow-[0_12px_30px_rgba(0,0,0,0.7)]">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
          guestMode ? "bg-slate-700 text-slate-100" : "bg-emerald-600 text-emerald-50"
        }`}
      >
        {guestMode ? "G" : "F"}
      </span>
      <span className="uppercase tracking-[0.2em]">
        {guestMode ? "Guest Mode" : "Family Mode"}
      </span>
    </div>
  );
}

function formatState(state: string) {
  if (state === "on") return "On";
  if (state === "off") return "Off";
  if (state === "unavailable") return "Unavailable";
  return state;
}

