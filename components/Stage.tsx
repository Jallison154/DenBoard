"use client";

import { useEffect, useState } from "react";

/**
 * Renders children on a fixed logical canvas (e.g. 1080×1920) scaled to fit the screen.
 * Layout is designed once in canvas pixels and looks identical on a 4K TV, a 1080p TV, or a
 * laptop preview. Also nudges the whole canvas by a few pixels every few minutes so static
 * edges don't burn in on always-on panels.
 */
export function Stage({
  width,
  height,
  dim = 0,
  children
}: {
  width: number;
  height: number;
  /** 0 = full brightness, 0.6 = 60% darker */
  dim?: number;
  children: React.ReactNode;
}) {
  const [scale, setScale] = useState(0);
  const [shift, setShift] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / width, window.innerHeight / height));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [width, height]);

  useEffect(() => {
    const steps = [
      { x: 0, y: 0 },
      { x: 3, y: 2 },
      { x: -2, y: 3 },
      { x: -3, y: -2 },
      { x: 2, y: -3 }
    ];
    let i = 0;
    const t = setInterval(() => setShift(steps[++i % steps.length]), 4 * 60_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="stage-outer">
      <div
        className="stage"
        style={{
          width,
          height,
          transform: `translate(-50%, -50%) translate(${shift.x}px, ${shift.y}px) scale(${scale})`,
          opacity: scale ? 1 : 0
        }}
      >
        {children}
        {dim > 0 && <div className="dimmer" style={{ opacity: dim }} />}
      </div>
    </div>
  );
}
