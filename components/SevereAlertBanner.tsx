'use client';

import { AnimatePresence, motion } from "framer-motion";
import type { SevereAlert } from "@/lib/weather";

type Props = {
  alerts: SevereAlert[] | null | undefined;
};

export function SevereAlertBanner({ alerts }: Props) {
  const active = alerts && alerts.length > 0;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="pointer-events-none fixed top-0 inset-x-0 z-30 flex justify-center px-6 pt-4"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="pointer-events-auto max-w-4xl w-full rounded-2xl border border-amber-500/40 bg-amber-900/40 backdrop-blur-xl shadow-[0_0_25px_rgba(251,191,36,0.25)]">
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="text-amber-200 text-xl">⚠️</span>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-wide uppercase text-amber-100">
                  {alerts[0].title}
                </span>
                {alerts[0].description && (
                  <span className="text-xs text-amber-100/80 line-clamp-2">
                    {alerts[0].description}
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

