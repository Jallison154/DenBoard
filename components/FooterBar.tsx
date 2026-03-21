'use client';

import { usePathname } from "next/navigation";
import { useDisplayMode } from "@/contexts/DisplayModeContext";
import { useGuestMode } from "@/components/HomeAssistantStatus";

export function FooterBar() {
  const { kiosk } = useDisplayMode();
  const pathname = usePathname();
  const forcedGuest = pathname.startsWith("/landscape/guest");
  const { guestMode } = useGuestMode();

  const isGuest = forcedGuest || guestMode;

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
      {isGuest && (
        <span className="text-sandstone/85 uppercase tracking-[0.2em]">
          Guest Mode
        </span>
      )}
    </div>
  );
}

