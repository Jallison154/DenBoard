import { fetchWithRetry } from "./fetchWithRetry";
import { getFromCache, setInCache } from "./cache";
import { getConfig } from "./config";
import { logger } from "./logging";

export type DadJokePayload = {
  joke: string;
  isFallback: boolean;
};

const DAD_JOKE_CACHE_KEY = "dadjoke:current";

export async function getDadJoke(): Promise<DadJokePayload> {
  const cached = getFromCache<DadJokePayload>(DAD_JOKE_CACHE_KEY);
  if (cached) return cached;

  const config = getConfig();

  try {
    const res = await fetchWithRetry("https://icanhazdadjoke.com/", {
      headers: {
        Accept: "application/json",
        "User-Agent": "DenBoard (https://github.com/okami-designs/denboard)"
      },
      next: { revalidate: 0 }
    });

    const data: any = await res.json();
    const joke: string = data?.joke ?? "Why don't mountains get cold? They wear snow caps.";

    const payload: DadJokePayload = {
      joke,
      isFallback: false
    };

    setInCache(DAD_JOKE_CACHE_KEY, payload, config.refresh.dadJokeMs);
    return payload;
  } catch (error) {
    logger.error("Failed to load dad joke", { error: String(error) });
    const fallback: DadJokePayload = {
      joke: "Couldn't load a dad joke right now.",
      isFallback: true
    };
    setInCache(DAD_JOKE_CACHE_KEY, fallback, 60_000);
    return fallback;
  }
}

