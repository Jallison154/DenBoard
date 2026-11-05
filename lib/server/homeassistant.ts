import WebSocket from "ws";
import type { HaEntity } from "../types";

/**
 * One long-lived WebSocket to Home Assistant shared by every screen.
 * Subscribes to state_changed and forwards only the entities DenBoard cares about.
 */

const KEEP_ATTRS = [
  "friendly_name",
  "entity_picture",
  "device_class",
  "unit_of_measurement",
  "media_title",
  "media_artist",
  "media_album_name",
  "media_series_title",
  "media_content_type",
  "media_duration",
  "media_position",
  "media_position_updated_at",
  "app_name",
  "source",
  "current_temperature",
  "temperature",
  "target_temp_low",
  "target_temp_high",
  "hvac_action",
  "current_position",
  "battery_level"
];

type RawState = {
  entity_id: string;
  state: string;
  last_changed: string;
  attributes: Record<string, unknown>;
};

export function trimState(s: RawState): HaEntity {
  const attrs: HaEntity["attrs"] = {};
  for (const k of KEEP_ATTRS) {
    const v = s.attributes?.[k];
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") attrs[k] = v;
  }
  return {
    id: s.entity_id,
    state: s.state,
    name: String(s.attributes?.friendly_name ?? s.entity_id),
    changed: Date.parse(s.last_changed) || Date.now(),
    attrs
  };
}

export type HaClientOptions = {
  url: string;
  token: string;
  /** Decides whether an entity is relevant to any screen */
  isWatched: (entityId: string) => boolean;
  onEntities: (changed: HaEntity[]) => void;
  onConnection: (connected: boolean) => void;
};

export class HaClient {
  private ws: WebSocket | null = null;
  private msgId = 1;
  private backoff = 2000;
  private pingTimer: NodeJS.Timeout | null = null;
  private pending: HaEntity[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private lastPong = Date.now();
  private stopped = false;
  readonly states = new Map<string, HaEntity>();
  connected = false;

  constructor(private opts: HaClientOptions) {}

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    this.ws?.close();
  }

  private wsUrl() {
    const base = this.opts.url.replace(/\/+$/, "");
    const withProto = /^https?:\/\//i.test(base) ? base : `http://${base}`;
    return withProto.replace(/^http/i, "ws") + "/api/websocket";
  }

  private connect() {
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.wsUrl(), { handshakeTimeout: 10000 });
    } catch (err) {
      console.error("[denboard] HA websocket url invalid:", String(err));
      return this.scheduleReconnect();
    }
    this.ws = ws;

    ws.on("message", (buf) => {
      let msg: { type: string; id?: number; success?: boolean; result?: unknown; event?: { data?: { new_state?: RawState | null; entity_id?: string } } };
      try {
        msg = JSON.parse(buf.toString());
      } catch {
        return;
      }
      switch (msg.type) {
        case "auth_required":
          ws.send(JSON.stringify({ type: "auth", access_token: this.opts.token }));
          break;
        case "auth_invalid":
          console.error("[denboard] Home Assistant rejected the token (HOME_ASSISTANT_TOKEN).");
          ws.close();
          break;
        case "auth_ok":
          this.backoff = 2000;
          this.setConnected(true);
          ws.send(JSON.stringify({ id: this.msgId++, type: "get_states" }));
          ws.send(JSON.stringify({ id: this.msgId++, type: "subscribe_events", event_type: "state_changed" }));
          this.startPing();
          break;
        case "pong":
          this.lastPong = Date.now();
          break;
        case "result":
          if (Array.isArray(msg.result)) {
            // get_states response: full refresh of the watched set
            this.states.clear();
            const all = (msg.result as RawState[]).filter((s) => this.opts.isWatched(s.entity_id)).map(trimState);
            for (const e of all) this.states.set(e.id, e);
            this.opts.onEntities(all);
          }
          break;
        case "event": {
          const data = msg.event?.data;
          const id = data?.entity_id;
          if (!id || !this.opts.isWatched(id)) return;
          if (!data.new_state) {
            this.states.delete(id);
            this.queue({ id, state: "unavailable", name: id, changed: Date.now(), attrs: {} });
            return;
          }
          const e = trimState(data.new_state);
          const prev = this.states.get(id);
          this.states.set(id, e);
          // Ignore attribute churn that screens don't show (e.g. media position ticks)
          if (prev && prev.state === e.state && sameAttrs(prev, e)) return;
          this.queue(e);
          break;
        }
      }
    });

    ws.on("close", () => {
      this.cleanup();
      this.scheduleReconnect();
    });
    ws.on("error", (err) => {
      console.warn("[denboard] HA websocket error:", String(err));
    });
  }

  /** Coalesce bursts (scenes, automations) into one push to screens. */
  private queue(e: HaEntity) {
    this.pending = this.pending.filter((p) => p.id !== e.id);
    this.pending.push(e);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        const batch = this.pending;
        this.pending = [];
        this.opts.onEntities(batch);
      }, 150);
    }
  }

  private startPing() {
    this.lastPong = Date.now();
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastPong > 75000) {
        console.warn("[denboard] HA websocket stale, reconnecting");
        this.ws?.terminate();
        return;
      }
      this.ws?.send(JSON.stringify({ id: this.msgId++, type: "ping" }));
    }, 30000);
  }

  private cleanup() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.setConnected(false);
  }

  private setConnected(v: boolean) {
    if (this.connected === v) return;
    this.connected = v;
    this.opts.onConnection(v);
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 60000);
    setTimeout(() => this.connect(), wait);
  }
}

function sameAttrs(a: HaEntity, b: HaEntity) {
  for (const k of KEEP_ATTRS) {
    if (k === "media_position" || k === "media_position_updated_at") continue;
    if (a.attrs[k] !== b.attrs[k]) return false;
  }
  return true;
}
