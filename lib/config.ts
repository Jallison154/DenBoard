export type WeatherBackgroundRotation = {
  /** milliseconds */
  intervalMs: number;
};

export type RefreshIntervals = {
  weatherMs: number;
  homeAssistantMs: number;
  calendarMs: number;
  dadJokeMs: number;
};

export type HomeAssistantEntity = {
  id: string;
  label: string;
  icon?: string;
};

export type DenBoardConfig = {
  lat: number;
  lon: number;
  timezone: string;
  weatherUnits: "imperial" | "metric";
  unsplashAccessKey?: string;
  gcalIcsUrl?: string;
  homeAssistantUrl?: string;
  homeAssistantToken?: string;
  guestModeEntityId: string;
  refresh: RefreshIntervals;
  backgroundRotation: WeatherBackgroundRotation;
  homeAssistantEntities: HomeAssistantEntity[];
  calendarMaxEventsPerCell: number;
};

const minutes = (n: number) => n * 60 * 1000;
const seconds = (n: number) => n * 1000;

export function getConfig(): DenBoardConfig {
  const lat = Number(process.env.DASHBOARD_LAT ?? "39.7392");
  const lon = Number(process.env.DASHBOARD_LON ?? "-104.9903");
  const weatherUnitsEnv = (process.env.WEATHER_UNITS || "imperial").toLowerCase();
  const weatherUnits: "imperial" | "metric" =
    weatherUnitsEnv === "metric" ? "metric" : "imperial";

  return {
    lat,
    lon,
    timezone: process.env.DASHBOARD_TZ || "America/Denver",
    weatherUnits,
    unsplashAccessKey: process.env.UNSPLASH_ACCESS_KEY,
    gcalIcsUrl: process.env.GCAL_ICS_URL,
    homeAssistantUrl: process.env.HOME_ASSISTANT_URL,
    homeAssistantToken: process.env.HOME_ASSISTANT_TOKEN,
    guestModeEntityId: "input_boolean.denboard_guest_mode",
    refresh: {
      weatherMs: minutes(6),
      homeAssistantMs: seconds(10),
      calendarMs: minutes(5),
      dadJokeMs: minutes(45)
    },
    backgroundRotation: {
      intervalMs: minutes(45)
    },
    homeAssistantEntities: [
      { id: "sensor.denboard_internet_status", label: "Internet" },
      { id: "sensor.power_status", label: "Power" },
      { id: "binary_sensor.front_door", label: "Front Door" },
      { id: "sensor.living_room_temperature", label: "Living Temp" }
    ],
    calendarMaxEventsPerCell: 3
  };
}

