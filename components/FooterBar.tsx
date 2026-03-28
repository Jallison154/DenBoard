'use client';

import { usePathname } from "next/navigation";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useGuestMode } from "@/components/HomeAssistantStatus";

export function FooterBar() {
  const { kiosk } = useDisplayMode();
  const pathname = usePathname();
  const forcedGuest = pathname.startsWith("/landscape/guest");
  const { guestMode, payload } = useGuestMode();

  const isGuest = forcedGuest || guestMode;
  const haConnected = Boolean(payload && !payload.isFallback);

  if (kiosk) return null;

  return (
    <div
      className="w-full flex items-center justify-center tracking-wide denboard-text-secondary denboard-scale-status"
      style={{
        height: "var(--denboard-scale-space-lg)",
        gap: "var(--denboard-scale-space-md)"
      }}
    >
      <span>DenBoard © OkamiDesigns</span>
      {payload?.isFallback && (
        <span className="text-amber-200/90 uppercase tracking-[0.2em]">HA offline</span>
      )}
      {haConnected && isGuest && (
        <span className="text-sandstone/85 uppercase tracking-[0.2em]">Guest Mode</span>
      )}
      {haConnected && !isGuest && (
        <span className="text-emerald-200/80 uppercase tracking-[0.2em]">Family Mode</span>
      )}
    </div>
  );
}

