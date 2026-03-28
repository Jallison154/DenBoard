'use client';

import { usePathname } from "next/navigation";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useGuestMode } from "@/components/HomeAssistantStatus";

export function FooterBar() {
  const { kiosk } = useDisplayMode();
  const pathname = usePathname();
  const forcedGuest = pathname.startsWith("/landscape/guest");
  const { guestMode, payload, lastFetchedAt } = useGuestMode();

  const isGuest = forcedGuest || guestMode;
  const haConnected = Boolean(payload && !payload.isFallback);

  const updatedLabel =
    lastFetchedAt != null
      ? `Updated ${lastFetchedAt.toLocaleTimeString(undefined, {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit"
        })}`
      : "…";

  if (kiosk) return null;

  return (
    <div
      className="w-full flex items-center justify-between tracking-wide denboard-text-secondary denboard-scale-status px-4 sm:px-6 min-w-0"
      style={{
        height: "var(--denboard-scale-space-lg)",
        gap: "var(--denboard-scale-space-md)"
      }}
    >
      <span className="shrink-0 truncate">DenBoard © OkamiDesigns</span>
      <div className="flex items-center justify-end gap-3 sm:gap-4 shrink-0 min-w-0">
        {payload?.isFallback && (
          <span className="text-amber-200/90 uppercase tracking-[0.2em]">HA offline</span>
        )}
        {haConnected && isGuest && (
          <span className="text-sandstone/85 uppercase tracking-[0.2em]">Guest Mode</span>
        )}
        {haConnected && !isGuest && (
          <span className="text-emerald-200/80 uppercase tracking-[0.2em]">Family Mode</span>
        )}
        <span
          className="tabular-nums opacity-90 denboard-scale-status"
          title="Last successful Home Assistant refresh"
        >
          {updatedLabel}
        </span>
      </div>
    </div>
  );
}

