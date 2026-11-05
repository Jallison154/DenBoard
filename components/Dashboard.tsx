"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useDashboard, useGuestMode, useNow } from "./useDashboard";
import { Stage } from "./Stage";
import { Sky } from "./Sky";
import { CalendarGrid } from "./CalendarGrid";
import {
  AttentionBar,
  Clock,
  Forecast,
  FunCard,
  NowPlaying,
  People,
  Radar,
  StatusDot,
  Tiles,
  TodayList,
  WeatherNow,
  attentionItems,
  nowPlaying
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
          <Clock now={now} h24={false} size={layout === "nest" ? 140 : 220} />
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

/* ───────────── Portrait 1080×1920 — the den's vertical 4K TV ───────────── */

function Portrait({ state, now, minuteNow, guest }: ViewProps) {
  const c = state.config;
  const events = visibleEvents(state, guest);
  const attention = attentionItems(state, minuteNow, guest);
  const playing = nowPlaying(state);
  const raining = !!state.radar && !!state.weather?.precipSoon;
  const radarOn = !!state.radar && (raining || c.demo);

  return (
    <div className="layout portrait">
      <header className="p-hero">
        <Clock now={now} h24={c.clock24h} size={232} />
        <WeatherNow weather={state.weather} now={minuteNow} size={128} hours={5} />
      </header>

      <AttentionBar items={attention} />

      <section className="p-mid">
        <div className="panel p-today">
          <div className="panel-label">Today</div>
          <TodayList
            events={events}
            now={minuteNow}
            tz={c.timezone}
            h24={c.clock24h}
            maxRows={6}
            guest={guest}
            guestWelcome={c.guestWelcome}
          />
        </div>
        <div className="panel p-side">
          {radarOn && state.radar ? (
            <>
              <Radar radar={state.radar} lat={c.lat} lon={c.lon} width={372} height={226} />
              <Forecast weather={state.weather} days={3} compact />
            </>
          ) : (
            <>
              <div className="panel-label">This week</div>
              <Forecast weather={state.weather} days={6} />
            </>
          )}
        </div>
      </section>

      <section className="panel p-cal">
        <CalendarGrid
          events={events}
          now={minuteNow}
          tz={c.timezone}
          mode={c.calendar.gridMode}
          weeks={c.calendar.weeks}
          weekStartsOn={c.calendar.weekStartsOn}
          h24={c.clock24h}
          maxPerCell={6}
          hideDetails={guest && !events.length}
        />
      </section>

      {state.ha.configured && (
        <section className="p-house">
          {!guest && <People state={state} now={minuteNow} />}
          <div className="p-house-row">
            <NowPlaying players={playing} max={1} />
            <Tiles state={state} guest={guest} now={minuteNow} max={playing.length ? 3 : 6} columns />
          </div>
        </section>
      )}

      {state.fun && (
        <footer className="panel p-fun">
          <FunCard items={state.fun.items} rotateSeconds={c.funRotateSeconds} />
        </footer>
      )}
    </div>
  );
}

/* ───────────── Landscape 1920×1080 — other TVs ───────────── */

function Landscape({ state, now, minuteNow, guest }: ViewProps) {
  const c = state.config;
  const events = visibleEvents(state, guest);
  const attention = attentionItems(state, minuteNow, guest);
  const playing = nowPlaying(state);
  const radarOn = !!state.radar && (!!state.weather?.precipSoon || c.demo);

  return (
    <div className="layout landscape">
      <aside className="l-left">
        <Clock now={now} h24={c.clock24h} size={176} />
        <div className="panel l-weather">
          <WeatherNow weather={state.weather} now={minuteNow} size={96} hours={5} />
        </div>
        <div className="panel l-today">
          <div className="panel-label">Today</div>
          <TodayList events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} maxRows={5} guest={guest} guestWelcome={c.guestWelcome} big={0.82} />
        </div>
        {state.fun && (
          <div className="panel l-fun">
            <FunCard items={state.fun.items} rotateSeconds={c.funRotateSeconds} size={0.78} />
          </div>
        )}
      </aside>
      <main className="l-right">
        <AttentionBar items={attention} />
        <section className="panel l-cal">
          <CalendarGrid
            events={events}
            now={minuteNow}
            tz={c.timezone}
            mode={c.calendar.gridMode}
            weeks={Math.min(c.calendar.weeks, 4)}
            weekStartsOn={c.calendar.weekStartsOn}
            h24={c.clock24h}
            maxPerCell={6}
            hideDetails={guest && !events.length}
          />
        </section>
        <section className="l-bottom">
          {radarOn && state.radar ? (
            <div className="panel l-radar">
              <Radar radar={state.radar} lat={c.lat} lon={c.lon} width={360} height={196} />
            </div>
          ) : (
            <div className="panel l-forecast">
              <Forecast weather={state.weather} days={5} compact />
            </div>
          )}
          <div className="l-house">
            {state.ha.configured && (
              <>
                {!guest && <People state={state} now={minuteNow} size={0.85} />}
                {playing.length ? <NowPlaying players={playing} max={1} /> : <Tiles state={state} guest={guest} now={minuteNow} />}
              </>
            )}
          </div>
        </section>
      </main>
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
        <Clock now={now} h24={c.clock24h} size={132} />
        <WeatherNow weather={state.weather} now={minuteNow} size={72} hours={0} />
      </div>
      <div className="panel n-right">
        <div className="panel-label">Today</div>
        <TodayList events={events} now={minuteNow} tz={c.timezone} h24={c.clock24h} maxRows={5} guest={guest} guestWelcome={c.guestWelcome} big={0.62} />
      </div>
      {attention.length > 0 && (
        <div className="n-attn">
          <AttentionBar items={attention.slice(0, 2)} />
        </div>
      )}
    </div>
  );
}
