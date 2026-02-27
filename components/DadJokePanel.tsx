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

export function DadJokePanel() {
  const fetcher = useCallback(fetchDadJoke, []);
  const { data } = usePolling<DadJokePayload>(fetcher, {
    intervalMs: 45 * 60 * 1000,
    immediate: true
  });

  return (
    <motion.div
      className="rounded-3xl bg-slate-900/70 border border-sandstone/35 shadow-[0_14px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl px-6 py-5 text-sm text-slate-100 max-w-2xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="h-5 w-1 rounded-full bg-sandstone/80" />
        <div className="text-[11px] uppercase tracking-[0.32em] text-sandstone/90">
          Dad Joke
        </div>
      </div>
      <div className="text-base leading-relaxed max-h-24 overflow-hidden">
        {data?.joke ?? "Loading a mountain-grade dad joke..."}
      </div>
    </motion.div>
  );
}

