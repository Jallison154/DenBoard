import { DateTime } from "luxon";
import { getConfig } from "./config";

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
  const startOfWeek = reference.startOf("week");
  const start = startOfWeek.minus({ weeks: 1 });
  const cells: DayCell[] = [];

  for (let i = 0; i < 28; i += 1) {
    const date = start.plus({ days: i });
    cells.push({
      date,
      isToday: date.hasSame(reference, "day"),
      isCurrentMonth: date.month === reference.month
    });
  }

  return cells;
}

