export const MIN_CALENDAR_YEAR = 1900;
export const MAX_CALENDAR_YEAR = 2100;

type SearchValue = string | string[] | null | undefined;
export type CalendarSearch = { month?: SearchValue; year?: SearchValue; view?: SearchValue; archived?: SearchValue };

function scalar(value: SearchValue) {
  return Array.isArray(value) ? (value.length === 1 ? value[0] : undefined) : value;
}

function boundedInteger(value: SearchValue, min: number, max: number, fallback: number) {
  const raw = scalar(value);
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) return fallback;
  const number = Number(raw);
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : fallback;
}

export function resolveCalendarParams(params: CalendarSearch, now = new Date()) {
  return {
    month: boundedInteger(params.month, 0, 11, now.getMonth()),
    year: boundedInteger(params.year, MIN_CALENDAR_YEAR, MAX_CALENDAR_YEAR, now.getFullYear()),
    view: scalar(params.view) === "year" ? "year" as const : "month" as const,
    archived: scalar(params.archived) === "true",
  };
}
