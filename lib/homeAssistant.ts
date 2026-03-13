import { getConfig } from "./config";
import { fetchWithRetry } from "./fetchWithRetry";
import { loadSettings } from "./settings";
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
  const settings = await loadSettings();

  const baseUrlRaw =
    (settings.homeAssistant?.baseUrl || "").trim() ||
    (config.homeAssistantUrl || "").trim();
  const baseUrl = baseUrlRaw
    ? /^https?:\/\//i.test(baseUrlRaw)
      ? baseUrlRaw
      : `http://${baseUrlRaw}`
    : "";
  const token = config.homeAssistantToken;
  const guestModeEntityId =
    settings.homeAssistant?.guestModeEntityId?.trim() ||
    config.guestModeEntityId;
  const entityList =
    settings.homeAssistant?.entities != null
      ? settings.homeAssistant.entities
      : config.homeAssistantEntities;

  if (!baseUrl || !token) {
    return {
      guestMode: false,
      entities: [],
      isFallback: true
    };
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  try {
    const [guestRaw, ...entityRaw] = await Promise.all([
      fetchEntitySoft(baseUrl, guestModeEntityId, headers),
      ...entityList.map((e) => fetchEntitySoft(baseUrl, e.id, headers))
    ]);

    const guestMode =
      String((guestRaw as { state?: string } | null)?.state ?? "off") === "on";

    const entities: HomeAssistantEntityState[] = entityList
      .map((rawData, idx) => {
        const data = entityRaw[idx];
        if (data == null) return null;
        return {
          id: rawData.id,
          label: rawData.label,
          state: String((data as { state?: string })?.state ?? "unknown"),
          attributes: ((data as { attributes?: Record<string, unknown> })
            ?.attributes ?? {})
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

