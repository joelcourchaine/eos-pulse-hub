import {
  addDays,
  setDate,
  endOfMonth,
  endOfQuarter,
  startOfQuarter,
  addMonths,
  getDay,
  isBefore,
  isToday,
  startOfDay,
  format,
  lastDayOfMonth,
} from "date-fns";

export type Cadence = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

// Weekly: day of week (1=Monday, 7=Sunday)
export interface DayOfWeekConfig {
  type: "day_of_week";
  day: number; // 1-7 (Monday-Sunday)
}

// Monthly: specific day of month
export interface DayOfMonthConfig {
  type: "day_of_month";
  day: number | "last"; // 1-28 or "last"
}

// Monthly: last occurrence of a weekday (e.g., last Friday)
export interface LastWeekdayConfig {
  type: "last_weekday";
  weekday: number; // 1-7 (Monday-Sunday)
}

// Quarterly: last day of quarter
export interface DayOfQuarterLastConfig {
  type: "day_of_quarter";
  day: "last";
}

// Quarterly: specific day in a month of the quarter
export interface DayOfQuarterSpecificConfig {
  type: "day_of_quarter";
  month: number; // 1-3 (which month of quarter)
  dayOfMonth: number; // 1-31
}

export type DayOfQuarterConfig = DayOfQuarterLastConfig | DayOfQuarterSpecificConfig;

// Yearly: specific month and day
export interface SpecificDateConfig {
  type: "specific_date";
  month: number; // 1-12
  day: number; // 1-31
}

export type DueDayConfig =
  | DayOfWeekConfig
  | DayOfMonthConfig
  | LastWeekdayConfig
  | DayOfQuarterConfig
  | SpecificDateConfig;

const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * Get the last occurrence of a weekday in a month
 */
function getLastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const lastDay = lastDayOfMonth(new Date(year, month, 1));
  // Convert our weekday (1-7, Mon-Sun) to JS getDay (0-6, Sun-Sat)
  const targetDay = weekday === 7 ? 0 : weekday;
  const lastDayOfWeek = getDay(lastDay);
  
  let diff = lastDayOfWeek - targetDay;
  if (diff < 0) diff += 7;
  
  return addDays(lastDay, -diff);
}

/**
 * Calculate the due date for a routine based on its cadence and configuration
 */
export function getDueDate(
  cadence: Cadence,
  periodStart: Date,
  dueConfig: DueDayConfig | null | undefined
): Date | null {
  if (!dueConfig) return null;

  switch (cadence) {
    case "daily":
      // Daily routines are always due today
      return startOfDay(new Date());

    case "weekly": {
      if (dueConfig.type !== "day_of_week") return null;
      // periodStart is Monday of the week, add days to get to due day
      // day 1 = Monday (add 0), day 5 = Friday (add 4), day 7 = Sunday (add 6)
      return addDays(periodStart, dueConfig.day - 1);
    }

    case "monthly": {
      if (dueConfig.type === "day_of_month") {
        if (dueConfig.day === "last") {
          return endOfMonth(periodStart);
        }
        // Set to specific day of month
        const result = setDate(periodStart, dueConfig.day as number);
        return result;
      }
      
      if (dueConfig.type === "last_weekday") {
        const year = periodStart.getFullYear();
        const month = periodStart.getMonth();
        return getLastWeekdayOfMonth(year, month, dueConfig.weekday);
      }
      
      return null;
    }

    case "quarterly": {
      if (dueConfig.type !== "day_of_quarter") return null;
      
      if ("day" in dueConfig && dueConfig.day === "last") {
        return endOfQuarter(periodStart);
      }
      
      // Specific day of a month in the quarter
      if ("month" in dueConfig && "dayOfMonth" in dueConfig) {
        const quarterStart = startOfQuarter(periodStart);
        const targetMonth = addMonths(quarterStart, dueConfig.month - 1);
        return setDate(targetMonth, dueConfig.dayOfMonth);
      }
      
      return null;
    }

    case "yearly": {
      if (dueConfig.type !== "specific_date") return null;
      return new Date(
        periodStart.getFullYear(),
        dueConfig.month - 1,
        dueConfig.day
      );
    }

    default:
      return null;
  }
}

/**
 * Check if a due date has passed
 */
export function isOverdue(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  const now = startOfDay(new Date());
  const due = startOfDay(dueDate);
  return isBefore(due, now);
}

/**
 * Check if due date is today
 */
export function isDueToday(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  return isToday(dueDate);
}

/**
 * Get days remaining until due date
 */
export function getDaysUntilDue(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const now = startOfDay(new Date());
  const due = startOfDay(dueDate);
  const diff = due.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Format due date config as a human-readable string
 */
export function formatDueConfig(cadence: Cadence, config: DueDayConfig | null | undefined): string {
  if (!config) return "";

  switch (cadence) {
    case "weekly":
      if (config.type === "day_of_week") {
        return `Due ${WEEKDAY_LABELS[config.day - 1]}`;
      }
      break;

    case "monthly":
      if (config.type === "day_of_month") {
        if (config.day === "last") {
          return "Due last day of month";
        }
        const suffix = getOrdinalSuffix(config.day as number);
        return `Due ${config.day}${suffix}`;
      }
      if (config.type === "last_weekday") {
        return `Due last ${WEEKDAY_LABELS[config.weekday - 1]}`;
      }
      break;

    case "quarterly":
      if (config.type === "day_of_quarter") {
        if ("day" in config && config.day === "last") {
          return "Due last day of quarter";
        }
        if ("month" in config && "dayOfMonth" in config) {
          const monthNames = ["1st month", "2nd month", "3rd month"];
          const suffix = getOrdinalSuffix(config.dayOfMonth);
          return `Due ${config.dayOfMonth}${suffix} of ${monthNames[config.month - 1]}`;
        }
      }
      break;

    case "yearly":
      if (config.type === "specific_date") {
        const monthNames = [
          "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"
        ];
        return `Due ${monthNames[config.month - 1]} ${config.day}`;
      }
      break;
  }

  return "";
}

/**
 * Format due date for display (e.g., "Friday, Jan 31")
 */
export function formatDueDate(dueDate: Date | null): string {
  if (!dueDate) return "";
  return format(dueDate, "EEEE, MMM d");
}

/**
 * Get status text for due date
 */
export function getDueStatus(dueDate: Date | null): {
  text: string;
  variant: "default" | "warning" | "destructive" | "success";
} {
  if (!dueDate) {
    return { text: "", variant: "default" };
  }

  const daysUntil = getDaysUntilDue(dueDate);
  
  if (daysUntil === null) {
    return { text: "", variant: "default" };
  }

  if (daysUntil < 0) {
    const daysOverdue = Math.abs(daysUntil);
    return {
      text: `Overdue by ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""}`,
      variant: "destructive",
    };
  }

  if (daysUntil === 0) {
    return { text: "Due today", variant: "warning" };
  }

  if (daysUntil === 1) {
    return { text: "Due tomorrow", variant: "warning" };
  }

  return {
    text: `${daysUntil} days remaining`,
    variant: "default",
  };
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
