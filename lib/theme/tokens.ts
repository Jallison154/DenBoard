/**
 * DenBoard theme tokens – central control for brightness and readability.
 * Change these values to brighten or darken the whole UI without editing components.
 *
 * Scaling: Base design 1920×1080 (landscape) / 1080×1920 (portrait).
 * Uses vmin for proportional scaling. Min sizes preserved for 8–12ft readability.
 */

export const themeTokens = {
  /** Scrim gradient opacity: left edge */
  scrimOpacityLeft: 0.18,
  /** Scrim gradient opacity: center */
  scrimOpacityCenter: 0.12,
  /** Scrim gradient opacity: right edge */
  scrimOpacityRight: 0.15,

  /** Card background (rgba) – lighter = brighter UI */
  cardBg: "rgba(45, 52, 60, 0.72)",
  /** Card border */
  cardBorder: "rgba(255, 255, 255, 0.14)",
  /** Nested/inner card background (e.g. forecast tiles, event blocks) */
  cardNestedBg: "rgba(30, 41, 59, 0.7)",
  /** Nested card border */
  cardNestedBorder: "rgba(255, 255, 255, 0.12)",

  /** Primary text – warm white for main content */
  textPrimary: "#f8f6f2",
  /** Secondary text – light gray for labels, metadata */
  textSecondary: "#c9c6c0",
  /** Tertiary/muted text */
  textMuted: "#9ca3af",

  /** Footer bar overlay */
  footerScrim: "rgba(0, 0, 0, 0.32)",

  /** Forecast tile: icon size (rem) – legible from 10ft */
  forecastIconSizeRem: 2.5,
  /** Forecast tile: high/low font size (rem) */
  forecastTempSizeRem: 1.5,
  /** Forecast tile: gap between items (rem) */
  forecastGapRem: 1.25,
  /** Forecast tile: padding block (rem) */
  forecastPaddingBlockRem: 1.25,
  /** Forecast tile: padding inline (rem) */
  forecastPaddingInlineRem: 1.5,
} as const;

/** Scaling: 1vmin ≈ 10.8px at 1080. clamp(min, preferred, max) preserves readability. */
const scalingVars = [
  /* Time – largest, min 80px */
  "--denboard-scale-time: clamp(80px, 11vmin, 200px)",
  /* Temperature – second largest, min 28px */
  "--denboard-scale-temp: clamp(28px, 6.5vmin, 120px)",
  /* Date – medium */
  "--denboard-scale-date: clamp(20px, 2.8vmin, 48px)",
  /* Greeting – between date and time */
  "--denboard-scale-greeting: clamp(20px, 2.45vmin, 38px)",
  /* Calendar event – readable, min 18px */
  "--denboard-scale-calendar-event: clamp(18px, 2vmin, 32px)",
  /* Forecast temp – min 28px */
  "--denboard-scale-forecast-temp: clamp(28px, 2.5vmin, 48px)",
  /* Forecast icon */
  "--denboard-scale-forecast-icon: clamp(24px, 2.8vmin, 56px)",
  /* Status chips – smallest */
  "--denboard-scale-status: clamp(10px, 1.2vmin, 20px)",
  /* Spacing base – scales with viewport */
  "--denboard-scale-space: clamp(4px, 0.5vmin, 16px)",
  "--denboard-scale-space-md: clamp(8px, 1vmin, 24px)",
  "--denboard-scale-space-lg: clamp(16px, 2vmin, 48px)",
  "--denboard-scale-space-xl: clamp(24px, 3vmin, 64px)",
  /* Card padding */
  "--denboard-scale-card-padding: clamp(12px, 1.5vmin, 36px)",
  /* Gap between elements */
  "--denboard-scale-gap: clamp(6px, 0.8vmin, 20px)",
  "--denboard-scale-gap-lg: clamp(12px, 1.5vmin, 40px)",
  /* Calendar grid cell height – scales with viewport */
  "--denboard-scale-calendar-cell-height: clamp(72px, 9vmin, 140px)"
];

/** Generate :root CSS custom properties for injection into document */
export function toCssVars(): string {
  const vars = [
    ...scalingVars,
    `--denboard-scrim-left: ${themeTokens.scrimOpacityLeft}`,
    `--denboard-scrim-center: ${themeTokens.scrimOpacityCenter}`,
    `--denboard-scrim-right: ${themeTokens.scrimOpacityRight}`,
    `--denboard-card-bg: ${themeTokens.cardBg}`,
    `--denboard-card-border: ${themeTokens.cardBorder}`,
    `--denboard-card-nested-bg: ${themeTokens.cardNestedBg}`,
    `--denboard-card-nested-border: ${themeTokens.cardNestedBorder}`,
    `--denboard-text-primary: ${themeTokens.textPrimary}`,
    `--denboard-text-secondary: ${themeTokens.textSecondary}`,
    `--denboard-text-muted: ${themeTokens.textMuted}`,
    `--denboard-footer-scrim: ${themeTokens.footerScrim}`,
    `--denboard-forecast-icon-size: ${themeTokens.forecastIconSizeRem}rem`,
    `--denboard-forecast-temp-size: ${themeTokens.forecastTempSizeRem}rem`,
    `--denboard-forecast-gap: ${themeTokens.forecastGapRem}rem`,
    `--denboard-forecast-padding-block: ${themeTokens.forecastPaddingBlockRem}rem`,
    `--denboard-forecast-padding-inline: ${themeTokens.forecastPaddingInlineRem}rem`,
  ];
  return `:root{${vars.join(";")}}`;
}
