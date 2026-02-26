import { DateTime } from "luxon";
import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { logger } from "./logging";
import { buildFourWeekGrid } from "./time";

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  isOngoing: boolean;
};

export type CalendarPayload = {
  today: {
    allDay: CalendarEvent[];
    timed: CalendarEvent[];
  };
  grid: {
    days: {
      date: string;
      events: CalendarEvent[];
    }[];
  };
  isFallback: boolean;
};

const CALENDAR_CACHE_KEY = "calendar:ics";

type RawEvent = {
  uid?: string;
  summary?: string;
  start?: DateTime;
  end?: DateTime;
  allDay?: boolean;
  location?: string;
};

export async function getCalendar(): Promise<CalendarPayload> {
  const cached = getFromCache<CalendarPayload>(CALENDAR_CACHE_KEY);
  if (cached) return cached;

  const config = getConfig();
  if (!config.gcalIcsUrl) {
    const empty = emptyCalendarPayload(true);
    setInCache(CALENDAR_CACHE_KEY, empty, config.refresh.calendarMs);
    return empty;
  }

  try {
    const res = await fetchWithRetry(config.gcalIcsUrl, {
      headers: {
        Accept: "text/calendar"
      },
      next: { revalidate: 0 }
    });
    const text = await res.text();

    const now = DateTime.now().setZone(config.timezone);
    const todayStart = now.startOf("day");
    const todayEnd = now.endOf("day");

    const rawEvents = parseIcsEvents(text, config.timezone);

    const events: CalendarEvent[] = [];

    rawEvents.forEach((item, idx) => {
      if (!item.start) return;

      const start = item.start;
      const end = item.end ?? start.plus({ hours: 1 });
      const allDay = item.allDay ?? false;

      // Only consider events in a +/- 4 week window around today
      if (end < todayStart.minus({ weeks: 2 }) || start > todayEnd.plus({ weeks: 2 })) {
        return;
      }

      const isOngoing = now >= start && now <= end;

      events.push({
        id: item.uid ?? `evt-${idx}`,
        title: item.summary ?? "Untitled",
        start: start.toISO() ?? start.toISODate() ?? "",
        end: end.toISO() ?? end.toISODate() ?? "",
        allDay,
        location: item.location,
        isOngoing
      });
    });

    const todayAllDay = events.filter(
      (e) => e.allDay && DateTime.fromISO(e.start).hasSame(todayStart, "day")
    );
    const todayTimed = events
      .filter(
        (e) =>
          !e.allDay &&
          DateTime.fromISO(e.start).toISODate() === todayStart.toISODate()
      )
      .sort((a, b) => Number(new Date(a.start)) - Number(new Date(b.start)));

    const gridBase = buildFourWeekGrid(now);
    const gridDays = gridBase.map((cell) => {
      const dateStr = cell.date.toISODate() ?? cell.date.toISO() ?? "";
      const cellEvents = events
        .filter((e) => DateTime.fromISO(e.start).toISODate() === dateStr)
        .sort((a, b) => Number(new Date(a.start)) - Number(new Date(b.start)));

      return {
        date: dateStr,
        events: cellEvents
      };
    });

    const payload: CalendarPayload = {
      today: {
        allDay: todayAllDay,
        timed: todayTimed
      },
      grid: {
        days: gridDays
      },
      isFallback: false
    };

    setInCache(CALENDAR_CACHE_KEY, payload, config.refresh.calendarMs);
    return payload;
  } catch (error) {
    logger.error("Failed to load calendar ICS", { error: String(error) });
    const empty = emptyCalendarPayload(true);
    setInCache(CALENDAR_CACHE_KEY, empty, 60_000);
    return empty;
  }
}

function parseIcsEvents(text: string, defaultTimezone: string): RawEvent[] {
  const lines = text.split(/\r?\n/);

  // Unfold lines (handle ICS continuation lines starting with space or tab)
  const unfolded: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length === 0) continue;
      unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }

  const events: RawEvent[] = [];
  let current: RawEvent | null = null;

  for (const rawLine of unfolded) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (current && current.start) {
        events.push(current);
      }
      current = null;
      continue;
    }
    if (!current) continue;

    const [field, valueRaw = ""] = line.split(":", 2);
    const [name, ...paramParts] = field.split(";");
    const params = paramParts.map((p) => p.toUpperCase());
    const value = valueRaw.trim();

    switch (name.toUpperCase()) {
      case "UID":
        current.uid = value;
        break;
      case "SUMMARY":
        current.summary = value;
        break;
      case "LOCATION":
        current.location = value;
        break;
      case "DTSTART": {
        const { dt, allDay } = parseIcsDate(value, params, defaultTimezone);
        if (dt.isValid) {
          current.start = dt;
          if (allDay) current.allDay = true;
        }
        break;
      }
      case "DTEND": {
        const { dt, allDay } = parseIcsDate(value, params, defaultTimezone);
        if (dt.isValid) {
          current.end = dt;
          if (allDay) current.allDay = true;
        }
        break;
      }
      default:
        break;
    }
  }

  return events;
}

function parseIcsDate(
  value: string,
  params: string[],
  defaultTimezone: string
): { dt: DateTime; allDay: boolean } {
  const isDateOnly = params.some((p) => p.startsWith("VALUE=DATE"));
  const tzParam = params.find((p) => p.startsWith("TZID="));
  const zone = tzParam ? tzParam.split("=").slice(1).join("=") : defaultTimezone;

  let dt: DateTime;

  if (isDateOnly || !value.includes("T")) {
    dt = DateTime.fromFormat(value, "yyyyMMdd", { zone });
  } else if (value.endsWith("Z")) {
    dt = DateTime.fromISO(value, { zone: "utc" }).setZone(zone);
  } else {
    dt =
      DateTime.fromFormat(value, "yyyyMMdd'T'HHmmss", { zone }) ??
      DateTime.fromISO(value, { zone });
  }

  if (!dt.isValid) {
    dt = DateTime.fromISO(value, { zone });
  }

  return { dt, allDay: isDateOnly };
}

function emptyCalendarPayload(isFallback: boolean): CalendarPayload {
  return {
    today: {
      allDay: [],
      timed: []
    },
    grid: {
      days: []
    },
    isFallback
  };
}

