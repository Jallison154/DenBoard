import { DateTime } from "luxon";
import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { logger } from "./logging";
import { describeTimeOfDay, WeatherPayload } from "./weather";

export type BackgroundPayload = {
  imageUrl: string | null;
  attribution?: string;
  query: string;
  isFallback: boolean;
};

const BACKGROUND_CACHE_KEY = "background:current";

export async function getBackground(weather: WeatherPayload | null): Promise<BackgroundPayload> {
  const cached = getFromCache<BackgroundPayload>(BACKGROUND_CACHE_KEY);
  if (cached) return cached;

  const config = getConfig();
  const now = DateTime.now().setZone(config.timezone);
  const timeOfDay = describeTimeOfDay(now);

  const condition = weather?.conditionText?.toLowerCase() ?? "mountain";
  const terms = [`${timeOfDay}`, condition, "mountain landscape", "calm", "minimal"].join(" ");

  if (!config.unsplashAccessKey) {
    const fallback: BackgroundPayload = {
      imageUrl: null,
      attribution: undefined,
      query: terms,
      isFallback: true
    };
    setInCache(BACKGROUND_CACHE_KEY, fallback, config.backgroundRotation.intervalMs);
    return fallback;
  }

  try {
    const url = new URL("https://api.unsplash.com/photos/random");
    url.searchParams.set("orientation", "landscape");
    url.searchParams.set("query", terms);

    const res = await fetchWithRetry(url.toString(), {
      headers: {
        Authorization: `Client-ID ${config.unsplashAccessKey}`,
        "Accept-Version": "v1"
      }
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error("Unsplash API error", {
        status: res.status,
        statusText: res.statusText,
        body: body.slice(0, 300)
      });
      if (res.status === 401) {
        logger.warn("Check UNSPLASH_ACCESS_KEY: use the Access Key from https://unsplash.com/oauth/applications");
      }
      throw new Error(`Unsplash API ${res.status}: ${res.statusText}`);
    }

    const data: any = await res.json();
    const imageUrl: string | null =
      data?.urls?.regular ?? data?.urls?.full ?? data?.urls?.raw ?? null;
    const attribution =
      data?.user?.name && data?.links?.html
        ? `Photo by ${data.user.name} on Unsplash`
        : undefined;

    const payload: BackgroundPayload = {
      imageUrl,
      attribution,
      query: terms,
      isFallback: !imageUrl
    };

    setInCache(BACKGROUND_CACHE_KEY, payload, config.backgroundRotation.intervalMs);
    return payload;
  } catch (error) {
    logger.error("Failed to load Unsplash background", { error: String(error) });
    const fallback: BackgroundPayload = {
      imageUrl: null,
      attribution: undefined,
      query: terms,
      isFallback: true
    };
    setInCache(BACKGROUND_CACHE_KEY, fallback, 60_000);
    return fallback;
  }
}

