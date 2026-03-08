'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin", label: "Admin" },
  { href: "/tv/home", label: "TV Home" },
  { href: "/tv/guest", label: "TV Guest" },
  { href: "/tv/weather", label: "TV Weather" },
  { href: "/tv/status", label: "TV Status" },
  { href: "/p/home", label: "Portrait Home" },
  { href: "/p/calendar", label: "Portrait Calendar" },
  { href: "/p/status", label: "Portrait Status" },
];

const IDLE_MS = 5000;

export function FloatingNav() {
  const [visible, setVisible] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const scheduleHide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      timeoutRef.current = null;
    }, IDLE_MS);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (!isHoverDevice) return;
    setVisible(true);
    scheduleHide();
  }, [isHoverDevice, scheduleHide]);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    setIsHoverDevice(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsHoverDevice(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!isHoverDevice) return;
    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isHoverDevice, handleMouseMove]);

  if (!isHoverDevice) return null;

  return (
    <nav
      className={`fixed top-4 right-4 z-50 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onMouseEnter={() => {
        setVisible(true);
        scheduleHide();
      }}
      onMouseMove={scheduleHide}
    >
      <div className="rounded-2xl denboard-card px-4 py-3 shadow-xl">
        <div className="flex flex-col gap-1.5 min-w-[140px]">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? "denboard-text-primary bg-white/10"
                    : "denboard-text-secondary hover:denboard-text-primary hover:bg-white/5"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
