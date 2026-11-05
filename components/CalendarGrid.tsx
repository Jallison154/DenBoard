"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import type { CalEvent } from "@/lib/types";
import { eventEnd, eventStart, fmtTime, onDay } from "@/lib/time";

type Bar = { e: CalEvent; col: number; span: number; lane: number; contL: boolean; contR: boolean };

/**
 * Rolling (current week + N) or month grid. Multi-day all-day events draw as continuous
 * bars across the week (like "California trip"), single-day items list in each cell.
 */
export function CalendarGrid({
  events,
  now,
  tz,
  mode,
  weeks,
  weekStartsOn,
  h24,
  maxPerCell = 4,
  maxLanes = 3,
  hideDetails = false
}: {
  events: CalEvent[];
  now: DateTime;
  tz: string;
  mode: "rolling" | "month";
  weeks: number;
  weekStartsOn: 0 | 1;
  h24: boolean;
  maxPerCell?: number;
  maxLanes?: number;
  hideDetails?: boolean;
}) {
  const today = now.startOf("day");
  const dayKey = today.toISODate();

  const { gridStart, rows, title } = useMemo(() => {
    const anchor = mode === "month" ? today.startOf("month") : today;
    // luxon weekday: 1=Mon..7=Sun
    const offset = weekStartsOn === 0 ? anchor.weekday % 7 : anchor.weekday - 1;
    const gridStart = anchor.minus({ days: offset });
    let rows = weeks;
    if (mode === "month") {
      const end = today.endOf("month");
      rows = Math.ceil((end.diff(gridStart, "days").days + 1) / 7);
    }
    const gridEnd = gridStart.plus({ weeks: rows }).minus({ days: 1 });
    const title =
      gridStart.month === gridEnd.month || mode === "month"
        ? today.toFormat("LLLL yyyy")
        : `${gridStart.plus({ days: 6 }).toFormat("LLLL")} – ${gridEnd.toFormat("LLLL yyyy")}`;
    return { gridStart, rows, title };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayKey, mode, weeks, weekStartsOn]);

  const weekData = useMemo(() => {
    return Array.from({ length: rows }, (_, w) => {
      const ws = gridStart.plus({ weeks: w });
      const we = ws.plus({ days: 7 });
      const days = Array.from({ length: 7 }, (_, d) => ws.plus({ days: d }));

      // Multi-day all-day events → lane-packed bars
      const multi = events
        .filter((e) => e.allDay && eventEnd(e, tz).diff(eventStart(e, tz), "days").days > 1.5)
        .filter((e) => eventStart(e, tz) < we && eventEnd(e, tz) > ws)
        .sort((a, b) => (a.start < b.start ? -1 : 1));
      const lanes: number[] = []; // last occupied column per lane
      const bars: Bar[] = [];
      const hidden = new Array(7).fill(0);
      for (const e of multi) {
        const s = eventStart(e, tz);
        const en = eventEnd(e, tz);
        const col = Math.max(0, Math.round(s.diff(ws, "days").days));
        const endCol = Math.min(7, Math.round(en.diff(ws, "days").days));
        let lane = lanes.findIndex((last) => last < col);
        if (lane === -1) {
          lane = lanes.length;
          lanes.push(-1);
        }
        lanes[lane] = endCol - 1;
        if (lane >= maxLanes) {
          for (let c = col; c < endCol; c++) hidden[c]++;
          continue;
        }
        bars.push({ e, col, span: endCol - col, lane, contL: s < ws, contR: en > we });
      }
      const laneCount = Math.min(maxLanes, lanes.length);

      const cells = days.map((day, i) => {
        const items = events.filter((e) => onDay(e, day, tz) && !multi.includes(e));
        const shown = items.slice(0, maxPerCell);
        return { day, items: shown, more: items.length - shown.length + hidden[i] };
      });
      return { ws, bars, laneCount, cells };
    });
  }, [events, gridStart, rows, tz, maxPerCell, maxLanes]);

  const dows = Array.from({ length: 7 }, (_, i) => gridStart.plus({ days: i }).toFormat("ccc"));

  return (
    <div className="cal">
      <div className="cal-head">
        <div className="cal-title">{title}</div>
      </div>
      <div className="cal-dows">
        {dows.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="cal-weeks">
        {weekData.map(({ ws, bars, laneCount, cells }) => (
          <div key={ws.toISODate()} className="cal-week" style={{ flex: `${1 + laneCount * 0.3} 1 0`, gridTemplateRows: laneCount ? `auto repeat(${laneCount}, var(--bar-h)) minmax(0, 1fr)` : "auto minmax(0, 1fr)" }}>
            {cells.map(({ day }, i) => {
              const isToday = +day === +today;
              const past = day < today;
              const otherMonth = mode === "month" && day.month !== today.month;
              return (
                <div
                  key={`bg${i}`}
                  className={`cal-cell ${isToday ? "today" : ""} ${past ? "past" : ""} ${otherMonth ? "other" : ""} ${day.weekday >= 6 ? "weekend" : ""}`}
                  style={{ gridColumn: i + 1, gridRow: "1 / -1" }}
                />
              );
            })}
            {cells.map(({ day }, i) => (
              <div key={`n${i}`} className={`cal-num ${+day === +today ? "today" : ""}`} style={{ gridColumn: i + 1, gridRow: 1 }}>
                {day.day === 1 && <span className="cal-month">{day.toFormat("LLL")}</span>}
                {day.day}
              </div>
            ))}
            {!hideDetails &&
              bars.map((b) => (
                <div
                  key={`${b.e.id}-${ws.toISODate()}`}
                  className={`cal-bar ${b.contL ? "cont-l" : ""} ${b.contR ? "cont-r" : ""}`}
                  style={{ gridColumn: `${b.col + 1} / span ${b.span}`, gridRow: b.lane + 2, ["--c" as string]: b.e.color }}
                >
                  {b.e.title}
                </div>
              ))}
            {cells.map(({ day, items, more }, i) => (
              <FitList
                key={`c${i}-${items.map((e) => e.id).join("|")}-${more}`}
                className={`cal-items ${day < today ? "past" : ""}`}
                style={{ gridColumn: i + 1, gridRow: laneCount + 2 }}
                extra={more}
                hideDetails={hideDetails}
              >
                {items.map((e) =>
                  e.allDay ? (
                    <div key={e.id} className="cal-chip allday" style={{ ["--c" as string]: e.color }}>
                      {e.title}
                    </div>
                  ) : (
                    <div key={e.id} className="cal-chip timed" style={{ ["--c" as string]: e.color }}>
                      <span className="cal-dot" />
                      <span className="cal-chip-time">{fmtTime(eventStart(e, tz), h24, true)}</span>
                      <span className="cal-chip-title">{e.title}</span>
                    </div>
                  )
                )}
              </FitList>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Shows as many children as physically fit in the cell, then an accurate "+N more".
 * Measures before paint so nothing half-clipped ever shows on the TV.
 */
function FitList({
  children,
  className,
  style,
  extra,
  hideDetails
}: {
  children: React.ReactNode[];
  className: string;
  style: React.CSSProperties;
  extra: number;
  hideDetails: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  const lastH = useRef(0);

  useLayoutEffect(() => {
    if (fit !== null) return;
    const el = ref.current;
    if (!el) return;
    const H = el.clientHeight;
    lastH.current = H;
    const kids = Array.from(el.children) as HTMLElement[];
    let n = 0;
    for (const k of kids) {
      if (k.offsetTop + k.offsetHeight <= H + 1) n++;
      else break;
    }
    if (n < kids.length || extra > 0) {
      // leave a line for "+N more"
      while (n > 0 && kids[n - 1].offsetTop + kids[n - 1].offsetHeight > H - 19) n--;
    }
    setFit(n);
  }, [fit, extra]);  // re-measure only when reset; items changing remounts via key

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (Math.abs(el.clientHeight - lastH.current) > 2) setFit(null);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const total = children.length;
  const shown = fit === null ? total : fit;
  const more = total - shown + extra;
  if (hideDetails) {
    return <div className={className} style={style}>{total + extra > 0 && <div className="cal-busy" />}</div>;
  }
  return (
    <div ref={ref} className={className} style={style}>
      {children.slice(0, shown)}
      {fit !== null && more > 0 && <div className="cal-more">+{more} more</div>}
    </div>
  );
}
