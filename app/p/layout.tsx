import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function PortraitLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main className="min-h-screen px-5 py-8 md:px-6 md:py-10 flex flex-col">
        {children}
      </main>
    </BackgroundLayer>
  );
}

