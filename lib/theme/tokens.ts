/**
 * DenBoard theme tokens – central control for brightness and readability.
 * Change these values to brighten or darken the whole UI without editing components.
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

  /** Forecast tile: icon size (Tailwind text-*) */
  forecastIconSize: "text-3xl",
  /** Forecast tile: high/low font size */
  forecastTempSize: "text-base",
  /** Forecast tile: gap between items */
  forecastGap: "gap-3",
  /** Forecast tile: padding */
  forecastPadding: "px-4 py-3",
} as const;

/** Generate :root CSS custom properties for injection into document */
export function toCssVars(): string {
  const vars = [
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
  ];
  return `:root{${vars.join(";")}}`;
}
