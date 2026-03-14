'use client';

import { useCallback } from "react";
import { motion } from "framer-motion";
import type { CalendarPayload } from "@/lib/calendar";
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

type TodayEventsPanelProps = {
  /** When true, panel stretches from left to center (e.g. portrait calendar) */
  stretchFromLeft?: boolean;
};

export function TodayEventsPanel({ stretchFromLeft }: TodayEventsPanelProps = {}) {
  const fetcher = useCallback(fetchCalendar, []);
  const { data } = usePolling<CalendarPayload>(fetcher, {
    intervalMs: 5 * 60 * 1000,
    immediate: true
  });

  const today = data?.today;

  return (
    <motion.div
      className={`rounded-3xl denboard-card flex flex-col ${stretchFromLeft ? "w-full max-w-none" : "max-w-xl"}`}
      style={{
        padding: "var(--denboard-scale-card-padding)",
        gap: "var(--denboard-scale-gap)"
      }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
    >
      <div
        className="flex items-baseline justify-between"
        style={{ gap: "var(--denboard-scale-space-md)" }}
      >
        <span className="denboard-scale-date uppercase tracking-[0.3em] denboard-text-secondary">
          Today
        </span>
        <span className="denboard-scale-calendar-event denboard-text-secondary">
          All-day and timed events
        </span>
      </div>

      {!today && (
        <div className="denboard-text-secondary denboard-scale-calendar-event">Loading calendar…</div>
      )}

      {today && today.allDay.length === 0 && today.timed.length === 0 && (
        <div className="denboard-text-secondary denboard-scale-calendar-event">Nothing scheduled today.</div>
      )}

      {today && today.allDay.length > 0 && (
        <div className="flex flex-col" style={{ gap: "var(--denboard-scale-gap)" }}>
          <div className="denboard-scale-calendar-event uppercase tracking-[0.2em] denboard-text-secondary">
            All Day
          </div>
          {today.allDay.map((evt, idx) => (
            <div
              key={evt.id}
              className="rounded-2xl denboard-card-nested denboard-scale-calendar-event denboard-text-primary font-medium truncate"
              style={{
                padding: "var(--denboard-scale-space-md) var(--denboard-scale-card-padding)",
                backgroundColor: `${getEventColor(evt, idx)}30`,
                borderLeft: `3px solid ${getEventColor(evt, idx)}`
              }}
              title={evt.title}
            >
              {evt.title}
            </div>
          ))}
        </div>
      )}

      {today && today.timed.length > 0 && (
        <div className="flex flex-col" style={{ gap: "var(--denboard-scale-gap)" }}>
          <div className="denboard-scale-calendar-event uppercase tracking-[0.2em] denboard-text-secondary">
            Scheduled
          </div>
          <div className="flex flex-col" style={{ gap: "var(--denboard-scale-gap)" }}>
            {today.timed.map((evt, idx) => (
              <div
                key={evt.id}
                className="rounded-2xl denboard-card-nested denboard-scale-calendar-event flex items-baseline denboard-text-primary"
                style={{
                  padding: "var(--denboard-scale-space-md) var(--denboard-scale-card-padding)",
                  gap: "var(--denboard-scale-space-md)",
                  backgroundColor: `${getEventColor(evt, idx)}25`,
                  borderLeft: `3px solid ${getEventColor(evt, idx)}`
                }}
                title={evt.title}
              >
                <span className="denboard-text-secondary shrink-0 tabular-nums" style={{ minWidth: "6ch" }}>
                  {formatTime(evt.start)}
                </span>
                <span className="denboard-text-primary truncate min-w-0">{evt.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

const DEFAULT_CALENDAR_COLORS = ["#3B82F6", "#F59E0B", "#22C55E", "#EF4444"];

function getEventColor(evt: { calendarColor?: string }, index: number): string {
  if (evt.calendarColor) return evt.calendarColor;
  return DEFAULT_CALENDAR_COLORS[index % DEFAULT_CALENDAR_COLORS.length];
}

export function FourWeekGrid() {
  const fetcher = useCallback(fetchCalendar, []);
  const { data } = usePolling<CalendarPayload>(fetcher, {
    intervalMs: 5 * 60 * 1000,
    immediate: true
  });

  if (!data?.grid.days || data.grid.days.length === 0) {
    return (
      <div className="rounded-3xl denboard-card px-4 py-4 text-2xl denboard-text-secondary">
        Calendar unavailable.
      </div>
    );
  }

  return (
    <motion.div
      className="rounded-3xl denboard-card"
      style={{ padding: "var(--denboard-scale-card-padding)" }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
    >
      <h3
        className="font-semibold denboard-text-primary uppercase tracking-wide"
        style={{
          fontSize: "var(--denboard-scale-date)",
          marginBottom: "var(--denboard-scale-space-md)"
        }}
      >
        {data.grid.displayMonth ?? new Date().toLocaleString(undefined, { month: "long", year: "numeric" })}
      </h3>
      <div
        className="grid grid-cols-7 denboard-text-secondary"
        style={{
          gap: "var(--denboard-scale-gap)",
          marginBottom: "var(--denboard-scale-gap)",
          fontSize: "calc(var(--denboard-scale-date) * 0.78)"
        }}
      >
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="text-center">
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7"
        style={{ gap: "var(--denboard-scale-gap)" }}
      >
        {data.grid.days.map((day) => (
          <DayCell key={day.date} day={day} />
        ))}
      </div>
    </motion.div>
  );
}

function DayCell({
  day
}: {
  day: {
    date: string;
    dayOfMonth?: number;
    isToday?: boolean;
    events: import("@/lib/calendar").CalendarEvent[];
  };
}) {
  const dayOfMonth =
    day.dayOfMonth ?? new Date(day.date + "T12:00:00").getDate();
  const events = day.events ?? [];
  const dayDate = new Date(day.date + "T12:00:00");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const isToday =
    day.isToday ?? isSameDay(dayDate, new Date());
  const isPast = dayDate < todayStart;

  return (
    <div
      className={`rounded-xl flex flex-col overflow-hidden min-h-[var(--denboard-scale-calendar-cell-height)] ${
        isToday
          ? "bg-sandstone/25 border-2 border-sandstone/70 shadow-[0_0_12px_rgba(209,163,124,0.15)]"
          : isPast
          ? "denboard-card-nested border border-transparent bg-black/20 opacity-75"
          : "denboard-card-nested border border-transparent"
      }`}
    >
      {/* Day number - top left, bolder when today */}
      <div
        className={`shrink-0 px-2 pt-1 text-left font-semibold denboard-text-secondary ${
          isToday ? "font-bold denboard-text-primary" : ""
        }`}
        style={{ fontSize: "calc(var(--denboard-scale-date) * 0.78)" }}
      >
        {dayOfMonth}
      </div>

      {/* Event rows - all events visible, auto-scales to content */}
      <div className="flex flex-col gap-0.5 px-2 py-1 shrink-0">
        {events.map((evt, idx) => (
          <EventRow
            key={evt.id}
            evt={evt}
            color={getEventColor(evt, idx)}
          />
        ))}
      </div>
    </div>
  );
}

function EventRow({
  evt,
  color
}: {
  evt: import("@/lib/calendar").CalendarEvent;
  color: string;
}) {
  if (evt.allDay) {
    return (
      <div
        className="w-full rounded py-0.5 px-1 truncate font-medium denboard-text-primary shrink-0"
        style={{
          backgroundColor: `${color}30`,
          borderLeft: `2px solid ${color}`,
          fontSize: "calc(var(--denboard-scale-calendar-event) * 0.68)"
        }}
        title={evt.title}
      >
        <span className="truncate block">{evt.title}</span>
      </div>
    );
  }
  const time = formatTime(evt.start);
  return (
    <div
      className="flex items-center gap-1 min-w-0 shrink-0 rounded py-0.5 px-1 denboard-text-primary"
      style={{
        backgroundColor: `${color}25`,
        borderLeft: `2px solid ${color}`,
        fontSize: "calc(var(--denboard-scale-calendar-event) * 0.68)"
      }}
      title={evt.title}
    >
      <span className="text-sandstone/80 shrink-0 text-[0.65em]">•</span>
      <span className="truncate flex-1 min-w-0" style={{ fontSize: "inherit" }}>{evt.title}</span>
      <span
        className="denboard-text-secondary/90 shrink-0 tabular-nums"
        style={{ fontSize: "calc(var(--denboard-scale-status) * 0.82)" }}
      >
        {time}
      </span>
    </div>
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

