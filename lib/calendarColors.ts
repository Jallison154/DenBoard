/** Vibrant colors for calendar events – distinguishable on dark backgrounds */
const CALENDAR_COLOR_PALETTE = [
  "#3B82F6", "#F59E0B", "#22C55E", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#F97316", "#84CC16", "#6366F1",
  "#14B8A6", "#E11D48", "#FBBF24", "#10B981"
];

/** Returns a random calendar color from a palette of readable hex colors */
export function getRandomCalendarColor(): string {
  return CALENDAR_COLOR_PALETTE[
    Math.floor(Math.random() * CALENDAR_COLOR_PALETTE.length)
  ];
}
