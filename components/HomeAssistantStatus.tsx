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
  /** When true, entities span full width and shrink as more are added */
  fullWidth?: boolean;
  /** Hide Guest/Family/HA mode pill (e.g. portrait — mode is shown in the footer instead) */
  hideModeBadge?: boolean;
};

export function useGuestMode() {
  const fetcher = useCallback(fetchHomeAssistant, []);
  const { data, lastFetchedAt } = usePolling<HomeAssistantPayload>(fetcher, {
    intervalMs: 10 * 1000,
    immediate: true
  });
  return {
    guestMode: data?.guestMode ?? false,
    payload: data,
    lastFetchedAt
  };
}

export function HomeAssistantStatus({
  hideWhenGuest,
  fullWidth,
  hideModeBadge
}: Props) {
  const { guestMode, payload } = useGuestMode();

  const showTiles = !(hideWhenGuest && guestMode);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div
        className="flex items-center denboard-text-secondary denboard-scale-status"
        style={{ gap: "var(--denboard-scale-gap)" }}
      >
        <span className="uppercase tracking-[0.25em] denboard-text-secondary">
          Home Status
        </span>
        {!hideModeBadge && (
          <>
            <span className="h-1 w-1 rounded-full bg-slate-600" />
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] denboard-scale-status ${
                payload?.isFallback
                  ? "bg-amber-900/85 text-amber-100"
                  : guestMode
                  ? "bg-slate-800/90 text-slate-100"
                  : "bg-emerald-700/80 text-emerald-50"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  payload?.isFallback
                    ? "bg-amber-300"
                    : guestMode
                    ? "bg-slate-300"
                    : "bg-emerald-300"
                }`}
              />
              {payload?.isFallback
                ? "HA unreachable"
                : guestMode
                ? "Guest Mode"
                : "Family Mode"}
            </span>
          </>
        )}
      </div>

      {payload?.isFallback && (
        <p className="denboard-text-secondary denboard-scale-status text-sm max-w-xl">
          No data from Home Assistant. Confirm{" "}
          <code className="text-sandstone/90">HOME_ASSISTANT_TOKEN</code> and URL in{" "}
          <code className="text-sandstone/90">.env</code>, and check DenBoard logs.
        </p>
      )}

      <AnimatePresence mode="sync">
        {showTiles && payload && !payload.isFallback && (
          <motion.div
            key={guestMode ? "guest-off" : "guest-on"}
            className={
              fullWidth
                ? "flex flex-wrap w-full"
                : "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 max-w-xl"
            }
            style={fullWidth ? { gap: "var(--denboard-scale-gap)" } : undefined}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {payload.entities.map((entity) => (
              <div
                key={entity.id}
                className={`rounded-2xl denboard-card flex flex-col ${
                  fullWidth ? "flex-1 min-w-[4.5rem]" : ""
                }`}
                style={{
                  padding: "var(--denboard-scale-space-md)",
                  gap: "var(--denboard-scale-space)"
                }}
              >
                <div className="denboard-text-secondary uppercase tracking-wide denboard-scale-status truncate">
                  {entity.label}
                </div>
                <div className="font-semibold denboard-text-primary denboard-scale-date truncate">
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
  const { guestMode, payload } = useGuestMode();

  return (
    <div className="inline-flex items-center gap-2 rounded-full denboard-card-nested px-3 py-2 text-xs denboard-text-primary">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
          payload?.isFallback
            ? "bg-amber-700 text-amber-50"
            : guestMode
            ? "bg-slate-700 text-slate-100"
            : "bg-emerald-600 text-emerald-50"
        }`}
      >
        {payload?.isFallback ? "!" : guestMode ? "G" : "F"}
      </span>
      <span className="uppercase tracking-[0.2em]">
        {payload?.isFallback ? "HA offline" : guestMode ? "Guest Mode" : "Family Mode"}
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

