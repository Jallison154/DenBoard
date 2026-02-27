'use client';

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { CalendarPayload } from "@/lib/calendar";
import { getConfig } from "@/lib/config";
import { usePolling } from "./hooks";

async function fetchCalendar(): Promise<CalendarPayload> {
  const res = await fetch("/api/calendar", { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load calendar");
  }
  return res.json();
}

export function TodayEventsPanel() {
  const fetcher = useCallback(fetchCalendar, []);
  const { data } = usePolling<CalendarPayload>(fetcher, {
    intervalMs: 5 * 60 * 1000,
    immediate: true
  });

  const today = data?.today;

  return (
    <motion.div
      className="rounded-3xl denboard-card px-6 py-5 flex flex-col gap-3 max-w-xl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs uppercase tracking-[0.3em] denboard-text-secondary">
          Today
        </span>
        <span className="text-[11px] denboard-text-secondary">
          All-day and timed events
        </span>
      </div>

      {!today && (
        <div className="denboard-text-secondary text-sm">Loading calendar…</div>
      )}

      {today && today.allDay.length === 0 && today.timed.length === 0 && (
        <div className="denboard-text-secondary text-sm">Nothing scheduled today.</div>
      )}

      {today && today.allDay.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.2em] denboard-text-secondary">
            All Day
          </div>
          {today.allDay.map((evt) => (
            <div
              key={evt.id}
              className="rounded-2xl denboard-card-nested px-3 py-2 text-sm denboard-text-primary"
            >
              {evt.title}
            </div>
          ))}
        </div>
      )}

      {today && today.timed.length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="text-[11px] uppercase tracking-[0.2em] denboard-text-secondary">
            Scheduled
          </div>
          <div className="flex flex-col gap-2">
            {today.timed.map((evt) => (
              <div
                key={evt.id}
                className="rounded-2xl denboard-card-nested px-3 py-2 text-sm flex items-baseline gap-3"
              >
                <span className="text-[11px] denboard-text-secondary w-20">
                  {formatTime(evt.start)} – {formatTime(evt.end)}
                </span>
                <span className="denboard-text-primary">{evt.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export function FourWeekGrid() {
  const fetcher = useCallback(fetchCalendar, []);
  const { data } = usePolling<CalendarPayload>(fetcher, {
    intervalMs: 5 * 60 * 1000,
    immediate: true
  });

  const config = getConfig();
  const maxPerCell = config.calendarMaxEventsPerCell;

  if (!data?.grid.days || data.grid.days.length === 0) {
    return (
      <div className="rounded-3xl denboard-card px-4 py-4 text-sm denboard-text-secondary">
        Calendar unavailable.
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-3xl denboard-card px-3 py-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
    >
      <div className="grid grid-cols-7 gap-2 text-xs denboard-text-secondary mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2 text-xs">
        {data.grid.days.map((day) => {
          const date = new Date(day.date);
          const dayOfMonth = date.getDate();
          const events = day.events ?? [];
          const visible = events.slice(0, maxPerCell);
          const remaining = events.length - visible.length;
          const isToday = isSameDay(date, new Date());

          return (
            <div
              key={day.date}
              className={`rounded-2xl min-h-[70px] px-2 py-1.5 flex flex-col gap-1 ${
                isToday
                  ? "bg-sandstone/20 border border-sandstone/60"
                  : "denboard-card-nested"
              }`}
            >
              <div className="flex items-center justify-between text-[11px] denboard-text-secondary">
                <span>{dayOfMonth}</span>
                {isToday && (
                  <span className="h-1.5 w-1.5 rounded-full bg-sandstone" />
                )}
              </div>
              <div className="flex flex-col gap-0.5">
                {visible.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded-xl denboard-card-nested px-1 py-[2px] text-[10px] denboard-text-primary truncate"
                  >
                    {evt.title}
                  </div>
                ))}
                {remaining > 0 && (
                  <div className="text-[10px] denboard-text-secondary">+{remaining} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

