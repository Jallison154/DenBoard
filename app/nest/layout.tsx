import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function NestLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main
        data-orientation="nest"
        className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden"
        style={{
          padding: "clamp(18px, 2.2vmin, 36px)"
        }}
      >
        {children}
      </main>
    </BackgroundLayer>
  );
}
