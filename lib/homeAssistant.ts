import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { logger } from "./logging";

export type HomeAssistantEntityState = {
  id: string;
  label: string;
  state: string;
  attributes: Record<string, unknown>;
};

export type HomeAssistantPayload = {
  guestMode: boolean;
  entities: HomeAssistantEntityState[];
  isFallback: boolean;
};

/**
 * Fetch a single HA entity. Returns null on 404 (entity doesn't exist) to avoid
 * retries and log spam. Uses fetchWithRetry for transient failures.
 */
async function fetchEntity(
  baseUrl: string,
  entityId: string,
  headers: Record<string, string>
): Promise<unknown | null> {
  const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;
  try {
    const res = await fetchWithRetry(url, { headers, next: { revalidate: 0 } });
    return res.json();
  } catch (err) {
    if (String(err).includes("404")) {
      logger.warn("Home Assistant entity not found (404), skipping", {
        entityId,
        hint: "Check entity ID in Admin → Home Assistant or remove it"
      });
      return null;
    }
    throw err;
  }
}

/**
 * Fetch a single HA entity with plain fetch (no retries). Returns null on 404.
 * Use for entities that may not exist to avoid retry log spam.
 */
async function fetchEntitySoft(
  baseUrl: string,
  entityId: string,
  headers: Record<string, string>
): Promise<unknown | null> {
  const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;
  try {
    const res = await fetch(url, { headers });
    if (res.status === 404) {
      logger.warn("Home Assistant entity not found (404), skipping", {
        entityId,
        hint: "Update entity ID in Admin → Home Assistant or remove it"
      });
      return null;
    }
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return res.json();
  } catch (err) {
    return null;
  }
}

export async function getHomeAssistantState(): Promise<HomeAssistantPayload> {
  const config = getConfig();

  if (!config.homeAssistantUrl || !config.homeAssistantToken) {
    return {
      guestMode: false,
      entities: [],
      isFallback: true
    };
  }

  const raw = config.homeAssistantUrl.replace(/\/+$/, "");
  const baseUrl = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;

  const headers = {
    Authorization: `Bearer ${config.homeAssistantToken}`,
    "Content-Type": "application/json"
  };

  try {
    const [guestRaw, ...entityRaw] = await Promise.all([
      fetchEntitySoft(baseUrl, config.guestModeEntityId, headers),
      ...config.homeAssistantEntities.map((e) =>
        fetchEntitySoft(baseUrl, e.id, headers)
      )
    ]);

    const guestMode = String(guestRaw?.state ?? "off") === "on";

    const entities: HomeAssistantEntityState[] = config.homeAssistantEntities
      .map((rawData, idx) => {
        const data = entityRaw[idx];
        if (data == null) return null;
        return {
          id: config.homeAssistantEntities[idx].id,
          label: config.homeAssistantEntities[idx].label,
          state: String((data as { state?: string })?.state ?? "unknown"),
          attributes: ((data as { attributes?: Record<string, unknown> })?.attributes ?? {})
        };
      })
      .filter((e): e is HomeAssistantEntityState => e != null);

    return {
      guestMode,
      entities,
      isFallback: false
    };
  } catch (error) {
    logger.error("Failed to load Home Assistant state", { error: String(error) });
    return {
      guestMode: false,
      entities: [],
      isFallback: true
    };
  }
}

