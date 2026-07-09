"use client";

import { usePathname } from "next/navigation";
import { useDisplaySettings } from "./hooks";
import { WeatherFullscreenController } from "./WeatherFullscreenOverlay";

/** Fullscreen current-conditions overlay — landscape/TV/nest, not portrait (radar lives there). */
const FULLSCREEN_WEATHER_PREFIXES = ["/tv/", "/landscape/", "/nest/"];

export function WeatherExperienceLayer() {
  const pathname = usePathname();
  const display = useDisplaySettings();

  const onFullscreenRoute =
    !pathname.startsWith("/admin") &&
    FULLSCREEN_WEATHER_PREFIXES.some((p) => pathname.startsWith(p));

  if (!onFullscreenRoute) return null;

  return (
    <WeatherFullscreenController
      enabled={display.enableFullscreenWeatherOverlay}
      animationsEnabled={display.enableWeatherAnimations}
    />
  );
}
