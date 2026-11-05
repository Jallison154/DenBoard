"use client";

import { useEffect, useReducer, useState } from "react";
import type { Snapshot, StreamMessage } from "@/lib/types";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

function reducer(state: Snapshot | null, msg: StreamMessage): Snapshot | null {
  if (msg.type === "snapshot") return msg.data;
  if (!state) return state;
  switch (msg.type) {
    case "calendar":
      return { ...state, calendar: msg.data };
    case "weather":
      return { ...state, weather: msg.data };
    case "radar":
      return { ...state, radar: msg.data };
    case "fun":
      return { ...state, fun: msg.data };
    case "ha": {
      const entities = { ...state.ha.entities };
      for (const e of msg.data.changed) entities[e.id] = e;
      return { ...state, ha: { ...state.ha, connected: msg.data.connected, entities } };
    }
    default:
      return state;
  }
}

/**
 * Live dashboard state over Server-Sent Events. EventSource reconnects on its own and the
 * server re-sends a full snapshot on every (re)connect, so screens self-heal after restarts.
 */
export function useDashboard() {
  const [state, dispatch] = useReducer(reducer, null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    let es: EventSource | null = null;
    let lostAt: number | null = null;
    let epoch: number | null = null;

    const open = () => {
      es = new EventSource(`${basePath}/api/stream`);
      es.onopen = () => {
        lostAt = null;
        setOnline(true);
      };
      es.onerror = () => {
        setOnline(false);
        lostAt ??= Date.now();
        // Some TV browsers stop retrying; force a fresh connection
        if (es?.readyState === EventSource.CLOSED) {
          es.close();
          setTimeout(open, 5000);
        }
      };
      es.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as StreamMessage;
        if (msg.type === "reload") return window.location.reload();
        if (msg.type === "snapshot") {
          // Server restarted with new config/code → reload to pick up new JS too
          if (epoch != null && msg.data.epoch !== epoch) return window.location.reload();
          epoch = msg.data.epoch;
        }
        dispatch(msg);
      };
    };
    open();

    // Belt and braces for always-on screens: reload if offline for 10 min, and nightly at 3:30
    const watchdog = setInterval(() => {
      if (lostAt && Date.now() - lostAt > 10 * 60_000) window.location.reload();
      const d = new Date();
      if (d.getHours() === 3 && d.getMinutes() === 30) window.location.reload();
    }, 60_000);

    return () => {
      es?.close();
      clearInterval(watchdog);
    };
  }, []);

  return { state, online };
}

/** Re-render on an interval (clock = 1s, everything else = 30s). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // Align ticks to the interval boundary so the clock flips exactly on the second/minute
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      setNow(Date.now());
      t = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    };
    t = setTimeout(tick, intervalMs - (Date.now() % intervalMs) + 5);
    return () => clearTimeout(t);
  }, [intervalMs]);
  return now;
}

export function useGuestMode(state: Snapshot | null): boolean {
  const [forced, setForced] = useState<boolean | null>(null);
  useEffect(() => {
    const g = new URLSearchParams(window.location.search).get("guest");
    if (g === "1" || g === "true") setForced(true);
    else if (g === "0" || g === "false") setForced(false);
  }, []);
  if (forced != null) return forced;
  if (!state) return false;
  return state.ha.entities[state.config.house.guestModeEntity]?.state === "on";
}
