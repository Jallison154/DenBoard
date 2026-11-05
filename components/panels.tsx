"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import type { CalEvent, FunItem, HaEntity, RadarSlice, Snapshot, WeatherSlice } from "@/lib/types";
import { eventEnd, eventStart, fmtTime, humanDuration, onDay } from "@/lib/time";
import { WeatherIcon } from "./WeatherIcon";
import { Icon } from "./Icon";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const deg = "°";

/* ───────────────────────────── Clock ───────────────────────────── */

export function Clock({ now, h24, size = 220 }: { now: DateTime; h24: boolean; size?: number }) {
  return (
    <div className="clock">
      <div className="clock-time" style={{ fontSize: size }}>
        {h24 ? now.toFormat("HH:mm") : now.toFormat("h:mm")}
        {!h24 && <span className="clock-ampm" style={{ fontSize: size * 0.2 }}>{now.toFormat("a")}</span>}
      </div>
      <div className="clock-date" style={{ fontSize: Math.max(26, Math.round(size * 0.18)) }}>
        {now.toFormat("cccc, LLLL d")}
      </div>
    </div>
  );
}

/* ─────────────────────────── Weather ──────────────────────────── */

export function WeatherNow({ weather, size = 120 }: { weather: WeatherSlice | null; size?: number }) {
  if (!weather) return <div className="weather-now" />;
  const c = weather.current;
  const today = weather.daily[0];
  return (
    <div className="weather-now">
      <div className="wn-main">
        <WeatherIcon kind={c.kind} isDay={c.isDay} size={size * 0.85} />
        <div className="wn-temp" style={{ fontSize: size }}>
          {c.temp}
          {deg}
        </div>
      </div>
      <div className="wn-sub" style={{ fontSize: Math.max(24, size * 0.23) }}>
        {c.label} · {today.hi}
        {deg} / {today.lo}
        {deg}
      </div>
    </div>
  );
}

/** A quiet row of days — no bars or boxes. */
export function WeekForecast({ weather, days = 6 }: { weather: WeatherSlice | null; days?: number }) {
  if (!weather) return null;
  return (
    <div className="week">
      {weather.daily.slice(1, 1 + days).map((d) => (
        <div key={d.date} className="week-day">
          <div className="week-name">{DateTime.fromISO(d.date).toFormat("ccc")}</div>
          <WeatherIcon kind={d.kind} size={56} animate={false} />
          <div className="week-temps">
            {d.hi}
            {deg}
            <span>
              {d.lo}
              {deg}
            </span>
          </div>
          {d.pop >= 40 && <div className="week-pop">{d.pop}%</div>}
        </div>
      ))}
    </div>
  );
}

/* ──────────────────────────── Radar ───────────────────────────── */

const Z = 7;
function project(lat: number, lon: number) {
  const n = 256 * 2 ** Z;
  const x = ((lon + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";

export function Radar({ radar, lat, lon, width, height, scale = 1.6 }: { radar: RadarSlice; lat: number; lon: number; width: number; height: number; scale?: number }) {
  const [frame, setFrame] = useState(radar.frames.length - 1);
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % (radar.frames.length + 3); // linger on the newest frame
      setFrame(Math.min(i, radar.frames.length - 1));
    }, 650);
    return () => clearInterval(t);
  }, [radar.frames.length]);

  const tiles = useMemo(() => {
    const { x, y } = project(lat, lon);
    const halfW = width / 2 / scale;
    const halfH = height / 2 / scale;
    const out: { tx: number; ty: number; left: number; top: number }[] = [];
    for (let tx = Math.floor((x - halfW) / 256); tx <= Math.floor((x + halfW) / 256); tx++)
      for (let ty = Math.floor((y - halfH) / 256); ty <= Math.floor((y + halfH) / 256); ty++)
        out.push({ tx, ty, left: (tx * 256 - x) * scale + width / 2, top: (ty * 256 - y) * scale + height / 2 });
    return out;
  }, [lat, lon, width, height, scale]);

  const size = 256 * scale;
  const f = radar.frames[frame];
  return (
    <div className="radar" style={{ width, height }}>
      {tiles.map((t) => (
        <img key={`b${t.tx}${t.ty}`} className="radar-tile" src={`${ESRI}/World_Dark_Gray_Base/MapServer/tile/${Z}/${t.ty}/${t.tx}`} style={{ left: t.left, top: t.top, width: size, height: size }} alt="" />
      ))}
      {radar.frames.map((fr, i) =>
        tiles.map((t) => (
          <img
            key={`r${i}-${t.tx}${t.ty}`}
            className="radar-tile radar-rain"
            src={fr.url.replace("{z}", String(Z)).replace("{x}", String(t.tx)).replace("{y}", String(t.ty))}
            style={{ left: t.left, top: t.top, width: size, height: size, opacity: i === frame ? 0.85 : 0 }}
            alt=""
          />
        ))
      )}
      <div className="radar-home" style={{ left: width / 2, top: height / 2 }} />
      <div className="radar-label">Radar · {f ? DateTime.fromMillis(f.time).toFormat("h:mm a") : ""}</div>
    </div>
  );
}

/* ──────────────────────────── Today ───────────────────────────── */

/** Today previews tomorrow in the evening, or once the day has little left. */
export function todayShowsTomorrow(events: CalEvent[], now: DateTime, tz: string, maxRows: number) {
  const today = now.startOf("day");
  const todays = events.filter((e) => onDay(e, today, tz));
  const upcoming = todays.filter((e) => !e.allDay && eventEnd(e, tz) > now);
  const used = todays.filter((e) => e.allDay).length + upcoming.length;
  const hasTomorrow = events.some((e) => onDay(e, today.plus({ days: 1 }), tz));
  return hasTomorrow && maxRows - used >= 2 && (upcoming.length < 2 || now.hour >= 18);
}

type Row =
  | { type: "header"; label: string; key: string }
  | { type: "event"; e: CalEvent; key: string; status: "now" | "next" | "later" | "allday"; progress?: number };

export function TodayList({
  events,
  now,
  tz,
  h24,
  maxRows = 5,
  guest,
  guestWelcome,
  scale = 1
}: {
  events: CalEvent[];
  now: DateTime;
  tz: string;
  h24: boolean;
  maxRows?: number;
  guest?: boolean;
  guestWelcome?: string;
  scale?: number;
}) {
  const { rows, hidden, empty, doneCount } = useMemo(() => {
    const out: Row[] = [];
    const today = now.startOf("day");
    const todays = events.filter((e) => onDay(e, today, tz));
    const timed = todays.filter((e) => !e.allDay);
    const upcoming = timed.filter((e) => eventEnd(e, tz) > now);

    for (const e of todays.filter((x) => x.allDay)) out.push({ type: "event", e, key: e.id, status: "allday" });
    let nextMarked = false;
    for (const e of upcoming) {
      const s = eventStart(e, tz);
      const en = eventEnd(e, tz);
      if (s <= now) {
        out.push({ type: "event", e, key: e.id, status: "now", progress: (now.toMillis() - s.toMillis()) / Math.max(1, en.toMillis() - s.toMillis()) });
      } else {
        out.push({ type: "event", e, key: e.id, status: nextMarked ? "later" : "next" });
        nextMarked = true;
      }
    }
    const todayCount = out.length;
    // Evening, or the day is wrapping up: show what's first tomorrow
    const room = maxRows - out.length;
    if (todayShowsTomorrow(events, now, tz, maxRows)) {
      const tomorrow = today.plus({ days: 1 });
      const tm = events.filter((e) => onDay(e, tomorrow, tz)).slice(0, room - 1);
      if (tm.length) {
        out.push({ type: "header", label: "Tomorrow", key: "tomorrow" });
        for (const e of tm) out.push({ type: "event", e, key: `t-${e.id}`, status: e.allDay ? "allday" : "later" });
      }
    }
    return {
      rows: out.slice(0, maxRows),
      hidden: Math.max(0, todayCount - maxRows),
      empty: todays.length === 0,
      doneCount: timed.length - upcoming.length
    };
  }, [events, now, tz, maxRows]);

  if (guest && !events.length) {
    return (
      <div className="today" style={{ ["--k" as string]: scale }}>
        <div className="today-welcome">{guestWelcome}</div>
      </div>
    );
  }

  const nothingLeftToday = rows.every((r) => r.key.startsWith("t-") || r.type === "header");
  return (
    <div className="today" style={{ ["--k" as string]: scale }}>
      {nothingLeftToday && <div className="today-quiet">{empty ? "Nothing scheduled today" : doneCount ? "All done for today" : "Nothing else today"}</div>}
      {rows.map((r) => {
        if (r.type === "header") return <div key={r.key} className="today-sub">{r.label}</div>;
        const s = eventStart(r.e, tz);
        const until = s.toMillis() - now.toMillis();
        return (
          <div key={r.key} className={`today-row ${r.status}`} style={{ ["--c" as string]: r.e.color }}>
            <div className="today-time">{r.status === "allday" ? "All day" : fmtTime(s, h24)}</div>
            <div className="today-title">
              <span className="dot" />
              <span className="today-text">{r.e.title}</span>
            </div>
            <div className="today-status">
              {r.status === "now" && "Now"}
              {r.status === "next" && until < 6 * 3600_000 && `in ${humanDuration(until)}`}
            </div>
            {r.status === "now" && (
              <div className="today-progress">
                <span style={{ width: `${Math.min(100, (r.progress ?? 0) * 100)}%` }} />
              </div>
            )}
          </div>
        );
      })}
      {hidden > 0 && <div className="today-more">+{hidden} more today</div>}
    </div>
  );
}

/* ───────────────────────── Coming up ──────────────────────────── */

/** The next few days that have something on them — full titles, no grid. */
export function Agenda({ events, now, tz, h24, days = 5, maxRows = 9, startOffset = 1 }: { events: CalEvent[]; now: DateTime; tz: string; h24: boolean; days?: number; maxRows?: number; startOffset?: number }) {
  const groups = useMemo(() => {
    const out: { day: DateTime; items: CalEvent[] }[] = [];
    let rows = 0;
    for (let i = startOffset; i <= 14 && out.length < days && rows < maxRows - 1; i++) {
      const day = now.startOf("day").plus({ days: i });
      // multi-day events are listed once, on the day they start
      const items = events.filter((e) => onDay(e, day, tz) && !(e.allDay && eventStart(e, tz) < day));
      if (!items.length) continue;
      const take = items.slice(0, Math.min(3, maxRows - rows - 1));
      if (!take.length) break;
      out.push({ day, items: take });
      rows += take.length + 1;
    }
    return out;
  }, [events, now, tz, days, maxRows, startOffset]);

  if (!groups.length) return <div className="agenda-empty">Nothing coming up</div>;
  return (
    <div className="agenda">
      {groups.map(({ day, items }) => (
        <div key={day.toISODate()} className="agenda-day">
          <div className="agenda-date">
            {day.hasSame(now.plus({ days: 1 }), "day") ? "Tomorrow" : day.toFormat("cccc")}
            <span>{day.toFormat("LLL d")}</span>
          </div>
          {items.map((e) => {
            const multi = e.allDay && eventEnd(e, tz).diff(eventStart(e, tz), "days").days > 1.5;
            return (
              <div key={e.id} className="agenda-item" style={{ ["--c" as string]: e.color }}>
                <span className="dot" />
                <span className="agenda-title">{e.title}</span>
                <span className="agenda-time">
                  {e.allDay ? (multi ? `to ${eventEnd(e, tz).minus({ days: 1 }).toFormat("LLL d")}` : "") : fmtTime(eventStart(e, tz), h24, true)}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** Month at a glance: numbers and colored dots, nothing else. */
export function MiniMonth({ events, now, tz, weekStartsOn, showDots = true }: { events: CalEvent[]; now: DateTime; tz: string; weekStartsOn: 0 | 1; showDots?: boolean }) {
  const today = now.startOf("day");
  const key = today.toISODate();
  const cells = useMemo(() => {
    const first = today.startOf("month");
    const offset = weekStartsOn === 0 ? first.weekday % 7 : first.weekday - 1;
    const start = first.minus({ days: offset });
    const weeks = Math.ceil((offset + first.daysInMonth!) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const day = start.plus({ days: i });
      const colors = [...new Set(events.filter((e) => onDay(e, day, tz)).map((e) => e.color))].slice(0, 3);
      return { day, colors };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, events, tz, weekStartsOn]);

  return (
    <div className="mini">
      <div className="label mini-title">{today.toFormat("LLLL")}</div>
      <div className="mini-grid">
        {cells.slice(0, 7).map(({ day }) => (
          <div key={`h${day.weekday}`} className="mini-dow">
            {day.toFormat("ccccc")}
          </div>
        ))}
        {cells.map(({ day, colors }) => {
          const inMonth = day.month === today.month;
          const isToday = +day === +today;
          return (
            <div key={day.toISODate()} className={`mini-cell ${inMonth ? "" : "out"} ${day < today ? "past" : ""} ${isToday ? "today" : ""}`}>
              <span className="mini-num">{day.day}</span>
              <span className="mini-dots">{showDots && inMonth && colors.map((c) => <i key={c} style={{ background: c }} />)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── House ────────────────────────────── */

type Attention = { id: string; tone: "warn" | "danger"; icon: string; text: string; sub?: string };

function stateWord(kind: string, state: string) {
  if (state === "on") return kind === "door" || kind === "window" ? "open" : "on";
  if (state === "off") return kind === "door" || kind === "window" ? "closed" : "off";
  if (state === "not_home") return "away";
  return state.replace(/_/g, " ");
}

export function attentionItems(state: Snapshot, now: DateTime, guest: boolean): Attention[] {
  const out: Attention[] = [];
  for (const a of state.weather?.alerts ?? []) {
    out.push({
      id: a.id,
      tone: a.severity === "Moderate" ? "warn" : "danger",
      icon: "alert",
      text: a.event,
      sub: a.ends ? `until ${DateTime.fromISO(a.ends).setZone(now.zone).toFormat("ccc h:mm a")}` : undefined
    });
  }
  if (!guest) {
    for (const t of state.config.house.tiles) {
      const e = state.ha.entities[t.entity];
      if (!e || !t.alertWhen.includes(e.state)) continue;
      if ((now.toMillis() - e.changed) / 60000 < t.alertAfterMinutes) continue;
      out.push({
        id: t.entity,
        tone: "warn",
        icon: t.kind === "lock" ? "unlock" : t.kind === "garage" ? "garageOpen" : "doorOpen",
        text: `${t.name} ${stateWord(t.kind, e.state)}`,
        sub: humanDuration(now.toMillis() - e.changed)
      });
    }
  }
  return out;
}

export function AttentionBar({ items }: { items: Attention[] }) {
  if (!items.length) return null;
  return (
    <div className="attention">
      {items.map((a) => (
        <div key={a.id} className={`attention-item ${a.tone}`}>
          <Icon name={a.icon} size={32} stroke={2} />
          <span>{a.text}</span>
          {a.sub && <span className="attention-sub">{a.sub}</span>}
        </div>
      ))}
    </div>
  );
}

export function People({ state, size = 56 }: { state: Snapshot; size?: number }) {
  const people = state.config.house.people;
  if (!people.length) return null;
  return (
    <div className="people">
      {people.map((p) => {
        const e = state.ha.entities[p.entity];
        const home = e?.state === "home";
        const pic = e?.attrs.entity_picture ? `${basePath}/api/ha/image?entity=${p.entity}` : p.picture;
        return (
          <div key={p.entity} className={`person ${home ? "home" : "away"}`}>
            <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }}>
              {pic ? <img src={pic} alt="" /> : p.name.slice(0, 1)}
            </div>
            <div className="person-name">{p.name}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * One calm line about the house instead of a wall of tiles:
 * "All locked · 69° inside". Anything wrong goes to the alert bar instead.
 */
export function HouseSummary({ state, guest }: { state: Snapshot; guest: boolean }) {
  const parts: string[] = [];
  const tiles = state.config.house.tiles.filter((t) => !guest || t.guestVisible);
  const ent = (id: string) => state.ha.entities[id];
  const secure = tiles.filter((t) => ["lock", "door", "garage", "window"].includes(t.kind) && ent(t.entity));
  let ok = true;
  if (secure.length && !guest) {
    const open = secure.filter((t) => t.alertWhen.includes(ent(t.entity)!.state));
    ok = open.length === 0;
    parts.push(ok ? (secure.some((t) => t.kind === "lock") ? "All locked" : "All closed") : `${open.length} open`);
  }
  for (const t of tiles) {
    const e = ent(t.entity);
    if (!e) continue;
    if (t.kind === "climate" && e.attrs.current_temperature != null) parts.push(`${Math.round(Number(e.attrs.current_temperature))}${deg} inside`);
  }
  if (!parts.length) return null;
  return (
    <div className="house-summary">
      <Icon name={ok ? "check" : "alert"} size={26} stroke={2.2} className={ok ? "ok" : "warn"} />
      {parts.join("  ·  ")}
    </div>
  );
}

export function nowPlaying(state: Snapshot): HaEntity[] {
  const hidden = new Set(state.config.house.hideMediaPlayers);
  return Object.values(state.ha.entities)
    .filter((e) => e.id.startsWith("media_player.") && !hidden.has(e.id) && e.state === "playing" && (e.attrs.media_title || e.attrs.app_name))
    .sort((a, b) => b.changed - a.changed);
}

export function NowPlaying({ players }: { players: HaEntity[] }) {
  const p = players[0];
  if (!p) return null;
  const music = p.attrs.media_content_type === "music" || !!p.attrs.media_artist;
  const sub = p.attrs.media_artist || p.attrs.media_series_title || "";
  return (
    <div className="np">
      <div className="np-art">
        {p.attrs.entity_picture ? (
          <img src={`${basePath}/api/ha/image?entity=${p.id}&t=${encodeURIComponent(String(p.attrs.media_title ?? ""))}`} alt="" />
        ) : (
          <Icon name={music ? "music" : "tv"} size={28} />
        )}
      </div>
      <div className="np-text">
        <div className="np-title">{p.attrs.media_title ?? p.attrs.app_name}</div>
        <div className="np-room">
          {sub ? `${sub} · ` : ""}
          {p.name}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Fun ─────────────────────────────── */

const FUN_LABEL: Record<FunItem["kind"], string> = { joke: "Dad joke", fact: "Did you know", history: "On this day" };

export function FunCard({ items, rotateSeconds, scale = 1 }: { items: FunItem[]; rotateSeconds: number; scale?: number }) {
  const [idx, setIdx] = useState(0);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    setReveal(false);
    const r = setTimeout(() => setReveal(true), Math.min(12, rotateSeconds * 0.35) * 1000);
    const n = setTimeout(() => setIdx((i) => (i + 1) % Math.max(1, items.length)), rotateSeconds * 1000);
    return () => {
      clearTimeout(r);
      clearTimeout(n);
    };
  }, [idx, items.length, rotateSeconds]);

  const item = items[idx % Math.max(1, items.length)];
  if (!item) return null;
  return (
    <div className="fun" key={idx} style={{ ["--k" as string]: scale }}>
      <div className="fun-label">
        {FUN_LABEL[item.kind]}
        {item.meta && <span> · {item.meta}</span>}
      </div>
      <div className="fun-text">
        {item.text}
        {item.punchline && <span className={`fun-punch ${reveal ? "show" : ""}`}> {item.punchline}</span>}
      </div>
    </div>
  );
}

export function StatusDot({ online, ha }: { online: boolean; ha: Snapshot["ha"] }) {
  if (online && (!ha.configured || ha.connected)) return null;
  return <div className="status-dot">{!online ? "Reconnecting…" : "Home Assistant offline"}</div>;
}
