'use client';

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { DadJokePayload } from "@/lib/dadJoke";
import { usePolling } from "./hooks";

async function fetchDadJoke(): Promise<DadJokePayload> {
  const res = await fetch("/api/dadjoke", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load dad joke");
  }
  return res.json();
}

type Props = {
  fullWidth?: boolean;
  /** Landscape dashboard: show full joke (no calendar-cell height cap). */
  variant?: "default" | "landscape";
};

export function DadJokePanel({ fullWidth, variant = "default" }: Props) {
  const fetcher = useCallback(fetchDadJoke, []);
  const { data } = usePolling<DadJokePayload>(fetcher, {
    intervalMs: 45 * 60 * 1000,
    immediate: true
  });

  return (
    <motion.div
      className={`rounded-3xl denboard-card border-sandstone/40 denboard-scale-calendar-event denboard-text-primary ${fullWidth ? "w-full" : "max-w-2xl"}`}
      style={{ padding: "var(--denboard-scale-card-padding)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
    >
      <div
        className="flex items-center"
        style={{ gap: "var(--denboard-scale-gap)", marginBottom: "var(--denboard-scale-gap)" }}
      >
        <div
          className="w-1 rounded-full bg-sandstone/80"
          style={{ height: "var(--denboard-scale-space-md)" }}
        />
        <div className="uppercase tracking-[0.32em] text-sandstone/90 denboard-scale-status">
          Dad Joke
        </div>
      </div>
      <div
        className={
          variant === "landscape"
            ? "leading-relaxed"
            : "leading-relaxed overflow-hidden"
        }
        style={{
          fontSize: "var(--denboard-scale-calendar-event)",
          ...(variant === "default"
            ? { maxHeight: "var(--denboard-scale-calendar-cell-height)" }
            : {})
        }}
      >
        {data?.joke ?? "Loading a mountain-grade dad joke..."}
      </div>
    </motion.div>
  );
}

