'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/admin", label: "Admin" },
  { href: "/landscape/home", label: "Landscape Home" },
  { href: "/landscape/guest", label: "Landscape Guest" },
  { href: "/landscape/weather", label: "Landscape Weather" },
  { href: "/landscape/status", label: "Landscape Status" },
  { href: "/portrait/home", label: "Portrait Home" },
  { href: "/portrait/calendar", label: "Portrait Calendar" },
  { href: "/portrait/status", label: "Portrait Status" },
];

const IDLE_MS = 5000;

function GearIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 0 0-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 0 0-2.282.819l-.922 1.597a1.875 1.875 0 0 0 .432 2.385l1.012.67c.031.02.062.039.095.067.078.077.155.154.233.231.027.033.047.064.067.095l.67 1.013a1.875 1.875 0 0 0 2.385.432l1.598-.922a1.875 1.875 0 0 0 .818-2.282l-.153-.431a.712.712 0 0 1 .084-.45 7.493 7.493 0 0 0 .57-.986c.088-.182.227-.277.347-.297l1.072-.178c.904-.151 1.567-.933 1.567-1.85V3.329c0-.917-.663-1.699-1.567-1.85l-1.072-.178a.712.712 0 0 1-.347-.297 7.493 7.493 0 0 0-.57-.986.712.712 0 0 1-.084-.45l.153-.431a1.875 1.875 0 0 0-.818-2.282l-1.598-.922a1.875 1.875 0 0 0-2.385.432l-.67 1.012a.712.712 0 0 1-.067.095 7.493 7.493 0 0 0-.233.231.712.712 0 0 1-.095.067l-.67 1.012a1.875 1.875 0 0 0 .432 2.385l1.598.922c.146.084.218.209.218.327 0 .018 0 .036-.002.054l-.178 1.072c-.151.904-.933 1.567-1.85 1.567ZM12 15.75a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function FloatingNav() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isHoverDevice, setIsHoverDevice] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();

  const scheduleHide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setVisible(false);
      setExpanded(false);
      timeoutRef.current = null;
    }, IDLE_MS);
  }, []);

  const handleMouseMove = useCallback(() => {
    if (!isHoverDevice) return;
    setVisible(true);
    scheduleHide();
  }, [isHoverDevice, scheduleHide]);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => !prev);
    scheduleHide();
  }, [scheduleHide]);

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
      className={`denboard-floating-nav fixed top-4 right-4 z-50 flex flex-col items-end gap-2 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
      onMouseEnter={() => {
        setVisible(true);
        scheduleHide();
      }}
      onMouseMove={scheduleHide}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        className="flex h-10 w-10 items-center justify-center rounded-xl denboard-card shadow-xl denboard-text-secondary hover:denboard-text-primary transition-colors"
        aria-label={expanded ? "Close menu" : "Open menu"}
        aria-expanded={expanded}
      >
        <GearIcon className="h-5 w-5" />
      </button>

      {expanded && (
        <div
          className="rounded-2xl denboard-card px-4 py-3 shadow-xl overflow-hidden"
          onMouseMove={scheduleHide}
        >
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setExpanded(false)}
                  className={`text-sm px-3 py-1.5 rounded-lg transition-colors block ${
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
      )}
    </nav>
  );
}
