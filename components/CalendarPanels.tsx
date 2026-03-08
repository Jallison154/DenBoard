'use client';

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { CalendarPayload } from "@/lib/calendar";
import { getConfig } from "@/lib/config";
import { usePolling } from "./hooks";

async function fetchCalendar(): Promise<CalendarPayload> {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
  const now = new Date().toISOString();
  const params = new URLSearchParams();
  if (tz) params.set("tz", tz);
  params.set("now", now);
  const url = `/api/calendar?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
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
        <span className="text-xl uppercase tracking-[0.3em] denboard-text-secondary">
          Today
        </span>
        <span className="text-[22px] denboard-text-secondary">
          All-day and timed events
        </span>
      </div>

      {!today && (
        <div className="denboard-text-secondary text-2xl">Loading calendar…</div>
      )}

      {today && today.allDay.length === 0 && today.timed.length === 0 && (
        <div className="denboard-text-secondary text-2xl">Nothing scheduled today.</div>
      )}

      {today && today.allDay.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[22px] uppercase tracking-[0.2em] denboard-text-secondary">
            All Day
          </div>
          {today.allDay.map((evt) => (
            <div
              key={evt.id}
              className="rounded-2xl denboard-card-nested px-4 py-3 text-2xl denboard-text-primary"
            >
              {evt.title}
            </div>
          ))}
        </div>
      )}

      {today && today.timed.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="text-[22px] uppercase tracking-[0.2em] denboard-text-secondary">
            Scheduled
          </div>
          <div className="flex flex-col gap-3">
            {today.timed.map((evt) => (
              <div
                key={evt.id}
                className="rounded-2xl denboard-card-nested px-4 py-3 text-2xl flex items-baseline gap-4"
              >
                <span className="text-[22px] denboard-text-secondary w-32 shrink-0">
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
      <div className="rounded-3xl denboard-card px-4 py-4 text-2xl denboard-text-secondary">
        Calendar unavailable.
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-3xl denboard-card px-4 py-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
    >
      <h3 className="text-2xl md:text-3xl font-semibold denboard-text-primary mb-4 uppercase tracking-wide">
        {data.grid.displayMonth ?? new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}
      </h3>
      <div className="grid grid-cols-7 gap-3 text-xl denboard-text-secondary mb-3">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-3 text-xl">
        {data.grid.days.map((day) => {
          const dayOfMonth = day.dayOfMonth ?? new Date(day.date + "T12:00:00").getDate();
          const events = day.events ?? [];
          const visible = events.slice(0, maxPerCell);
          const remaining = events.length - visible.length;
          const isToday = day.isToday ?? isSameDay(new Date(day.date + "T12:00:00"), new Date());

          return (
            <div
              key={day.date}
              className={`rounded-2xl min-h-[120px] px-3 py-2 flex flex-col gap-2 ${
                isToday
                  ? "bg-sandstone/20 border border-sandstone/60"
                  : "denboard-card-nested"
              }`}
            >
              <div className="flex items-center justify-between text-[22px] denboard-text-secondary">
                <span>{dayOfMonth}</span>
                {isToday && (
                  <span className="h-3 w-3 rounded-full bg-sandstone" />
                )}
              </div>
              <div className="flex flex-col gap-1">
                {visible.map((evt) => (
                  <div
                    key={evt.id}
                    className="rounded-xl denboard-card-nested px-2 py-1 text-[20px] denboard-text-primary flex items-center gap-2 min-w-0"
                  >
                    {evt.allDay ? (
                      <span className="truncate">{evt.title}</span>
                    ) : (
                      <>
                        <span className="denboard-text-secondary text-[18px] shrink-0">
                          {formatTime(evt.start)}
                        </span>
                        <span className="truncate">{evt.title}</span>
                      </>
                    )}
                  </div>
                ))}
                {remaining > 0 && (
                  <div className="text-[20px] denboard-text-secondary">+{remaining} more</div>
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

