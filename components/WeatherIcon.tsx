import type { WeatherKind } from "@/lib/types";

const CLOUD = "M19 50h28a12 12 0 0 0 1.5-23.9A16 16 0 0 0 18.2 22 13 13 0 0 0 19 50z";

function Sun({ cx = 32, cy = 32, r = 11 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g className="wx-sun">
      <g className="wx-rays" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={cx + Math.cos(a) * (r + 5)}
              y1={cy + Math.sin(a) * (r + 5)}
              x2={cx + Math.cos(a) * (r + 10)}
              y2={cy + Math.sin(a) * (r + 10)}
              stroke="#FFC94A"
              strokeWidth={3.2}
              strokeLinecap="round"
            />
          );
        })}
      </g>
      <circle cx={cx} cy={cy} r={r} fill="#FFC94A" />
    </g>
  );
}

function Moon({ cx = 32, cy = 30, r = 13 }: { cx?: number; cy?: number; r?: number }) {
  return (
    <g>
      <mask id={`moon-${cx}-${cy}`}>
        <rect width="64" height="64" fill="#fff" />
        <circle cx={cx + r * 0.55} cy={cy - r * 0.35} r={r * 0.9} fill="#000" />
      </mask>
      <circle cx={cx} cy={cy} r={r} fill="#E6ECFF" mask={`url(#moon-${cx}-${cy})`} />
    </g>
  );
}

function Cloud({ dark = false, y = 0 }: { dark?: boolean; y?: number }) {
  return <path d={CLOUD} transform={`translate(0 ${y})`} fill={dark ? "#8C97AD" : "#E3EAF6"} className="wx-cloud" />;
}

export function WeatherIcon({
  kind,
  isDay = true,
  size = 64,
  animate = true
}: {
  kind: WeatherKind;
  isDay?: boolean;
  size?: number;
  animate?: boolean;
}) {
  let body: React.ReactNode;
  switch (kind) {
    case "clear":
      body = isDay ? <Sun /> : <Moon />;
      break;
    case "partly":
      body = (
        <>
          {isDay ? <Sun cx={24} cy={22} r={9} /> : <Moon cx={24} cy={20} r={10} />}
          <Cloud y={6} />
        </>
      );
      break;
    case "cloudy":
      body = (
        <>
          <path d={CLOUD} transform="translate(10 -8) scale(.75)" fill="#A9B4C8" />
          <Cloud y={2} />
        </>
      );
      break;
    case "fog":
      body = (
        <>
          <Cloud y={-6} />
          {[48, 54, 60].map((y, i) => (
            <line key={y} x1={12 + i * 3} x2={52 - i * 2} y1={y} y2={y} stroke="#C9D2E2" strokeWidth={3} strokeLinecap="round" className="wx-fog" style={{ animationDelay: `${i * 0.6}s` }} />
          ))}
        </>
      );
      break;
    case "drizzle":
    case "rain":
      body = (
        <>
          <Cloud dark={kind === "rain"} y={-8} />
          {[22, 32, 42].map((x, i) => (
            <line key={x} x1={x} x2={x - 3} y1={48} y2={56} stroke="#5BB8FF" strokeWidth={kind === "rain" ? 3.2 : 2.4} strokeLinecap="round" className="wx-drop" style={{ animationDelay: `${i * 0.25}s` }} />
          ))}
        </>
      );
      break;
    case "snow":
      body = (
        <>
          <Cloud y={-8} />
          {[22, 32, 42].map((x, i) => (
            <circle key={x} cx={x} cy={52} r={2.6} fill="#FFFFFF" className="wx-flake" style={{ animationDelay: `${i * 0.5}s` }} />
          ))}
        </>
      );
      break;
    case "storm":
      body = (
        <>
          <Cloud dark y={-8} />
          <path d="M34 42l-8 11h7l-4 9 11-13h-7l4-7z" fill="#FFD84A" className="wx-bolt" />
        </>
      );
      break;
  }
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={animate ? "wx wx-anim" : "wx"} aria-hidden>
      {body}
    </svg>
  );
}
