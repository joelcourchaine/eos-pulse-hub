import { format, getYear, addDays, subDays, getDay, setMonth, setDate } from 'date-fns';

interface Holiday {
  date: Date;
  name: string;
  isObserved?: boolean;
}

// Calculate Easter Sunday using the Anonymous Gregorian algorithm
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1; // 0-indexed
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month, day);
}

// Get the observed date for a holiday (shift weekend holidays to nearest weekday)
function getObservedDate(date: Date): Date {
  const dayOfWeek = getDay(date);
  if (dayOfWeek === 0) { // Sunday -> Monday
    return addDays(date, 1);
  } else if (dayOfWeek === 6) { // Saturday -> Friday
    return subDays(date, 1);
  }
  return date;
}

// Get the nth occurrence of a specific weekday in a month
function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const firstDay = new Date(year, month, 1);
  const firstWeekday = getDay(firstDay);
  let dayOffset = weekday - firstWeekday;
  if (dayOffset < 0) dayOffset += 7;
  const day = 1 + dayOffset + (n - 1) * 7;
  return new Date(year, month, day);
}

// Get the last Monday before a specific date
function getMondayBefore(year: number, month: number, day: number): Date {
  const targetDate = new Date(year, month, day);
  const dayOfWeek = getDay(targetDate);
  // Calculate days to subtract to get to the previous Monday
  // If target is Monday (1), we want the Monday before, so subtract 7
  // If target is Sunday (0), subtract 6
  // If target is Saturday (6), subtract 5
  // etc.
  const daysToSubtract = dayOfWeek === 0 ? 6 : (dayOfWeek === 1 ? 7 : dayOfWeek - 1);
  return subDays(targetDate, daysToSubtract);
}

// Generate all Canadian holidays for a given year
export function getCanadianHolidays(year: number): Holiday[] {
  const holidays: Holiday[] = [];

  // New Year's Day - January 1
  const newYears = new Date(year, 0, 1);
  const newYearsObserved = getObservedDate(newYears);
  holidays.push({
    date: newYearsObserved,
    name: "New Year's Day",
    isObserved: newYears.getTime() !== newYearsObserved.getTime()
  });

  // Family Day - Third Monday of February (most provinces)
  holidays.push({
    date: getNthWeekdayOfMonth(year, 1, 1, 3),
    name: "Family Day"
  });

  // Good Friday - Friday before Easter Sunday
  const easter = getEasterSunday(year);
  holidays.push({
    date: subDays(easter, 2),
    name: "Good Friday"
  });

  // Easter Monday (optional, but observed by some)
  holidays.push({
    date: addDays(easter, 1),
    name: "Easter Monday"
  });

  // Victoria Day - Monday before May 25
  holidays.push({
    date: getMondayBefore(year, 4, 25),
    name: "Victoria Day"
  });

  // Canada Day - July 1
  const canadaDay = new Date(year, 6, 1);
  const canadaDayObserved = getObservedDate(canadaDay);
  holidays.push({
    date: canadaDayObserved,
    name: "Canada Day",
    isObserved: canadaDay.getTime() !== canadaDayObserved.getTime()
  });

  // Civic Holiday - First Monday of August (provincial)
  holidays.push({
    date: getNthWeekdayOfMonth(year, 7, 1, 1),
    name: "Civic Holiday"
  });

  // Labour Day - First Monday of September
  holidays.push({
    date: getNthWeekdayOfMonth(year, 8, 1, 1),
    name: "Labour Day"
  });

  // National Day for Truth and Reconciliation - September 30
  const truthDay = new Date(year, 8, 30);
  const truthDayObserved = getObservedDate(truthDay);
  holidays.push({
    date: truthDayObserved,
    name: "Truth & Reconciliation Day",
    isObserved: truthDay.getTime() !== truthDayObserved.getTime()
  });

  // Thanksgiving - Second Monday of October
  holidays.push({
    date: getNthWeekdayOfMonth(year, 9, 1, 2),
    name: "Thanksgiving"
  });

  // Remembrance Day - November 11
  const remembranceDay = new Date(year, 10, 11);
  const remembranceDayObserved = getObservedDate(remembranceDay);
  holidays.push({
    date: remembranceDayObserved,
    name: "Remembrance Day",
    isObserved: remembranceDay.getTime() !== remembranceDayObserved.getTime()
  });

  // Christmas Day - December 25
  const christmas = new Date(year, 11, 25);
  const christmasObserved = getObservedDate(christmas);
  holidays.push({
    date: christmasObserved,
    name: "Christmas Day",
    isObserved: christmas.getTime() !== christmasObserved.getTime()
  });

  // Boxing Day - December 26
  const boxingDay = new Date(year, 11, 26);
  let boxingDayObserved = getObservedDate(boxingDay);
  // If Christmas is observed on Monday, Boxing Day should be Tuesday
  if (christmasObserved.getTime() === boxingDayObserved.getTime()) {
    boxingDayObserved = addDays(christmasObserved, 1);
  }
  holidays.push({
    date: boxingDayObserved,
    name: "Boxing Day",
    isObserved: boxingDay.getTime() !== boxingDayObserved.getTime()
  });

  return holidays;
}

// Check if a date is a Canadian holiday and return the holiday info
export function getHolidayForDate(date: Date): Holiday | null {
  const year = getYear(date);
  const holidays = getCanadianHolidays(year);
  const dateStr = format(date, 'yyyy-MM-dd');
  
  return holidays.find(h => format(h.date, 'yyyy-MM-dd') === dateStr) || null;
}

// Check if a date string (YYYY-MM-DD) is a Canadian holiday
export function isHoliday(dateString: string): boolean {
  const date = new Date(dateString + 'T00:00:00');
  return getHolidayForDate(date) !== null;
}

// Get holiday name for a date string
export function getHolidayName(dateString: string): string | null {
  const date = new Date(dateString + 'T00:00:00');
  const holiday = getHolidayForDate(date);
  return holiday?.name || null;
}

// Get all holidays for a range of years (useful for calendar display)
export function getHolidaysForYears(startYear: number, endYear: number): Map<string, string> {
  const holidayMap = new Map<string, string>();
  
  for (let year = startYear; year <= endYear; year++) {
    const holidays = getCanadianHolidays(year);
    holidays.forEach(h => {
      holidayMap.set(format(h.date, 'yyyy-MM-dd'), h.name);
    });
  }
  
  return holidayMap;
}
