import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function TvLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer variant="hotel">
      <main
        data-orientation="landscape"
        className="min-h-screen flex flex-col"
        style={{
          padding: "clamp(24px, 3vmin, 64px)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}
