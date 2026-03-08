import { DateTime } from "luxon";
import { getConfig } from "./config";

export function getGreeting(dt: DateTime): string {
  const hour = dt.hour;
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export function nowInDashboardTz(): DateTime {
  const { timezone } = getConfig();
  return DateTime.now().setZone(timezone);
}

export type DayCell = {
  date: DateTime;
  isToday: boolean;
  isCurrentMonth: boolean;
};

export function buildFourWeekGrid(reference: DateTime): DayCell[] {
  // Sunday = first day of week (US convention). Luxon weekday: 1=Mon..7=Sun.
  // Go back to the most recent Sunday.
  const daysBackToSunday = reference.weekday % 7; // Sun=0, Mon=1..Sat=6
  const startOfWeek = reference.minus({ days: daysBackToSunday }).startOf("day");
  const cells: DayCell[] = [];

  for (let i = 0; i < 28; i += 1) {
    const date = startOfWeek.plus({ days: i });
    cells.push({
      date,
      isToday: date.hasSame(reference, "day"),
      isCurrentMonth: date.month === reference.month
    });
  }

  return cells;
}

