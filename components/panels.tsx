"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import type { CalEvent, FunItem, HaEntity, RadarSlice, Snapshot, WeatherSlice } from "@/lib/types";
import { eventEnd, eventStart, fmtTime, greeting, humanDuration, onDay } from "@/lib/time";
import { WeatherIcon } from "./WeatherIcon";
import { Icon } from "./Icon";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

/* ───────────────────────────── Clock ───────────────────────────── */

export function Clock({ now, h24, size = 250 }: { now: DateTime; h24: boolean; size?: number }) {
  const hm = h24 ? now.toFormat("HH:mm") : now.toFormat("h:mm");
  return (
    <div className="clock">
      <div className="clock-greeting">{greeting(now.hour)}</div>
      <div className="clock-time" style={{ fontSize: size }}>
        {hm}
        {!h24 && <span className="clock-ampm" style={{ fontSize: size * 0.24 }}>{now.toFormat("a")}</span>}
      </div>
      <div className="clock-date" style={{ fontSize: Math.round(size * 0.19) }}>
        <span className="accent">{now.toFormat("cccc")}</span>
        <span className="dot-sep">·</span>
        {now.toFormat("LLLL d")}
      </div>
    </div>
  );
}

/* ─────────────────────────── Weather ──────────────────────────── */

const deg = "°";

export function WeatherNow({ weather, now, size = 150, hours = 6 }: { weather: WeatherSlice | null; now: DateTime; size?: number; hours?: number }) {
  if (!weather) return <div className="weather-now skeleton" style={{ height: size * 1.6 }} />;
  const c = weather.current;
  const today = weather.daily[0];
  const sunrise = DateTime.fromISO(today.sunrise, { zone: now.zone });
  const sunset = DateTime.fromISO(today.sunset, { zone: now.zone });
  const nextSun = now < sunrise ? { icon: "sunrise", t: sunrise } : now < sunset ? { icon: "sunset", t: sunset } : { icon: "sunrise", t: DateTime.fromISO(weather.daily[1]?.sunrise ?? today.sunrise, { zone: now.zone }) };
  return (
    <div className="weather-now">
      <div className="wn-main">
        <WeatherIcon kind={c.kind} isDay={c.isDay} size={size * 0.95} />
        <div>
          <div className="wn-temp" style={{ fontSize: size }}>
            {c.temp}
            <span className="wn-deg">{deg}</span>
          </div>
        </div>
      </div>
      <div className="wn-label" style={{ fontSize: size * 0.24 }}>{c.label}</div>
      <div className="wn-meta" style={{ fontSize: size * 0.17 }}>
        <span>
          H <b>{today.hi}{deg}</b> L <b>{today.lo}{deg}</b>
        </span>
        <span className="muted">Feels {c.feelsLike}{deg}</span>
        <span className="muted wn-sun">
          <Icon name={nextSun.icon} size={size * 0.19} /> {nextSun.t.toFormat("h:mm")}
        </span>
      </div>
      {hours > 0 && <Hourly weather={weather} count={hours} />}
    </div>
  );
}

export function Hourly({ weather, count }: { weather: WeatherSlice; count: number }) {
  // Every hour for the first few, so "what's it doing this afternoon" reads at a glance
  const items = weather.hourly.slice(1, 1 + count);
  return (
    <div className="hourly">
      {items.map((h) => {
        const t = DateTime.fromISO(h.time);
        return (
          <div key={h.time} className="hourly-item">
            <div className="hourly-time">{t.toFormat("ha").toLowerCase()}</div>
            <WeatherIcon kind={h.kind} isDay={h.isDay} size={44} animate={false} />
            <div className="hourly-temp">{h.temp}{deg}</div>
            {h.pop >= 20 && <div className="hourly-pop">{h.pop}%</div>}
          </div>
        );
      })}
    </div>
  );
}

export function Forecast({ weather, days = 6, compact = false }: { weather: WeatherSlice | null; days?: number; compact?: boolean }) {
  if (!weather) return <div className="panel skeleton" />;
  const list = weather.daily.slice(1, 1 + days);
  const min = Math.min(...list.map((d) => d.lo));
  const max = Math.max(...list.map((d) => d.hi));
  const span = Math.max(1, max - min);
  return (
    <div className={`forecast ${compact ? "compact" : ""}`}>
      {list.map((d) => {
        const dt = DateTime.fromISO(d.date);
        return (
          <div key={d.date} className="fc-row">
            <div className="fc-day">{dt.toFormat("ccc")}</div>
            <WeatherIcon kind={d.kind} size={compact ? 40 : 50} animate={false} />
            <div className="fc-lo">{d.lo}{deg}</div>
            <div className="fc-bar">
              <span
                style={{
                  left: `${((d.lo - min) / span) * 100}%`,
                  width: `${Math.max(8, ((d.hi - d.lo) / span) * 100)}%`
                }}
              />
            </div>
            <div className="fc-hi">{d.hi}{deg}</div>
            {!compact && <div className="fc-pop">{d.pop >= 25 ? `${d.pop}%` : ""}</div>}
          </div>
        );
      })}
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
        <img key={`b${t.tx}${t.ty}`} className="radar-tile" src={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/${Z}/${t.ty}/${t.tx}`} style={{ left: t.left, top: t.top, width: size, height: size }} alt="" />
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
      {tiles.map((t) => (
        <img key={`l${t.tx}${t.ty}`} className="radar-tile" src={`https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/${Z}/${t.ty}/${t.tx}`} style={{ left: t.left, top: t.top, width: size, height: size, opacity: 0.7 }} alt="" />
      ))}
      <div className="radar-home" style={{ left: width / 2, top: height / 2 }} />
      <div className="radar-label">
        <span className="radar-live" />
        Radar · {f ? DateTime.fromMillis(f.time).toFormat("h:mm a") : ""}
      </div>
    </div>
  );
}

/* ──────────────────────────── Today ───────────────────────────── */

type Row =
  | { type: "header"; label: string; key: string }
  | { type: "allday"; e: CalEvent; key: string }
  | { type: "timed"; e: CalEvent; key: string; status: "past" | "now" | "next" | "later"; progress?: number };

export function TodayList({
  events,
  now,
  tz,
  h24,
  maxRows = 8,
  guest,
  guestWelcome,
  big = 1
}: {
  events: CalEvent[];
  now: DateTime;
  tz: string;
  h24: boolean;
  maxRows?: number;
  guest?: boolean;
  guestWelcome?: string;
  big?: number;
}) {
  const rows = useMemo(() => {
    const out: Row[] = [];
    const today = now.startOf("day");
    const todays = events.filter((e) => onDay(e, today, tz));
    const allDay = todays.filter((e) => e.allDay);
    const timed = todays.filter((e) => !e.allDay);
    const upcoming = timed.filter((e) => eventEnd(e, tz) > now);
    const doneCount = timed.length - upcoming.length;

    for (const e of allDay) out.push({ type: "allday", e, key: e.id });
    let nextMarked = false;
    for (const e of upcoming) {
      const s = eventStart(e, tz);
      const en = eventEnd(e, tz);
      if (s <= now) {
        out.push({ type: "timed", e, key: e.id, status: "now", progress: (now.toMillis() - s.toMillis()) / Math.max(1, en.toMillis() - s.toMillis()) });
      } else {
        out.push({ type: "timed", e, key: e.id, status: nextMarked ? "later" : "next" });
        nextMarked = true;
      }
    }
    if (doneCount > 0 && upcoming.length === 0) {
      out.push({ type: "header", label: `All ${doneCount} done for today`, key: "done" });
    }

    // Late in the day or nothing left: preview tomorrow
    const remaining = maxRows - out.length;
    if (remaining >= 2 && (upcoming.length < 3 || now.hour >= 18)) {
      const tomorrow = today.plus({ days: 1 });
      const tm = events.filter((e) => onDay(e, tomorrow, tz)).slice(0, remaining - 1);
      if (tm.length) {
        out.push({ type: "header", label: `Tomorrow · ${tomorrow.toFormat("cccc")}`, key: "tomorrow" });
        for (const e of tm) out.push(e.allDay ? { type: "allday", e, key: `t-${e.id}` } : { type: "timed", e, key: `t-${e.id}`, status: "later" });
      }
    }
    return { rows: out.slice(0, maxRows), hidden: Math.max(0, out.length - maxRows), doneCount, empty: todays.length === 0 };
  }, [events, now, tz, maxRows]);

  if (guest && !events.length) {
    return (
      <div className="today-empty">
        <Icon name="home" size={64 * big} />
        <div style={{ fontSize: 42 * big }}>{guestWelcome}</div>
      </div>
    );
  }

  return (
    <div className="today" style={{ ["--big" as string]: big }}>
      {rows.empty && rows.rows.every((r) => r.key.startsWith("t-") || r.type === "header") && (
        <div className="today-clear">
          <Icon name="check" size={40 * big} /> Nothing on the calendar today
        </div>
      )}
      {rows.rows.map((r) => {
        if (r.type === "header") return <div key={r.key} className="today-header">{r.label}</div>;
        if (r.type === "allday")
          return (
            <div key={r.key} className="today-allday" style={{ ["--c" as string]: r.e.color }}>
              <span className="today-allday-tag">All day</span>
              <span className="today-title">{r.e.title}</span>
            </div>
          );
        const s = eventStart(r.e, tz);
        const until = s.toMillis() - now.toMillis();
        return (
          <div key={r.key} className={`today-row ${r.status}`} style={{ ["--c" as string]: r.e.color }}>
            <div className="today-time">{fmtTime(s, h24)}</div>
            <div className="today-body">
              <div className="today-title">{r.e.title}</div>
              {r.e.location && r.status !== "later" && <div className="today-loc">{r.e.location}</div>}
              {r.status === "now" && (
                <div className="today-progress">
                  <span style={{ width: `${Math.min(100, (r.progress ?? 0) * 100)}%` }} />
                </div>
              )}
            </div>
            {r.status === "now" && <div className="today-chip now">Now</div>}
            {r.status === "next" && until < 6 * 3600_000 && <div className="today-chip next">in {humanDuration(until)}</div>}
          </div>
        );
      })}
      {rows.hidden > 0 && <div className="today-more">+{rows.hidden} more</div>}
    </div>
  );
}

/* ─────────────────────────── House ────────────────────────────── */

type Attention = { id: string; tone: "warn" | "danger" | "info"; icon: string; text: string; sub?: string };

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
      const mins = (now.toMillis() - e.changed) / 60000;
      if (mins < t.alertAfterMinutes) continue;
      out.push({
        id: t.entity,
        tone: "warn",
        icon: t.kind === "lock" ? "unlock" : t.kind === "garage" ? "garageOpen" : "doorOpen",
        text: `${t.name} ${stateWord(t.kind, e.state)}`,
        sub: `for ${humanDuration(now.toMillis() - e.changed)}`
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
          <Icon name={a.icon} size={40} stroke={2.2} />
          <span className="attention-text">{a.text}</span>
          {a.sub && <span className="attention-sub">{a.sub}</span>}
        </div>
      ))}
    </div>
  );
}

function stateWord(kind: string, state: string) {
  if (state === "on") return kind === "door" || kind === "window" ? "open" : "on";
  if (state === "off") return kind === "door" || kind === "window" ? "closed" : "off";
  if (state === "not_home") return "away";
  return state.replace(/_/g, " ");
}

function tileIcon(kind: string, alert: boolean) {
  switch (kind) {
    case "lock":
      return alert ? "unlock" : "lock";
    case "garage":
      return alert ? "garageOpen" : "garage";
    case "door":
      return alert ? "doorOpen" : "door";
    case "window":
      return "window";
    case "climate":
      return "thermo";
    case "light":
      return "bulb";
    case "switch":
      return "power";
    default:
      return "gauge";
  }
}

export function People({ state, now, size = 1 }: { state: Snapshot; now: DateTime; size?: number }) {
  const people = state.config.house.people;
  if (!people.length) return null;
  return (
    <div className="people" style={{ ["--s" as string]: size }}>
      {people.map((p) => {
        const e = state.ha.entities[p.entity];
        const home = e?.state === "home";
        const where = !e ? "—" : home ? "Home" : e.state === "not_home" ? "Away" : e.state;
        const pic = e?.attrs.entity_picture ? `${basePath}/api/ha/image?entity=${p.entity}` : p.picture;
        return (
          <div key={p.entity} className={`person ${home ? "home" : "away"}`}>
            <div className="avatar">
              {pic ? <img src={pic} alt="" /> : <span>{p.name.slice(0, 1)}</span>}
            </div>
            <div className="person-text">
              <div className="person-name">{p.name}</div>
              <div className="person-where">
                {where}
                {e && <span className="person-since"> · {humanDuration(now.toMillis() - e.changed)}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function Tiles({ state, guest, now, max, columns }: { state: Snapshot; guest: boolean; now: DateTime; max?: number; columns?: boolean }) {
  const isAlert = (t: Snapshot["config"]["house"]["tiles"][number]) => {
    const e = state.ha.entities[t.entity];
    return !!e && t.alertWhen.includes(e.state);
  };
  // Alerting tiles first so they survive when space is limited
  const tiles = state.config.house.tiles
    .filter((t) => !guest || t.guestVisible)
    .map((t, i) => ({ t, i }))
    .sort((a, b) => Number(isAlert(b.t)) - Number(isAlert(a.t)) || a.i - b.i)
    .slice(0, max ?? 99)
    .sort((a, b) => a.i - b.i)
    .map((x) => x.t);
  if (!tiles.length) return null;
  return (
    <div className="tiles" style={columns ? { gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` } : undefined}>
      {tiles.map((t) => {
        const e = state.ha.entities[t.entity];
        const alert = !!e && t.alertWhen.includes(e.state);
        let value = e ? stateWord(t.kind, e.state) : "—";
        let sub: string | undefined;
        if (e && t.kind === "climate") {
          const cur = e.attrs.current_temperature;
          const set = e.attrs.temperature;
          value = cur != null ? `${Math.round(Number(cur))}°` : value;
          sub = e.attrs.hvac_action && e.attrs.hvac_action !== "idle" ? `${e.attrs.hvac_action} → ${set}°` : set != null ? `set ${set}°` : undefined;
        } else if (e && t.kind === "sensor") {
          value = `${e.state}${e.attrs.unit_of_measurement && e.attrs.unit_of_measurement !== "AQI" ? String(e.attrs.unit_of_measurement) : ""}`;
          sub = e.attrs.unit_of_measurement === "AQI" ? "AQI" : undefined;
        }
        return (
          <div key={t.entity} className={`tile ${alert ? "alert" : ""} ${!e || e.state === "unavailable" ? "off" : ""}`}>
            <Icon name={tileIcon(t.kind, alert)} size={34} />
            <div className="tile-text">
              <div className="tile-name">{t.name}</div>
              <div className="tile-value">
                {value}
                {sub && <span className="tile-sub"> {sub}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function nowPlaying(state: Snapshot): HaEntity[] {
  const house = state.config.house;
  const hidden = new Set(house.hideMediaPlayers);
  return Object.values(state.ha.entities)
    .filter((e) => e.id.startsWith("media_player.") && !hidden.has(e.id) && e.state === "playing" && (e.attrs.media_title || e.attrs.app_name))
    .sort((a, b) => b.changed - a.changed);
}

export function NowPlaying({ players, max = 2 }: { players: HaEntity[]; max?: number }) {
  if (!players.length) return null;
  return (
    <div className="now-playing">
      {players.slice(0, max).map((p) => {
        const music = p.attrs.media_content_type === "music" || !!p.attrs.media_artist;
        const sub = p.attrs.media_artist || p.attrs.media_series_title || p.attrs.media_album_name || "";
        return (
          <div key={p.id} className="np-card">
            <div className="np-art">
              {p.attrs.entity_picture ? (
                <img src={`${basePath}/api/ha/image?entity=${p.id}&t=${encodeURIComponent(String(p.attrs.media_title ?? ""))}`} alt="" />
              ) : (
                <Icon name={music ? "music" : "tv"} size={44} />
              )}
              <div className="np-eq">
                <span /><span /><span />
              </div>
            </div>
            <div className="np-text">
              <div className="np-room">
                {p.name}
                {p.attrs.app_name ? ` · ${p.attrs.app_name}` : ""}
              </div>
              <div className="np-title">{p.attrs.media_title ?? p.attrs.app_name}</div>
              {sub && <div className="np-sub">{String(sub)}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────── Fun ─────────────────────────────── */

const FUN_META: Record<FunItem["kind"], { label: string; icon: string }> = {
  joke: { label: "Dad joke", icon: "smile" },
  fact: { label: "Fun fact", icon: "sparkle" },
  history: { label: "On this day", icon: "book" }
};

export function FunCard({ items, rotateSeconds, size = 1 }: { items: FunItem[]; rotateSeconds: number; size?: number }) {
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
  const meta = FUN_META[item.kind];
  return (
    <div className="fun" key={idx} style={{ ["--s" as string]: size }}>
      <div className="fun-label">
        <Icon name={meta.icon} size={26 * size} />
        {meta.label}
        {item.meta && <span className="fun-meta">· {item.meta}</span>}
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
  return (
    <div className="status-dot">
      <Icon name="wifiOff" size={22} />
      {!online ? "Reconnecting…" : "Home Assistant offline"}
    </div>
  );
}
