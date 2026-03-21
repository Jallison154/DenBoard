import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function TvLayout({ children }: { children: ReactNode }) {
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
