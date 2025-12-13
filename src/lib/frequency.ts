import { Frequency } from "@prisma/client";
import { addWeeks, addMonths, addQuarters, addYears } from "date-fns";

export function calculateNextDueDate(
  currentDate: Date,
  frequency: Frequency
): Date | null {
  switch (frequency) {
    case "WEEKLY":
      return addWeeks(currentDate, 1);
    case "BIWEEKLY":
      return addWeeks(currentDate, 2);
    case "MONTHLY":
      return addMonths(currentDate, 1);
    case "BIMONTHLY":
      return addMonths(currentDate, 2);
    case "QUARTERLY":
      return addQuarters(currentDate, 1);
    case "SEMIANNUAL":
      return addMonths(currentDate, 6);
    case "ANNUAL":
      return addYears(currentDate, 1);
    case "NONE":
    case "EVENTUAL":
    default:
      return null;
  }
}
