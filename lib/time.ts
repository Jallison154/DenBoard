import { DateTime } from "luxon";
import type { CalEvent } from "./types";

export function zoned(ms: number, tz: string) {
  return DateTime.fromMillis(ms, { zone: tz });
}

export function eventStart(e: CalEvent, tz: string) {
  return DateTime.fromISO(e.start, { zone: tz });
}

export function eventEnd(e: CalEvent, tz: string) {
  return DateTime.fromISO(e.end, { zone: tz });
}

/** Does the event touch this calendar day? (end is exclusive) */
export function onDay(e: CalEvent, day: DateTime, tz: string) {
  const s = eventStart(e, tz);
  const en = eventEnd(e, tz);
  const ds = day.startOf("day");
  const de = ds.plus({ days: 1 });
  if (e.allDay) return s < de && en > ds;
  return s < de && (en > ds || +s === +en && s >= ds);
}

export function fmtTime(dt: DateTime, h24: boolean, compact = false) {
  if (h24) return dt.toFormat("HH:mm");
  // "9a", "7:30p" — every character counts in a calendar cell
  if (compact) return (dt.minute === 0 ? dt.toFormat("ha") : dt.toFormat("h:mma")).toLowerCase().replace("m", "");
  return dt.toFormat("h:mm a");
}

export function humanDuration(ms: number) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h < 24) return m ? `${h}h ${m}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function greeting(hour: number) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

/** Parse "22:30" in tz for the given day */
export function atClock(day: DateTime, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return day.set({ hour: h || 0, minute: m || 0, second: 0, millisecond: 0 });
}
