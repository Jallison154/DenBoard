'use client';

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import { nowInDashboardTz, getGreeting } from "@/lib/time";

// Placeholder so server and client render the same HTML (avoids hydration error #418)
const PLACEHOLDER = {
  greeting: "Good morning",
  time: "–:––",
  ampm: "––",
  dateLine: "–––––––– • ––––– –"
};

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
        greeting: getGreeting(now),
        time: now.toFormat("h:mm"),
        ampm: now.toFormat("a"),
        dateLine: `${now.toFormat("cccc")} • ${now.toFormat("MMMM d")}`
      }
    : PLACEHOLDER;

  return (
    <motion.div
      className="flex flex-col"
      style={{ gap: "var(--denboard-scale-gap)" }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <span
        className="denboard-text-secondary denboard-scale-greeting font-medium"
        suppressHydrationWarning
      >
        {display.greeting}
      </span>
      <div
        className="flex items-baseline"
        style={{ gap: "var(--denboard-scale-space-md)" }}
      >
        <span
          className="denboard-time-primary denboard-scale-time font-extrabold tracking-tight"
          suppressHydrationWarning
        >
          {display.time}
        </span>
        <span
          className="denboard-time-subtitle font-semibold"
          style={{
            fontSize: "clamp(20px, 2.5vmin, 48px)",
            marginTop: "var(--denboard-scale-space-md)"
          }}
          suppressHydrationWarning
        >
          {display.ampm}
        </span>
      </div>
      <span
        className="denboard-time-subtitle denboard-scale-date font-semibold whitespace-nowrap"
        suppressHydrationWarning
      >
        {display.dateLine}
      </span>
    </motion.div>
  );
}

