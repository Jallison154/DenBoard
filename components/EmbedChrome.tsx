'use client';

import { MotionConfig } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * Home Assistant iframe / Chromecast–friendly wrapper:
 * - Detects `?embed=1` (or `true` / `yes`) or running inside an iframe.
 * - Sets `data-denboard-embed` on `<html>` for CSS hooks.
 * - Forces Framer Motion reduced motion (lighter CPU on cast receivers).
 */
export function EmbedChrome({ children }: { children: React.ReactNode }) {
  const [embed, setEmbed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("embed");
    const byQuery = q === "1" || q === "true" || q === "yes";

    let inIframe = false;
    try {
      inIframe = window.self !== window.top;
    } catch {
      // Cross-origin parent: treat as embedded
      inIframe = true;
    }

    const isEmbed = byQuery || inIframe;
    setEmbed(isEmbed);

    if (isEmbed) {
      document.documentElement.setAttribute("data-denboard-embed", "");
    } else {
      document.documentElement.removeAttribute("data-denboard-embed");
    }
  }, []);

  return (
    <MotionConfig reducedMotion={embed ? "always" : "user"}>{children}</MotionConfig>
  );
}
