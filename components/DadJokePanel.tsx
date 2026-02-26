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
      className="rounded-3xl bg-slate-950/50 border border-sandstone/25 px-6 py-4 text-sm text-slate-100 max-w-xl"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
    >
      <div className="text-[10px] uppercase tracking-[0.3em] text-sandstone/80 mb-1">
        Dad Joke
      </div>
      <div className="text-base leading-relaxed">
        {data?.joke ?? "Loading a mountain-grade dad joke..."}
      </div>
    </motion.div>
  );
}

