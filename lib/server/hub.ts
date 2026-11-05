import type { HaEntity, Snapshot, StreamMessage } from "../types";
import { configMtime, isDemo, loadConfig, toPublicConfig, type DenBoardConfig } from "./config";
import { loadCalendars } from "./calendar";
import { loadWeather, loadRadar } from "./weather";
import { loadFun } from "./fun";
import { HaClient } from "./homeassistant";
import { demoCalendar, demoEntities, demoHouseConfig } from "./demo";

/**
 * The hub is the single source of truth on the server. It refreshes calendar / weather /
 * radar / fun content on timers, holds the live HA connection, and fans every change out to
 * connected screens over Server-Sent Events. Screens never call third-party APIs directly.
 */

type Listener = (msg: StreamMessage) => void;

const MIN = 60_000;

class Hub {
  private listeners = new Set<Listener>();
  private timers: NodeJS.Timeout[] = [];
  private ha: HaClient | null = null;
  private haKey = "";
  private mtime = 0;
  private watched = new Set<string>();
  snapshot: Snapshot;

  constructor() {
    const config = this.config();
    this.snapshot = {
      config: toPublicConfig(config),
      calendar: null,
      weather: null,
      radar: null,
      fun: null,
      ha: { connected: false, configured: false, entities: {} },
      epoch: Date.now()
    };
    this.mtime = configMtime();
    this.applyConfig(config);
    this.start();
  }

  private config(): DenBoardConfig {
    const c = loadConfig();
    return isDemo() ? demoHouseConfig(c) : c;
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(msg: StreamMessage) {
    for (const fn of this.listeners) {
      try {
        fn(msg);
      } catch {
        /* a dead stream is cleaned up by its own abort handler */
      }
    }
  }

  private every(ms: number, fn: () => Promise<void> | void) {
    const run = async () => {
      try {
        await fn();
      } catch (err) {
        console.warn("[denboard] refresh failed:", String(err));
      }
    };
    void run();
    this.timers.push(setInterval(run, ms));
  }

  private start() {
    this.every(this.config().calendar.refreshMinutes * MIN, () => this.refreshCalendar());
    this.every(10 * MIN, () => this.refreshWeather());
    this.every(5 * MIN, () => this.refreshRadar());
    this.every(60 * MIN, () => this.refreshFun());
    // Config hot-reload: edit data/denboard.json and every TV picks it up within ~10s
    this.every(10_000, () => {
      const m = configMtime();
      if (m && m !== this.mtime) {
        this.mtime = m;
        const config = this.config();
        this.applyConfig(config);
        this.snapshot.epoch = Date.now();
        void this.refreshCalendar();
        void this.refreshWeather();
        this.emit({ type: "reload" });
      }
    });
  }

  private applyConfig(config: DenBoardConfig) {
    this.snapshot.config = toPublicConfig(config);
    const house = this.snapshot.config.house;
    this.watched = new Set([
      ...house.people.map((p) => p.entity),
      ...house.tiles.map((t) => t.entity),
      ...(Array.isArray(house.mediaPlayers) ? house.mediaPlayers : []),
      house.guestModeEntity
    ]);
    const autoMedia = house.mediaPlayers === "auto";
    const hidden = new Set(house.hideMediaPlayers);
    const isWatched = (id: string) =>
      this.watched.has(id) || (autoMedia && id.startsWith("media_player.") && !hidden.has(id));

    if (isDemo()) {
      this.snapshot.ha = {
        connected: true,
        configured: true,
        entities: Object.fromEntries(demoEntities().map((e) => [e.id, e]))
      };
      return;
    }

    const url = config.homeAssistant.url;
    const token = process.env.HOME_ASSISTANT_TOKEN || "";
    const key = `${url}|${token}`;
    this.snapshot.ha.configured = !!(url && token);
    if (!url || !token) {
      this.ha?.stop();
      this.ha = null;
      return;
    }
    if (this.ha && this.haKey === key) {
      // Same connection; just re-filter what we forward
      this.snapshot.ha.entities = Object.fromEntries(
        [...this.ha.states.values()].filter((e) => isWatched(e.id)).map((e) => [e.id, e])
      );
      return;
    }
    this.ha?.stop();
    this.haKey = key;
    this.ha = new HaClient({
      url,
      token,
      isWatched,
      onConnection: (connected) => {
        this.snapshot.ha.connected = connected;
        this.emit({ type: "ha", data: { connected, changed: [] } });
      },
      onEntities: (changed: HaEntity[]) => {
        for (const e of changed) this.snapshot.ha.entities[e.id] = e;
        this.emit({ type: "ha", data: { connected: this.snapshot.ha.connected, changed } });
      }
    });
    this.ha.start();
  }

  private async refreshCalendar() {
    const config = this.config();
    const data = isDemo() && !config.calendars.length ? demoCalendar(config) : await loadCalendars(config);
    this.snapshot.calendar = data;
    this.emit({ type: "calendar", data });
  }

  private async refreshWeather() {
    const data = await loadWeather(this.config());
    this.snapshot.weather = data;
    this.emit({ type: "weather", data });
    // Radar only matters when something is falling nearby
    if (!data.precipSoon && !isDemo() && this.snapshot.radar) {
      this.snapshot.radar = null;
      this.emit({ type: "radar", data: null });
    } else if ((data.precipSoon || isDemo()) && !this.snapshot.radar) {
      await this.refreshRadar();
    }
  }

  private async refreshRadar() {
    if (!isDemo() && !this.snapshot.weather?.precipSoon) return;
    const data = await loadRadar();
    this.snapshot.radar = data;
    this.emit({ type: "radar", data });
  }

  private async refreshFun() {
    const data = await loadFun(this.config());
    this.snapshot.fun = data;
    this.emit({ type: "fun", data });
  }

  /** Look up an entity picture URL for the image proxy (keeps the HA token server-side). */
  entityPicture(entityId: string): string | null {
    const e = this.snapshot.ha.entities[entityId];
    const pic = e?.attrs.entity_picture;
    if (typeof pic !== "string" || !pic) return null;
    if (/^https?:\/\//.test(pic)) return pic;
    const base = this.config().homeAssistant.url.replace(/\/+$/, "");
    return base ? `${/^https?:\/\//.test(base) ? base : `http://${base}`}${pic}` : null;
  }

  haBase(): string {
    return this.config().homeAssistant.url.replace(/\/+$/, "");
  }
}

// Survive Next.js dev hot-reloads without opening duplicate HA sockets
const g = globalThis as unknown as { __denboardHub?: Hub };
export function getHub(): Hub {
  if (!g.__denboardHub) g.__denboardHub = new Hub();
  return g.__denboardHub;
}
