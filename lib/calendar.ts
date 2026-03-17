import { createHash } from "crypto";
import { DateTime, Duration } from "luxon";
import { getConfig } from "./config";
import { getRandomCalendarColor } from "./calendarColors";
import { loadSettings } from "./settings";
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
  /** Hex color from calendar source (e.g. #3B82F6) */
  calendarColor?: string;
};

export type CalendarPayload = {
  today: {
    allDay: CalendarEvent[];
    timed: CalendarEvent[];
  };
  grid: {
    displayMonth: string;
    days: {
      date: string;
      dayOfMonth: number;
      isToday: boolean;
      events: CalendarEvent[];
    }[];
  };
  isFallback: boolean;
};

const CALENDAR_CACHE_KEY_PREFIX = "calendar:ics:";

type RawEvent = {
  uid?: string;
  summary?: string;
  start?: DateTime;
  end?: DateTime;
  allDay?: boolean;
  location?: string;
  rrule?: string;
  exdates?: DateTime[];
};

export type CalendarOptions = {
  /** Client timezone (e.g. from Intl) – overrides server config */
  timezone?: string;
  /** Client "now" as ISO string – overrides server time */
  nowOverride?: string;
};

export async function getCalendar(
  options?: CalendarOptions
): Promise<CalendarPayload> {
  const config = getConfig();
  const settings = await loadSettings();
  const timezone =
    options?.timezone ??
    settings.location?.timezone ??
    config.timezone;
  const refreshMs = (settings.calendar?.refreshMinutes ?? 5) * 60 * 1000;

  // Parse client "now" as UTC, then convert to user's zone (client sends ISO with Z)
  let now = options?.nowOverride
    ? DateTime.fromISO(options.nowOverride, { zone: "utc" }).setZone(timezone)
    : DateTime.now().setZone(timezone);
  if (!now.isValid) {
    now = DateTime.now().setZone(timezone);
  }

  // Calendar sources: from admin settings (enabled with URL) or fallback to env
  type CalSource = { url: string; color: string };
  const calSources: CalSource[] = [];
  const fromSettings = (settings.calendar?.calendars ?? [])
    .filter((c) => c.enabled && c.icsUrl?.trim());
  if (fromSettings.length > 0) {
    calSources.push(
      ...fromSettings.map((c) => ({
        url: c.icsUrl.trim(),
        color: c.color?.trim() || getRandomCalendarColor()
      }))
    );
  } else if (config.gcalIcsUrl) {
    calSources.push({ url: config.gcalIcsUrl, color: getRandomCalendarColor() });
  }

  const icsUrls = calSources.map((c) => c.url);
  const cacheKey =
    icsUrls.length === 0
      ? CALENDAR_CACHE_KEY_PREFIX + "empty"
      : CALENDAR_CACHE_KEY_PREFIX +
        createHash("md5")
          .update([...icsUrls].sort().join("|") + ":" + timezone)
          .digest("hex")
          .slice(0, 16);

  if (!options?.timezone && !options?.nowOverride) {
    const cached = getFromCache<CalendarPayload>(cacheKey);
    if (cached) return cached;
  }

  if (icsUrls.length === 0) {
    const empty = emptyCalendarPayload(true, timezone);
    if (!options?.timezone && !options?.nowOverride) {
      setInCache(cacheKey, empty, refreshMs);
    }
    return empty;
  }

  try {
    const todayStart = now.startOf("day");
    const gridBase = buildFourWeekGrid(now);
    const gridStart = gridBase[0]?.date.startOf("day") ?? todayStart.minus({ weeks: 2 });
    const gridEnd = gridBase[gridBase.length - 1]?.date.endOf("day") ?? todayStart.plus({ weeks: 2 });

    // Dedup by (uid + start) so the same instance from multiple sources
    // does not appear twice, but recurring instances are still unique.
    const seenInstances = new Set<string>();
    const events: CalendarEvent[] = [];
    let globalIdx = 0;
    for (const { url, color } of calSources) {
      try {
        const res = await fetchWithRetry(url, {
          headers: { Accept: "text/calendar" },
          next: { revalidate: 0 }
        });
        const text = await res.text();
        const rawEvents = parseIcsEvents(text, timezone);
        for (const item of rawEvents) {
          if (!item.start) continue;
          const baseUid = item.uid ?? `evt-${globalIdx}`;
          globalIdx += 1;

          // Expand recurrences into instances within the grid window.
          const instances = expandRecurringInstances(
            item,
            gridStart,
            gridEnd
          );

          for (const inst of instances) {
            const { start, end, allDay } = inst;
            if (end < gridStart || start > gridEnd) continue;

            const instanceKey = `${baseUid}:${start.toISO() ?? start.toISODate() ?? ""}`;
            if (seenInstances.has(instanceKey)) continue;
            seenInstances.add(instanceKey);

            events.push({
              id: instanceKey,
              title: item.summary ?? "Untitled",
              start: start.toISO() ?? start.toISODate() ?? "",
              end: end.toISO() ?? end.toISODate() ?? "",
              allDay,
              location: item.location,
              isOngoing: now >= start && now <= end,
              calendarColor: color
            });
          }
        }
      } catch (err) {
        logger.error("Failed to fetch calendar ICS", { url, error: String(err) });
      }
    }

    // Final defensive dedupe: if multiple calendars produce the exact same
    // visible event (same title, start instant, and all-day flag), keep the
    // first and drop later ones so we don't render obvious duplicates.
    if (events.length > 0) {
      const byVisibleKey = new Map<string, CalendarEvent>();
      for (const evt of events) {
        const key = `${evt.title}::${evt.start}::${evt.allDay ? "A" : "T"}`;
        if (!byVisibleKey.has(key)) {
          byVisibleKey.set(key, evt);
        }
      }
      events.length = 0;
      events.push(...byVisibleKey.values());
    }

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

    const dateStrToEvents = new Map<string, CalendarEvent[]>();
    for (const cell of gridBase) {
      const dateStr = cell.date.toISODate() ?? "";
      if (!dateStr) continue;
      dateStrToEvents.set(dateStr, []);
    }
    for (const evt of events) {
      const evtStart = DateTime.fromISO(evt.start);
      const evtEnd = DateTime.fromISO(evt.end);
      if (!evtStart.isValid) continue;
      const startDate = evtStart.toISODate() ?? "";
      const endDate = evtEnd.isValid ? (evtEnd.toISODate() ?? startDate) : startDate;
      for (const cell of gridBase) {
        const dateStr = cell.date.toISODate() ?? "";
        if (dateStr < startDate) continue;
        if (evt.allDay) {
          if (dateStr >= endDate) continue;
        } else {
          if (dateStr > endDate) continue;
        }
        const arr = dateStrToEvents.get(dateStr);
        if (arr) arr.push(evt);
      }
    }
    const gridDays = gridBase.map((cell) => {
      const dateStr = cell.date.toISODate() ?? cell.date.toISO() ?? "";
      const cellEvents = (dateStrToEvents.get(dateStr) ?? []).sort((a, b) => {
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return Number(new Date(a.start)) - Number(new Date(b.start));
      });
      return {
        date: dateStr,
        dayOfMonth: cell.date.day,
        isToday: cell.isToday,
        events: cellEvents
      };
    });

    const displayMonth = now.toFormat("MMMM yyyy");
    const payload: CalendarPayload = {
      today: { allDay: todayAllDay, timed: todayTimed },
      grid: { displayMonth, days: gridDays },
      isFallback: false
    };

    setInCache(cacheKey, payload, refreshMs);
    return payload;
  } catch (error) {
    logger.error("Failed to load calendar ICS", { error: String(error) });
    const empty = emptyCalendarPayload(true);
    setInCache(cacheKey, empty, 60_000);
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
      case "DURATION": {
        if (current?.start) {
          const dur = Duration.fromISO(value);
          if (dur.isValid) {
            current.end = current.start.plus(dur);
          }
        }
        break;
      }
      case "RRULE":
        current.rrule = value;
        break;
      case "EXDATE": {
        // EXDATE can contain a comma-separated list of dates
        const parts = value.split(",");
        const ex: DateTime[] = current.exdates ?? [];
        for (const part of parts) {
          const { dt } = parseIcsDate(part.trim(), params, defaultTimezone);
          if (dt.isValid) ex.push(dt);
        }
        current.exdates = ex;
        break;
      }
      default:
        break;
    }
  }

  return events;
}

type RecurrenceInstance = {
  start: DateTime;
  end: DateTime;
  allDay: boolean;
};

/**
 * Expand a single ICS event into concrete instances within [windowStart, windowEnd].
 * Supports simple FREQ=DAILY/WEEKLY/MONTHLY with INTERVAL, UNTIL, COUNT.
 * Complex RRULE clauses (BYxxx) are intentionally not fully implemented to keep this
 * lightweight; those events will still show their base instance if in range.
 */
function expandRecurringInstances(
  item: RawEvent,
  windowStart: DateTime,
  windowEnd: DateTime
): RecurrenceInstance[] {
  const start = item.start!;
  const baseEnd =
    item.end && item.end.isValid
      ? item.end
      : start.plus({ hours: 1 });
  const allDay = item.allDay ?? false;

  if (!item.rrule) {
    return [{ start, end: baseEnd, allDay }];
  }

  const ruleParts = item.rrule.split(";").map((p) => p.trim());
  const rule: Record<string, string> = {};
  for (const part of ruleParts) {
    const [k, v] = part.split("=", 2);
    if (k && v) {
      rule[k.toUpperCase()] = v;
    }
  }

  const freq = rule["FREQ"] ?? "DAILY";
  const interval = Number(rule["INTERVAL"] ?? "1") || 1;

  let until: DateTime | null = null;
  if (rule["UNTIL"]) {
    // Ensure we always pass a concrete string zone name into parseIcsDate
    const zoneForUntil =
      start.zoneName || windowStart.zoneName || "UTC";
    const { dt } = parseIcsDate(rule["UNTIL"], [], zoneForUntil);
    if (dt.isValid) {
      until = dt.endOf("day");
    }
  }
  const count = rule["COUNT"] ? Number(rule["COUNT"]) || 0 : 0;

  const exdates = (item.exdates ?? []).filter((d) => d.isValid);

  const instances: RecurrenceInstance[] = [];
  let currentStart = start;
  let currentEnd = baseEnd;
  let seen = 0;

  // Hard upper bound to avoid pathological rules
  const MAX_OCCURRENCES = 500;

  while (currentStart <= windowEnd && seen < MAX_OCCURRENCES) {
    if (until && currentStart > until) break;
    if (count && seen >= count) break;

    const inWindow =
      currentEnd >= windowStart && currentStart <= windowEnd;

    const isExcluded = exdates.some((d) =>
      d.hasSame(currentStart, "day")
    );

    if (inWindow && !isExcluded) {
      instances.push({
        start: currentStart,
        end: currentEnd,
        allDay
      });
    }

    seen += 1;

    // Advance according to FREQ
    switch (freq) {
      case "WEEKLY":
        currentStart = currentStart.plus({ weeks: interval });
        currentEnd = currentEnd.plus({ weeks: interval });
        break;
      case "MONTHLY":
        currentStart = currentStart.plus({ months: interval });
        currentEnd = currentEnd.plus({ months: interval });
        break;
      case "YEARLY":
        currentStart = currentStart.plus({ years: interval });
        currentEnd = currentEnd.plus({ years: interval });
        break;
      case "DAILY":
      default:
        currentStart = currentStart.plus({ days: interval });
        currentEnd = currentEnd.plus({ days: interval });
        break;
    }
  }

  // If no instances were generated (e.g. unsupported rule), fall back to base event
  if (instances.length === 0) {
    return [{ start, end: baseEnd, allDay }];
  }
  return instances;
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
    // Date-only without VALUE=DATE = no explicit time → treat as start of day (timed event)
    if (!isDateOnly && dt.isValid) {
      dt = dt.startOf("day");
    }
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

/** Extract color and name from VCALENDAR-level properties. Google Calendar does not include color. */
export function parseIcsMetadata(text: string): { color?: string; name?: string } {
  const result: { color?: string; name?: string } = {};
  const lines = text.split(/\r?\n/);
  const unfolded: string[] = [];
  for (const line of lines) {
    if (!line) continue;
    if (line.startsWith(" ") || line.startsWith("\t")) {
      if (unfolded.length > 0) unfolded[unfolded.length - 1] += line.slice(1);
    } else {
      unfolded.push(line);
    }
  }
  for (const rawLine of unfolded) {
    const line = rawLine.trim();
    if (line === "BEGIN:VEVENT") break;
    const [field, value = ""] = line.split(":", 2);
    const name = field.split(";")[0].toUpperCase();
    const v = value.trim();
    if (name === "COLOR" || name === "X-APPLE-CALENDAR-COLOR") {
      if (v && !result.color) result.color = v.startsWith("#") ? v : `#${v}`;
    } else if (name === "X-WR-CALNAME" && v && !result.name) {
      result.name = v;
    }
  }
  return result;
}

function emptyCalendarPayload(
  isFallback: boolean,
  timezone?: string
): CalendarPayload {
  const tz = timezone ?? getConfig().timezone;
  const now = DateTime.now().setZone(tz);
  return {
    today: {
      allDay: [],
      timed: []
    },
    grid: {
      displayMonth: now.toFormat("MMMM yyyy"),
      days: []
    },
    isFallback
  };
}

export type CalendarDebugPayload = {
  icsUrls: string[];
  timezone: string;
  fetchResults: { url: string; ok: boolean; eventCount?: number; error?: string }[];
  todayCount: number;
  gridEventCount: number;
  payload: CalendarPayload;
  fetchedAt: string;
};

export async function getCalendarDebug(): Promise<CalendarDebugPayload> {
  const config = getConfig();
  const settings = await loadSettings();
  const timezone =
    settings.location?.timezone ?? config.timezone;

  const icsUrls: string[] = [];
  const fromSettings = (settings.calendar?.calendars ?? [])
    .filter((c) => c.enabled && c.icsUrl?.trim())
    .map((c) => c.icsUrl.trim());
  if (fromSettings.length > 0) {
    icsUrls.push(...fromSettings);
  } else if (config.gcalIcsUrl) {
    icsUrls.push(config.gcalIcsUrl);
  }

  const fetchResults: CalendarDebugPayload["fetchResults"] = [];

  for (const url of icsUrls) {
    try {
      const res = await fetchWithRetry(url, {
        headers: { Accept: "text/calendar" },
        next: { revalidate: 0 }
      });
      const text = await res.text();
      const events = parseIcsEvents(text, timezone);
      fetchResults.push({ url, ok: true, eventCount: events.length });
    } catch (err) {
      fetchResults.push({
        url,
        ok: false,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  const payload = await getCalendar({ timezone });
  const todayCount =
    payload.today.allDay.length + payload.today.timed.length;
  const gridEventCount = payload.grid.days.reduce(
    (sum, d) => sum + d.events.length,
    0
  );

  return {
    icsUrls,
    timezone,
    fetchResults,
    todayCount,
    gridEventCount,
    payload,
    fetchedAt: new Date().toISOString()
  };
}
