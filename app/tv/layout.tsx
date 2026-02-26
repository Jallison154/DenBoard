import type { ReactNode } from "react";
import { BackgroundLayer } from "@/components/BackgroundLayer";

export default function TvLayout({ children }: { children: ReactNode }) {
  return (
    <BackgroundLayer>
      <main className="min-h-screen px-8 py-10 md:px-12 md:py-12 lg:px-16 lg:py-14 flex flex-col">
        {children}
      </main>
    </BackgroundLayer>
  );
}

