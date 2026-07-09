import type { WeatherOverlay } from "./weather";

export type WeatherConditionKey =
  | "rain"
  | "snow"
  | "storm"
  | "cloudy"
  | "clear"
  | "other";

export function currentConditionKey(
  code?: number | string | null
): WeatherConditionKey {
  if (code == null) return "other";
  const k = typeof code === "string" ? code.toLowerCase() : "";
  if (["rain", "rainy", "pouring"].includes(k)) return "rain";
  if (["snow", "snowy"].includes(k)) return "snow";
  if (["storm", "lightning", "lightning-rainy"].includes(k)) return "storm";
  if (["cloudy", "overcast", "partlycloudy", "partly cloudy"].includes(k))
    return "cloudy";
  if (["clear", "sunny", "clear-night"].includes(k)) return "clear";
  if (typeof code === "number") {
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "rain";
    if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
    if ([95, 96, 99].includes(code)) return "storm";
    if ([45, 48].includes(code)) return "cloudy";
    if (code === 0) return "clear";
  }
  return "other";
}

export function overlayToConditionKey(
  overlay: WeatherOverlay | null | undefined
): WeatherConditionKey {
  if (!overlay || overlay === "clear") return "clear";
  if (overlay === "rain" || overlay === "snow" || overlay === "storm" || overlay === "cloudy")
    return overlay;
  return "other";
}

export function weatherIcon(code?: number | string | null): string {
  if (code === undefined || code === null) return "⛰";
  if (typeof code === "string") {
    const k = code.toLowerCase();
    if (["rain", "rainy", "pouring"].includes(k)) return "🌧";
    if (["snow", "snowy"].includes(k)) return "🌨";
    if (["storm", "lightning", "lightning-rainy"].includes(k)) return "⛈";
    if (["cloudy", "overcast"].includes(k)) return "☁️";
    if (["clear", "sunny"].includes(k)) return "☀️";
    if (k === "clear-night") return "🌙";
    if (["partlycloudy", "partly cloudy"].includes(k)) return "🌤";
    if (k.includes("cloud")) return "☁️";
    if (k.includes("clear")) return "☀️";
    return iconForConditionKey(currentConditionKey(code));
  }
  const n = code;
  if (n === 0) return "☀️";
  if ([1, 2, 3].includes(n)) return "🌤";
  return iconForConditionKey(currentConditionKey(n));
}

/** Emoji by normalized condition key (used when only overlay is known). */
export function iconForConditionKey(kind: WeatherConditionKey): string {
  switch (kind) {
    case "rain":
      return "🌧";
    case "snow":
      return "🌨";
    case "storm":
      return "⛈";
    case "cloudy":
      return "☁️";
    case "clear":
      return "☀️";
    default:
      return "⛰";
  }
}

export type IconMotion = {
  animate: Record<string, number | number[]>;
  transition: {
    duration: number;
    repeat: number;
    ease: "easeInOut";
  };
};

const NO_MOTION: IconMotion = {
  animate: { opacity: 1 },
  transition: { duration: 0.01, repeat: 0, ease: "easeInOut" }
};

export function iconAnimationForCondition(
  kind: WeatherConditionKey,
  enabled = true
): IconMotion {
  if (!enabled) return NO_MOTION;
  switch (kind) {
    case "rain":
      return {
        animate: { y: [0, 3, 0], opacity: [0.94, 1, 0.94] },
        transition: { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
      };
    case "snow":
      return {
        animate: { y: [0, 2, 0], rotate: [0, 2, -2, 0] },
        transition: { duration: 3.2, repeat: Infinity, ease: "easeInOut" }
      };
    case "storm":
      return {
        animate: { scale: [1, 1.05, 1], opacity: [0.92, 1, 0.92] },
        transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" }
      };
    case "cloudy":
      return {
        animate: { x: [0, 2, 0] },
        transition: { duration: 4, repeat: Infinity, ease: "easeInOut" }
      };
    case "clear":
      return {
        animate: { rotate: [0, 4, 0], scale: [1, 1.02, 1] },
        transition: { duration: 5, repeat: Infinity, ease: "easeInOut" }
      };
    default:
      return {
        animate: { opacity: [0.96, 1, 0.96] },
        transition: { duration: 3.5, repeat: Infinity, ease: "easeInOut" }
      };
  }
}

export function formatWeatherTemp(
  temp: number | null | undefined,
  units?: "imperial" | "metric" | null
): string {
  if (temp == null || !Number.isFinite(temp)) return "–°";
  const n = Math.round(temp);
  return `${n}${units === "metric" ? "℃" : "°"}`;
}

export function formatForecastTemp(
  temp: number,
  units?: "imperial" | "metric" | null
): string {
  const n = Math.round(temp);
  const sym = units === "metric" ? "℃" : "℉";
  return `${n}${sym}`;
}

export const OVERLAY_LABEL: Record<NonNullable<WeatherOverlay>, string> = {
  rain: "Rain passing through",
  snow: "Snow in the air",
  cloudy: "Clouds overhead",
  storm: "Storm conditions",
  clear: "Clear skies"
};
