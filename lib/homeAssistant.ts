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

type SoftFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; kind: "404" | "http" | "network"; status?: number; message?: string };

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
 * Plain fetch for HA state — no per-entity logging (caller aggregates once per poll).
 */
async function fetchEntitySoft(
  baseUrl: string,
  entityId: string,
  headers: Record<string, string>
): Promise<SoftFetchResult> {
  const url = `${baseUrl}/api/states/${encodeURIComponent(entityId)}`;
  try {
    const res = await fetch(url, { headers });
    if (res.status === 404) {
      return { ok: false, kind: "404" };
    }
    if (!res.ok) {
      return { ok: false, kind: "http", status: res.status };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    return { ok: false, kind: "network", message: String(err) };
  }
}

function resultToData(r: SoftFetchResult): unknown | null {
  return r.ok ? r.data : null;
}

function logHaPollSummary(
  results: { entityId: string; r: SoftFetchResult }[]
): void {
  const failed404: string[] = [];
  const failedHttp: { entityId: string; status: number }[] = [];
  const failedNet: { entityId: string; message: string }[] = [];

  const push = (id: string, r: SoftFetchResult) => {
    if (r.ok) return;
    if (r.kind === "404") failed404.push(id);
    else if (r.kind === "http" && r.status != null)
      failedHttp.push({ entityId: id, status: r.status });
    else if (r.kind === "network")
      failedNet.push({ entityId: id, message: r.message ?? "unknown" });
  };

  for (const { entityId, r } of results) push(entityId, r);

  if (failedNet.length > 0) {
    const uniqueMsg = [...new Set(failedNet.map((f) => f.message))].slice(0, 2);
    logger.warn("Home Assistant: network errors during poll (transient if occasional)", {
      failedCount: failedNet.length,
      entitySample: failedNet.slice(0, 5).map((f) => f.entityId),
      errorsSample: uniqueMsg,
      hint:
        "Often DNS, TLS, HA restart, or Wi‑Fi blips. If this repeats constantly, check HA URL and connectivity from DenBoard."
    });
  }

  if (failedHttp.length > 0) {
    const byStatus = failedHttp.reduce<Record<number, string[]>>((acc, x) => {
      acc[x.status] = acc[x.status] || [];
      acc[x.status].push(x.entityId);
      return acc;
    }, {});
    logger.warn("Home Assistant: HTTP errors during poll", {
      byStatus,
      hint:
        "401/403: token. 409: entity conflict in HA. Other: check HA logs."
    });
  }

  if (failed404.length > 0) {
    logger.warn("Home Assistant: entity ID(s) not found (404)", {
      entityIds: failed404,
      hint: "Update or remove IDs in Admin → Home Assistant"
    });
  }

  const anyFailure = failed404.length + failedHttp.length + failedNet.length > 0;
  if (anyFailure) {
    logger.debug("Home Assistant poll detail", {
      okCount: results.length - failed404.length - failedHttp.length - failedNet.length,
      failed404: failed404.length,
      failedHttp: failedHttp.length,
      failedNetwork: failedNet.length
    });
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
    const guestPromise = fetchEntitySoft(baseUrl, guestModeEntityId, headers).then(
      (r) => ({ entityId: guestModeEntityId, r })
    );
    const entityPromises = entityList.map((e) =>
      fetchEntitySoft(baseUrl, e.id, headers).then((r) => ({ entityId: e.id, r }))
    );

    const allResults = await Promise.all([guestPromise, ...entityPromises]);
    logHaPollSummary(allResults);

    const guestRes = allResults[0].r;
    const entityResults = allResults.slice(1);

    const guestRaw = resultToData(guestRes);

    const guestMode =
      String((guestRaw as { state?: string } | null)?.state ?? "off") === "on";

    const entities: HomeAssistantEntityState[] = entityList
      .map((rawData, idx) => {
        const data = resultToData(entityResults[idx].r);
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

    const entityRaw = entityList.map((_, idx) => resultToData(entityResults[idx].r));

    const anyHaData =
      guestRaw != null || entityRaw.some((row) => row != null);
    const isFallback = !anyHaData;

    if (isFallback) {
      logger.warn(
        "Home Assistant returned no entity data; check token, URL, and entity IDs",
        { guestModeEntityId, entityCount: entityList.length }
      );
    }

    return {
      guestMode,
      entities,
      isFallback
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
