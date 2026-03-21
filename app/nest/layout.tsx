import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function NestLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main
        data-orientation="nest"
        className="flex min-h-0 w-full flex-1 flex-col items-stretch justify-start overflow-hidden"
        style={{
          padding: "clamp(6px, 1vmin, 12px) clamp(4px, 0.9vmin, 10px)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}
