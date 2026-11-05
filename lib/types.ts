/** Types shared between the server hub and the browser. Nothing secret lives here. */

export type CalEvent = {
  id: string;
  title: string;
  /** ISO datetime for timed events, yyyy-MM-dd for all-day events */
  start: string;
  /** Exclusive end. ISO datetime, or yyyy-MM-dd for all-day */
  end: string;
  allDay: boolean;
  location?: string;
  calendar: string;
  color: string;
};

export type CalendarSlice = {
  events: CalEvent[];
  calendars: { id: string; name: string; color: string }[];
  updatedAt: number;
  error?: string;
};

export type WeatherKind =
  | "clear"
  | "partly"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "snow"
  | "storm";

export type WeatherSlice = {
  units: "imperial" | "metric";
  current: {
    temp: number;
    feelsLike: number;
    kind: WeatherKind;
    label: string;
    isDay: boolean;
    humidity: number;
    wind: number;
    precip: number;
  };
  hourly: { time: string; temp: number; kind: WeatherKind; isDay: boolean; pop: number }[];
  daily: {
    date: string;
    hi: number;
    lo: number;
    kind: WeatherKind;
    label: string;
    pop: number;
    sunrise: string;
    sunset: string;
  }[];
  /** True when precipitation is happening or likely within ~2 hours (drives radar). */
  precipSoon: boolean;
  alerts: { id: string; event: string; headline: string; severity: string; ends?: string }[];
  updatedAt: number;
};

export type RadarSlice = {
  /** Tile URL template with {z}/{x}/{y}; newest last */
  frames: { time: number; url: string }[];
  updatedAt: number;
};

export type FunItem = {
  kind: "joke" | "fact" | "history";
  text: string;
  /** For jokes split into setup/punchline */
  punchline?: string;
  meta?: string;
};

export type FunSlice = { items: FunItem[]; updatedAt: number };

export type HaEntity = {
  id: string;
  state: string;
  name: string;
  /** ms epoch of last state change */
  changed: number;
  attrs: Record<string, string | number | boolean | null>;
};

export type HouseTileKind = "lock" | "door" | "garage" | "window" | "climate" | "sensor" | "light" | "switch";

export type HouseConfigPublic = {
  people: { entity: string; name: string; picture?: string }[];
  tiles: {
    entity: string;
    name: string;
    kind: HouseTileKind;
    alertWhen: string[];
    alertAfterMinutes: number;
    guestVisible: boolean;
  }[];
  mediaPlayers: string[] | "auto";
  hideMediaPlayers: string[];
  guestModeEntity: string;
};

export type HaSlice = {
  connected: boolean;
  configured: boolean;
  entities: Record<string, HaEntity>;
};

export type DisplayConfigPublic = {
  timezone: string;
  locationName: string;
  lat: number;
  lon: number;
  guestWelcome: string;
  /** Calendar ids that guest screens may show */
  guestCalendars: string[];
  calendar: { gridMode: "rolling" | "month"; weeks: number; weekStartsOn: 0 | 1 };
  nightDim: { start: string; end: string; level: number } | null;
  funRotateSeconds: number;
  clock24h: boolean;
  house: HouseConfigPublic;
  demo: boolean;
};

export type Snapshot = {
  config: DisplayConfigPublic;
  calendar: CalendarSlice | null;
  weather: WeatherSlice | null;
  radar: RadarSlice | null;
  fun: FunSlice | null;
  ha: HaSlice;
  /** Bumped when config changes on disk, so screens reload themselves */
  epoch: number;
};

export type StreamMessage =
  | { type: "snapshot"; data: Snapshot }
  | { type: "calendar"; data: CalendarSlice }
  | { type: "weather"; data: WeatherSlice }
  | { type: "radar"; data: RadarSlice | null }
  | { type: "fun"; data: FunSlice }
  | { type: "ha"; data: { connected: boolean; changed: HaEntity[] } }
  | { type: "reload" };
