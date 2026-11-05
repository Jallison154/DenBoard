import { DateTime } from "luxon";
import type { CalEvent, CalendarSlice, HaEntity } from "../types";
import type { DenBoardConfig } from "./config";

/** Sample data for DENBOARD_DEMO=1 — lets you design/preview without real calendars or HA. */

const CALS = [
  { id: "family", name: "Family", color: "#5B8CFF" },
  { id: "jonathan", name: "Jonathan", color: "#2DD4BF" },
  { id: "lacey", name: "Lacey", color: "#F472B6" },
  { id: "kids", name: "Kids", color: "#FBBF24" },
  { id: "bills", name: "Bills", color: "#A78BFA" }
];

export function demoCalendar(config: DenBoardConfig): CalendarSlice {
  const tz = config.location.timezone;
  const today = DateTime.now().setZone(tz).startOf("day");
  const ev: CalEvent[] = [];
  let n = 0;
  const timed = (dayOffset: number, h: number, m: number, mins: number, title: string, cal: string, location?: string) => {
    const s = today.plus({ days: dayOffset, hours: h, minutes: m });
    const c = CALS.find((x) => x.id === cal)!;
    ev.push({ id: `demo${n++}`, title, start: s.toISO()!, end: s.plus({ minutes: mins }).toISO()!, allDay: false, calendar: cal, color: c.color, location });
  };
  const allDay = (dayOffset: number, days: number, title: string, cal: string) => {
    const s = today.plus({ days: dayOffset });
    const c = CALS.find((x) => x.id === cal)!;
    ev.push({ id: `demo${n++}`, title, start: s.toISODate()!, end: s.plus({ days }).toISODate()!, allDay: true, calendar: cal, color: c.color });
  };

  allDay(0, 1, "Trash day", "family");
  timed(0, 7, 30, 30, "School drop-off", "kids");
  timed(0, 8, 30, 60, "Toaster call with Vivian", "jonathan");
  timed(0, 12, 0, 60, "Lunch with Marissa", "lacey", "Main St Café");
  timed(0, 16, 0, 45, "Speech therapy", "kids");
  timed(0, 18, 0, 90, "Family dinner", "family");
  timed(0, 19, 30, 60, "Budget meeting", "family");
  timed(0, 21, 0, 60, "Movie night", "family");
  allDay(1, 1, "Nathan's birthday", "family");
  timed(1, 9, 0, 120, "Start @ Metra – load for BC", "jonathan");
  timed(1, 16, 0, 45, "Speech therapy", "kids");
  timed(2, 18, 15, 60, "Parent–teacher conferences", "kids");
  allDay(3, 1, "Marissa Acheson's birthday", "family");
  allDay(4, 1, "Water bill due", "bills");
  timed(5, 17, 15, 120, "BC w/ 2 hands — BV & Phil", "jonathan");
  timed(6, 8, 0, 240, "BC event", "jonathan");
  timed(6, 20, 0, 60, "TBC out BC event", "jonathan");
  timed(7, 15, 0, 60, "Behavioral health – Tara", "kids");
  allDay(8, 1, "Trash day", "family");
  allDay(8, 1, "NorthWestern Energy due", "bills");
  timed(8, 16, 0, 45, "Speech therapy", "kids");
  timed(9, 16, 0, 90, "Steepworld projection", "jonathan");
  timed(9, 20, 0, 60, "Budget meeting", "family");
  allDay(11, 4, "MFBF 15–18", "jonathan");
  allDay(11, 1, "Mortgage payment", "bills");
  allDay(15, 1, "Trash day", "family");
  allDay(16, 1, "Progressive auto pay", "bills");
  allDay(17, 8, "California trip", "family");
  allDay(22, 3, "No school", "kids");
  timed(22, 16, 0, 45, "Speech therapy", "kids");
  allDay(23, 1, "Thanksgiving", "family");
  return { events: ev.sort((a, b) => (a.start < b.start ? -1 : 1)), calendars: CALS, updatedAt: Date.now() };
}

export function demoEntities(): HaEntity[] {
  const now = Date.now();
  const e = (id: string, state: string, name: string, minsAgo: number, attrs: HaEntity["attrs"] = {}): HaEntity => ({
    id,
    state,
    name,
    changed: now - minsAgo * 60000,
    attrs
  });
  return [
    e("person.jonathan", "home", "Jonathan", 180),
    e("person.lacey", "home", "Lacey", 95),
    e("device_tracker.onyx", "not_home", "Onyx", 40),
    e("device_tracker.falcon", "home", "Falcon", 300),
    e("lock.front_door", "unlocked", "Front Door", 24),
    e("lock.side_door", "locked", "Side Door", 400),
    e("cover.garage_door", "closed", "Garage Door", 70),
    e("binary_sensor.back_door", "off", "Back Door", 200),
    e("climate.thermostat", "heat", "Thermostat", 30, { current_temperature: 69, temperature: 70, hvac_action: "heating" }),
    e("sensor.outdoor_aqi", "38", "Air Quality", 10, { unit_of_measurement: "AQI" }),
    e("media_player.living_room_tv", "playing", "Living Room TV", 12, {
      media_title: "The Great British Bake Off",
      media_series_title: "Bread Week",
      app_name: "Netflix",
      media_content_type: "tvshow"
    }),
    e("media_player.kitchen", "playing", "Kitchen Speaker", 3, {
      media_title: "Here Comes the Sun",
      media_artist: "The Beatles",
      app_name: "Spotify",
      media_content_type: "music"
    }),
    e("input_boolean.denboard_guest_mode", "off", "Guest mode", 1000)
  ];
}

export function demoHouseConfig(config: DenBoardConfig): DenBoardConfig {
  if (config.homeAssistant.people.length || config.homeAssistant.tiles.length) return config;
  return {
    ...config,
    homeAssistant: {
      ...config.homeAssistant,
      people: [
        { entity: "person.jonathan", name: "Jonathan" },
        { entity: "person.lacey", name: "Lacey" },
        { entity: "device_tracker.onyx", name: "Onyx" },
        { entity: "device_tracker.falcon", name: "Falcon" }
      ],
      tiles: [
        { entity: "lock.front_door", name: "Front Door", kind: "lock" },
        { entity: "lock.side_door", name: "Side Door", kind: "lock" },
        { entity: "cover.garage_door", name: "Garage", kind: "garage", alertAfterMinutes: 15 },
        { entity: "binary_sensor.back_door", name: "Back Door", kind: "door" },
        { entity: "climate.thermostat", name: "Inside", kind: "climate", guestVisible: true },
        { entity: "sensor.outdoor_aqi", name: "Air Quality", kind: "sensor", guestVisible: true }
      ]
    }
  };
}
