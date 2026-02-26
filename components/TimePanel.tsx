'use client';

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import { nowInDashboardTz } from "@/lib/time";

// Placeholder so server and client render the same HTML (avoids hydration error #418)
const PLACEHOLDER = { time: "–:––", ampm: "––", dayName: "–––––", date: "––––– –" };

export function TimePanel() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<DateTime | null>(null);

  useEffect(() => {
    setMounted(true);
    setNow(nowInDashboardTz());
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      setNow(nowInDashboardTz());
    }, 1000);
    return () => clearInterval(id);
  }, [mounted]);

  const display = now
    ? {
        time: now.toFormat("h:mm"),
        ampm: now.toFormat("a"),
        dayName: now.toFormat("cccc"),
        date: now.toFormat("MMMM d"),
      }
    : PLACEHOLDER;

  return (
    <motion.div
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-baseline gap-4">
        <span
          className="text-7xl md:text-8xl lg:text-9xl font-semibold tracking-tight"
          suppressHydrationWarning
        >
          {display.time}
        </span>
        <span
          className="text-3xl md:text-4xl text-slate-300 mt-3"
          suppressHydrationWarning
        >
          {display.ampm}
        </span>
      </div>
      <div className="flex flex-col text-slate-300 text-2xl md:text-3xl">
        <span className="font-medium" suppressHydrationWarning>
          {display.dayName}
        </span>
        <span className="text-slate-400" suppressHydrationWarning>
          {display.date}
        </span>
      </div>
    </motion.div>
  );
}

