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

/** Seasonal and major holiday search terms for Unsplash (time of year). */
function getSeasonalQuery(now: DateTime): string {
  const month = now.month;
  const day = now.day;
  const terms: string[] = [];

  if (month === 1) {
    if (day <= 2) terms.push("new year winter celebration");
    else terms.push("winter snow landscape");
  } else if (month === 2) terms.push("valentines winter romance");
  else if (month === 3) terms.push("spring landscape nature");
  else if (month === 4) terms.push("easter spring blossoms");
  else if (month === 5) terms.push("spring flowers landscape");
  else if (month === 6) terms.push("summer landscape nature");
  else if (month === 7) terms.push("independence day summer american");
  else if (month === 8) terms.push("summer landscape mountains");
  else if (month === 9) terms.push("autumn fall landscape");
  else if (month === 10) terms.push("halloween autumn fall");
  else if (month === 11) terms.push("thanksgiving autumn fall");
  else if (month === 12) terms.push("christmas winter holiday snow");

  return terms.length > 0 ? terms.join(" ") : "seasonal landscape";
}

function isValidImageUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith("https") && url.length > 10;
}

export async function getBackground(weather: WeatherPayload | null): Promise<BackgroundPayload> {
  const cached = getFromCache<BackgroundPayload>(BACKGROUND_CACHE_KEY);
  if (cached) return cached;

  const config = getConfig();
  const now = DateTime.now().setZone(config.timezone);
  const timeOfDay = describeTimeOfDay(now);
  const seasonal = getSeasonalQuery(now);

  const condition = weather?.conditionText?.toLowerCase() ?? "mountain";
  const terms = [timeOfDay, condition, seasonal, "mountain landscape", "calm", "minimal"].filter(Boolean).join(" ");

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
    const rawUrl = data?.urls?.regular ?? data?.urls?.full ?? data?.urls?.raw ?? null;
    const imageUrl: string | null = isValidImageUrl(rawUrl) ? rawUrl : null;
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

