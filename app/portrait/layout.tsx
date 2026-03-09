import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function PortraitLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main
        data-orientation="portrait"
        className="min-h-screen flex flex-col"
        style={{
          padding: "var(--denboard-scale-space-xl) var(--denboard-scale-space-lg)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}

