'use client';

import { MotionConfig } from "framer-motion";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useState } from "react";
import { DisplayModeProvider, type DisplayModeValue } from "@/contexts/DisplayModeContext";

/**
 * Cast / Home Assistant iframe / kiosk shell:
 * - Sets `data-denboard-embed` on `<html>` when in kiosk mode.
 * - Framer Motion: reduced motion in kiosk (fewer interrupted transitions on cast).
 * - Provides DisplayModeContext (hide nav/footer, static background motion).
 *
 * Kiosk = /display/* | ?embed=1 | ?display=1 | iframe
 */
export function DisplayChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDisplayRoute = pathname.startsWith("/display");

  const [queryEmbed, setQueryEmbed] = useState(false);

  /**
   * Query flags only — we intentionally do NOT use `window.self !== window.top` here.
   * Some cast / embedded Chromium builds surface "Orphaned iframed" when touching `top`.
   * Use `?embed=1` or `?display=1` on the iframe URL, or the `/display/*` routes.
   */
  useLayoutEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const embedQ = params.get("embed");
    const displayQ = params.get("display");
    const byEmbedQuery = embedQ === "1" || embedQ === "true" || embedQ === "yes";
    const byDisplayQuery = displayQ === "1" || displayQ === "true" || displayQ === "yes";
    setQueryEmbed(byEmbedQuery || byDisplayQuery);
  }, [pathname]);

  const value = useMemo((): DisplayModeValue => {
    const kiosk = isDisplayRoute || queryEmbed;
    return {
      kiosk,
      isEmbed: queryEmbed,
      isDisplayRoute
    };
  }, [isDisplayRoute, queryEmbed]);

  useLayoutEffect(() => {
    if (value.kiosk) {
      document.documentElement.setAttribute("data-denboard-embed", "");
    } else {
      document.documentElement.removeAttribute("data-denboard-embed");
    }
  }, [value.kiosk]);

  return (
    <DisplayModeProvider value={value}>
      <MotionConfig reducedMotion={value.kiosk ? "always" : "user"}>{children}</MotionConfig>
    </DisplayModeProvider>
  );
}
