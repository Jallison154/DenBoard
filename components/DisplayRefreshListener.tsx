"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const STORAGE_KEY = "denboard:refreshEpoch";
const POLL_MS = 8_000;

/**
 * Polls refresh epoch from admin; when it changes, reloads the page.
 * Skips /admin so the control panel does not reload when sending the signal.
 */
export function DisplayRefreshListener() {
  const pathname = usePathname();
  const skip = pathname === "/admin" || pathname?.startsWith("/admin/");

  useEffect(() => {
    if (skip) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch("/api/display/refresh", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { epoch?: number };
        const epoch =
          typeof data.epoch === "number" && Number.isFinite(data.epoch)
            ? data.epoch
            : 0;

        const prev = sessionStorage.getItem(STORAGE_KEY);
        if (prev === null) {
          sessionStorage.setItem(STORAGE_KEY, String(epoch));
          return;
        }
        if (Number(prev) !== epoch) {
          sessionStorage.setItem(STORAGE_KEY, String(epoch));
          window.location.reload();
        }
      } catch {
        /* offline or transient — next poll */
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [skip]);

  return null;
}
