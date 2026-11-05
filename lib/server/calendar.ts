import ICAL from "ical.js";
import { DateTime } from "luxon";
import type { CalEvent, CalendarSlice } from "../types";
import type { DenBoardConfig } from "./config";

/**
 * ICS loading with full RFC 5545 recurrence support (BYDAY, EXDATE, moved/cancelled
 * instances via RECURRENCE-ID) — V1's hand-rolled parser only handled simple FREQ rules.
 */

type Time = InstanceType<typeof ICAL.Time>;

function toIso(t: Time, propTzid: string | null, fallbackTz: string): string {
  if (t.isDate) {
    return DateTime.fromObject({ year: t.year, month: t.month, day: t.day }).toISODate()!;
  }
  const zoneId = t.zone?.tzid;
  if (zoneId === "UTC" || zoneId === "Z") return t.toJSDate().toISOString();
  const tz = (zoneId && zoneId !== "floating" ? zoneId : null) ?? propTzid ?? fallbackTz;
  const dt = DateTime.fromObject(
    { year: t.year, month: t.month, day: t.day, hour: t.hour, minute: t.minute, second: t.second },
    { zone: tz }
  );
  // Non-IANA tzids (Outlook "Mountain Standard Time") fall back to ical.js' own VTIMEZONE math
  return dt.isValid ? dt.toISO()! : t.toJSDate().toISOString();
}

function propTzid(comp: InstanceType<typeof ICAL.Component>, name: string): string | null {
  const p = comp.getFirstProperty(name);
  const v = p?.getParameter("tzid");
  return typeof v === "string" ? v : null;
}

export function parseIcs(
  text: string,
  source: { id: string; color: string },
  rangeStart: DateTime,
  rangeEnd: DateTime,
  tz: string
): CalEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    try {
      ICAL.TimezoneService.register(vtz);
    } catch {
      /* ignore malformed tz blocks */
    }
  }

  const masters = new Map<string, InstanceType<typeof ICAL.Event>>();
  const orphans: InstanceType<typeof ICAL.Event>[] = [];
  const exceptions: InstanceType<typeof ICAL.Event>[] = [];

  for (const vevent of root.getAllSubcomponents("vevent")) {
    const ev = new ICAL.Event(vevent);
    if (ev.isRecurrenceException()) exceptions.push(ev);
    else if (ev.uid && !masters.has(ev.uid)) masters.set(ev.uid, ev);
    else orphans.push(ev);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else orphans.push(ex);
  }

  const startMs = rangeStart.toMillis();
  const endMs = rangeEnd.toMillis();
  const out: CalEvent[] = [];

  const push = (
    item: InstanceType<typeof ICAL.Event>,
    s: Time,
    e: Time | null,
    key: string
  ) => {
    const status = String(item.component.getFirstPropertyValue("status") ?? "").toUpperCase();
    if (status === "CANCELLED") return;
    const sTz = propTzid(item.component, "dtstart");
    const eTz = propTzid(item.component, "dtend") ?? sTz;
    const allDay = s.isDate;
    const start = toIso(s, sTz, tz);
    let end: string;
    if (e) end = toIso(e, eTz, tz);
    else if (allDay) end = DateTime.fromISO(start).plus({ days: 1 }).toISODate()!;
    else end = start;

    const sMs = DateTime.fromISO(start, { zone: tz }).toMillis();
    const eMs = DateTime.fromISO(end, { zone: tz }).toMillis();
    if (eMs < startMs || sMs > endMs) return;

    out.push({
      id: `${source.id}:${key}`,
      title: (item.summary || "(No title)").trim(),
      start,
      end,
      allDay,
      location: item.location || undefined,
      calendar: source.id,
      color: source.color
    });
  };

  for (const ev of masters.values()) {
    if (!ev.startDate) continue;
    if (!ev.isRecurring()) {
      push(ev, ev.startDate, ev.endDate, ev.uid);
      continue;
    }
    const it = ev.iterator();
    let next: Time | null;
    let guard = 0;
    while ((next = it.next()) && guard++ < 20000) {
      if (next.toJSDate().getTime() > endMs + 86400000) break;
      const det = ev.getOccurrenceDetails(next);
      const dur = det.endDate.toJSDate().getTime() - det.startDate.toJSDate().getTime();
      if (det.startDate.toJSDate().getTime() + dur < startMs - 86400000) continue;
      push(det.item, det.startDate, det.endDate, `${ev.uid}:${next.toString()}`);
    }
  }
  for (const ev of orphans) {
    if (ev.startDate) push(ev, ev.startDate, ev.endDate, `${ev.uid}:${ev.startDate.toString()}`);
  }
  return out;
}

export async function loadCalendars(config: DenBoardConfig): Promise<CalendarSlice> {
  const tz = config.location.timezone;
  const now = DateTime.now().setZone(tz);
  const rangeStart = now.startOf("month").minus({ weeks: 1 });
  const rangeEnd = now.plus({ weeks: 8 });
  const sources = config.calendars.filter((c) => c.enabled !== false && c.url);

  const errors: string[] = [];
  const results = await Promise.all(
    sources.map(async (src) => {
      try {
        const url = src.url.replace(/^webcal:\/\//i, "https://");
        const res = await fetch(url, {
          headers: { Accept: "text/calendar" },
          signal: AbortSignal.timeout(15000),
          cache: "no-store"
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseIcs(await res.text(), src, rangeStart, rangeEnd, tz);
      } catch (err) {
        errors.push(`${src.name}: ${String(err)}`);
        console.warn(`[denboard] calendar "${src.name}" failed:`, String(err));
        return [];
      }
    })
  );

  // The same event shared to two family calendars shows once
  const seen = new Set<string>();
  const events = results
    .flat()
    .filter((e) => {
      const k = `${e.title.toLowerCase()}|${e.start}|${e.end}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.allDay ? -1 : 1));

  return {
    events,
    calendars: sources.map((s) => ({ id: s.id, name: s.name, color: s.color })),
    updatedAt: Date.now(),
    error: errors.length ? errors.join("; ") : undefined
  };
}
