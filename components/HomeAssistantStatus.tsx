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
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className="uppercase tracking-[0.25em] text-slate-500">
          Home Status
        </span>
        <span className="h-1 w-1 rounded-full bg-slate-600" />
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px] ${
            guestMode
              ? "bg-slate-800/80 text-slate-200"
              : "bg-emerald-800/60 text-emerald-100"
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
                className="rounded-2xl border border-white/10 bg-slate-950/50 px-3 py-2 flex flex-col gap-1"
              >
                <div className="text-[11px] text-slate-400 uppercase tracking-wide">
                  {entity.label}
                </div>
                <div className="text-lg font-semibold text-slate-50">
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

function formatState(state: string) {
  if (state === "on") return "On";
  if (state === "off") return "Off";
  if (state === "unavailable") return "Unavailable";
  return state;
}

