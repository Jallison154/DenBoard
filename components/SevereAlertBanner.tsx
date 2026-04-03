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
          className="w-full flex justify-center"
          style={{ marginBottom: "var(--denboard-scale-space-md)" }}
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="max-w-3xl w-full rounded-2xl border border-amber-400/40 bg-amber-900/55 backdrop-blur-xl">
            <div
              className="flex items-center"
              style={{
                padding: "var(--denboard-scale-space-md)",
                gap: "var(--denboard-scale-gap)"
              }}
            >
              <span
                className="text-amber-200"
                style={{ fontSize: "var(--denboard-scale-date)" }}
              >
                ⚠️
              </span>
              <div className="flex flex-col">
                <span
                  className="font-semibold tracking-wide uppercase text-amber-50 denboard-scale-calendar-event"
                >
                  {alerts[0].title}
                </span>
                {alerts[0].description && (
                  <span className="text-amber-100/85 denboard-scale-status">
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

