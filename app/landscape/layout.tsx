import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

/** Same shell as `/tv` so guest (hotel) and family landscape share one frame; family page pins content to the top. */
export default function LandscapeLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer variant="hotel">
      <main
        data-orientation="landscape"
        className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden"
        style={{
          padding: "clamp(24px, 3vmin, 64px)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}

