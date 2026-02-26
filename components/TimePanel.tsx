'use client';

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { motion } from "framer-motion";
import { nowInDashboardTz } from "@/lib/time";

export function TimePanel() {
  const [now, setNow] = useState<DateTime>(() => nowInDashboardTz());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(nowInDashboardTz());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toFormat("h:mm");
  const ampm = now.toFormat("a");
  const dayName = now.toFormat("cccc");
  const date = now.toFormat("MMMM d");

  return (
    <motion.div
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="flex items-baseline gap-4">
        <span className="text-7xl md:text-8xl lg:text-9xl font-semibold tracking-tight">
          {time}
        </span>
        <span className="text-3xl md:text-4xl text-slate-300 mt-3">{ampm}</span>
      </div>
      <div className="flex flex-col text-slate-300 text-2xl md:text-3xl">
        <span className="font-medium">{dayName}</span>
        <span className="text-slate-400">{date}</span>
      </div>
    </motion.div>
  );
}

