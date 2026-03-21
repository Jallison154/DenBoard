import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function PortraitLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main
        data-orientation="portrait"
        className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden"
        style={{
          padding: "var(--denboard-scale-space-xl) var(--denboard-scale-space-lg)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}

