'use client';

import { usePathname } from "next/navigation";
import { useGuestMode } from "@/components/HomeAssistantStatus";

export function FooterBar() {
  const pathname = usePathname();
  const forcedGuest = pathname.startsWith("/tv/guest");
  const { guestMode } = useGuestMode();

  const isGuest = forcedGuest || guestMode;

  return (
    <div className="w-full h-6 flex items-center justify-center gap-4 text-[10px] tracking-wide denboard-text-secondary">
      <span>DenBoard © OkamiDesigns</span>
      {isGuest && (
        <span className="text-sandstone/85 uppercase tracking-[0.2em]">
          Guest Mode
        </span>
      )}
    </div>
  );
}

