import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

/**
 * Cast / Nest Hub–oriented shell: same chrome as /nest/* but URL path enables
 * kiosk mode without query params (see DisplayChrome + /docs/EMBEDDED-CAST.md).
 */
export default function DisplaySectionLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main
        data-orientation="nest"
        data-display-route="1"
        className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-center overflow-hidden"
        style={{
          padding: "clamp(6px, 1vmin, 12px) clamp(4px, 0.9vmin, 10px)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}
