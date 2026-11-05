"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useDashboard, useGuestMode, useNow } from "./useDashboard";
import { Stage } from "./Stage";
import { Sky } from "./Sky";
import {
  Agenda,
  AttentionBar,
  Clock,
  FunCard,
  HouseSummary,
  MiniMonth,
  NowPlaying,
  People,
  Radar,
  StatusDot,
  TodayList,
  WeatherNow,
  WeekForecast,
  attentionItems,
  nowPlaying,
  todayShowsTomorrow
} from "./panels";
import { atClock } from "@/lib/time";
import type { Snapshot } from "@/lib/types";

export type Layout = "portrait" | "landscape" | "nest";

const SIZES: Record<Layout, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
  nest: { w: 1024, h: 600 }
};

function nightDimLevel(state: Snapshot | null, now: DateTime): number {
  const nd = state?.config.nightDim;
  if (!nd) return 0;
  const start = atClock(now, nd.start);
  const end = atClock(now, nd.end);
  const inWindow = start > end ? now >= start || now < end : now >= start && now < end;
  return inWindow ? Math.min(0.85, Math.max(0, 1 - nd.level)) : 0;
}

export function Dashboard({ layout }: { layout: Layout }) {
  // Everything here depends on the screen's clock, so skip server rendering entirely
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <DashboardInner layout={layout} /> : null;
}

function DashboardInner({ layout }: { layout: Layout }) {
  const { state, online } = useDashboard();
  const guest = useGuestMode(state);
  const tick = useNow(1000);
  const tz = state?.config.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const now = DateTime.fromMillis(tick, { zone: tz });
  const minuteKey = now.toFormat("yyyy-MM-dd HH:mm");
  // Panels that only care about the minute re-render once a minute, not every second
  const minuteNow = useMemo(() => now.startOf("minute"), [minuteKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const { w, h } = SIZES[layout];

  return (
    <Stage width={w} height={h} dim={nightDimLevel(state, now)}>
      <Sky now={minuteNow} weather={state?.weather ?? null} />
      {!state ? (
        <div className="boot">
          <Clock now={now} h24={false} size={layout === "nest" ? 128 : 210} />
        </div>
      ) : layout === "portrait" ? (
        <Portrait state={state} now={now} minuteNow={minuteNow} guest={guest} />
      ) : layout === "landscape" ? (
        <Landscape state={state} now={now} minuteNow={minuteNow} guest={guest} />
      ) : (
        <Nest state={state} now={now} minuteNow={minuteNow} guest={guest} />
      )}
      {state && <StatusDot online={online} ha={state.ha} />}
      {state?.config.demo && <div className="demo-badge">Demo data</div>}
    </Stage>
  );
}

type ViewProps = { state: Snapshot; now: DateTime; minuteNow: DateTime; guest: boolean };

function visibleEvents(state: Snapshot, guest: boolean) {
  const events = state.calendar?.events ?? [];
  // Guest screens only show calendars flagged guestVisible
  return guest ? events.filter((e) => state.config.guestCalendars.includes(e.calendar)) : events;
}

/* ───────────── Portrait 1080×1920 — the den's 43" vertical TV ───────────── */

function radarVisible(state: Snapshot) {
  return !!state.radar && !!state.weather?.precipSoon;
}

function HouseFooter({ state, guest, avatar, media = true }: { state: Snapshot; guest: boolean; avatar: number; media?: boolean }) {
  if (!state.ha.configured) return null;
  const playing = nowPlaying(state);
  return (
    <>
      <div className="house">
        {!guest && <People state={state} size={avatar} />}
        <div className="house-right">
          <HouseSummary state={state} guest={guest} />
        </div>
      </div>
      {media && <NowPlaying players={playing} />}
    </>
  );
}

function Portrait({ state, now, minuteNow, guest }: ViewProps) {
  const c = state.config;
  const events = visibleEvents(state, guest);
  const attention = attentionItems(state, minuteNow, guest);

  return (
    <div className="layout portrait">
      <header className="hero">
        <Clock now={now} h24={c.clock24h} size={210} />
        <WeatherNow weather={state.weather} size={112} />
      </header>

      <AttentionBar items={attention} />

      <section className="sec">
        <h2 className="label">Today</h2>
        <TodayList events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} maxRows={5} guest={guest} guestWelcome={c.guestWelcome} />
      </section>

      <section className="sec split">
        <div>
          <h2 className="label">Coming up</h2>
          {guest && !events.length ? <div className="agenda-empty">—</div> : <Agenda events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} days={4} maxRows={8} startOffset={todayShowsTomorrow(events, minuteNow, c.timezone, 5) ? 2 : 1} />}
        </div>
        <div>
          {radarVisible(state) && state.radar ? (
            <>
              <h2 className="label">Rain nearby</h2>
              <Radar radar={state.radar} lat={c.lat} lon={c.lon} width={380} height={330} />
            </>
          ) : (
            <MiniMonth events={events} now={minuteNow} tz={c.timezone} weekStartsOn={c.calendar.weekStartsOn} />
          )}
        </div>
      </section>

      <section className="sec">
        <WeekForecast weather={state.weather} days={6} />
      </section>

      <footer className="sec foot">
        <HouseFooter state={state} guest={guest} avatar={54} />
        {state.fun && <FunCard items={state.fun.items} rotateSeconds={c.funRotateSeconds} />}
      </footer>
    </div>
  );
}

/* ───────────── Landscape 1920×1080 — other TVs ───────────── */

function Landscape({ state, now, minuteNow, guest }: ViewProps) {
  const c = state.config;
  const events = visibleEvents(state, guest);
  const attention = attentionItems(state, minuteNow, guest);

  return (
    <div className="layout landscape">
      <div className="l-left">
        <Clock now={now} h24={c.clock24h} size={176} />
        <WeatherNow weather={state.weather} size={88} />
        <section className="sec">
          <h2 className="label">Today</h2>
          <TodayList events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} maxRows={5} guest={guest} guestWelcome={c.guestWelcome} scale={0.9} />
        </section>
      </div>
      <div className="l-right">
        <AttentionBar items={attention} />
        <section className="split">
          <div>
            <h2 className="label">Coming up</h2>
            {guest && !events.length ? <div className="agenda-empty">—</div> : <Agenda events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} days={3} maxRows={7} startOffset={todayShowsTomorrow(events, minuteNow, c.timezone, 5) ? 2 : 1} />}
          </div>
          <div>
            {radarVisible(state) && state.radar ? (
              <>
                <h2 className="label">Rain nearby</h2>
                <Radar radar={state.radar} lat={c.lat} lon={c.lon} width={420} height={330} />
              </>
            ) : (
              <MiniMonth events={events} now={minuteNow} tz={c.timezone} weekStartsOn={c.calendar.weekStartsOn} />
            )}
          </div>
        </section>
        <section className="sec">
          <WeekForecast weather={state.weather} days={6} />
        </section>
        <footer className="sec foot">
          <HouseFooter state={state} guest={guest} avatar={48} media={false} />
          {state.fun && <FunCard items={state.fun.items} rotateSeconds={c.funRotateSeconds} scale={0.85} />}
        </footer>
      </div>
    </div>
  );
}

/* ───────────── Nest Hub / small 1024×600 ───────────── */

function Nest({ state, now, minuteNow, guest }: ViewProps) {
  const c = state.config;
  const events = visibleEvents(state, guest);
  const attention = attentionItems(state, minuteNow, guest);
  return (
    <div className="layout nest">
      <div className="n-left">
        <Clock now={now} h24={c.clock24h} size={128} />
        <WeatherNow weather={state.weather} size={64} />
      </div>
      <div className="n-right">
        <h2 className="label">Today</h2>
        <TodayList events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} maxRows={4} guest={guest} guestWelcome={c.guestWelcome} scale={0.62} />
      </div>
      {attention.length > 0 && (
        <div className="n-attn">
          <AttentionBar items={attention.slice(0, 2)} />
        </div>
      )}
    </div>
  );
}
