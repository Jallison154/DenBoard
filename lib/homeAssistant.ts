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

export async function getHomeAssistantState(): Promise<HomeAssistantPayload> {
  const config = getConfig();

  if (!config.homeAssistantUrl || !config.homeAssistantToken) {
    return {
      guestMode: false,
      entities: [],
      isFallback: true
    };
  }

  const baseUrl = config.homeAssistantUrl.replace(/\/+$/, "");

  const headers = {
    Authorization: `Bearer ${config.homeAssistantToken}`,
    "Content-Type": "application/json"
  };

  async function getEntity(id: string) {
    const url = `${baseUrl}/api/states/${encodeURIComponent(id)}`;
    const res = await fetchWithRetry(url, { headers, next: { revalidate: 0 } });
    return res.json();
  }

  try {
    const guestPromise = getEntity(config.guestModeEntityId);
    const entityPromises = config.homeAssistantEntities.map((e) => getEntity(e.id));

    const [guestRaw, ...entityRaw] = await Promise.all([
      guestPromise,
      ...entityPromises
    ]);

    const guestMode = String(guestRaw?.state ?? "off") === "on";

    const entities: HomeAssistantEntityState[] = entityRaw.map((raw, idx) => ({
      id: config.homeAssistantEntities[idx].id,
      label: config.homeAssistantEntities[idx].label,
      state: String(raw?.state ?? "unknown"),
      attributes: raw?.attributes ?? {}
    }));

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

