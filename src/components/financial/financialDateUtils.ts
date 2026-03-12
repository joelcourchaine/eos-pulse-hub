import { MONTH_NAMES_FULL, MONTH_NAMES_SHORT } from "./financialConstants";

export const getMonthsForQuarter = (quarter: number, year: number) => {
  const months = [];

  // Always show only the 3 months for the selected quarter
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: MONTH_NAMES_FULL[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    });
  }

  return months;
};

export const getPreviousYearMonthsForQuarter = (quarter: number, year: number) => {
  const months = [];
  const previousYear = year - 1;

  // Show the 3 months for the same quarter in the previous year
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: `${MONTH_NAMES_FULL[monthIndex]} ${previousYear}`,
      identifier: `${previousYear}-${String(monthIndex + 1).padStart(2, "0")}`,
    });
  }

  return months;
};

// Helper function to get only the 3 months for a quarter (for average calculations)
export const getQuarterMonthsForCalculation = (quarter: number, year: number) => {
  const months = [];
  // Always return exactly 3 months for the quarter
  for (let i = 0; i < 3; i++) {
    const monthIndex = (quarter - 1) * 3 + i;
    months.push({
      label: MONTH_NAMES_FULL[monthIndex],
      identifier: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
    });
  }

  return months;
};

export const getPrecedingQuarters = (currentQuarter: number, currentYear: number, count: number = 4) => {
  const quarters = [];
  let q = currentQuarter;
  let y = currentYear;

  for (let i = 0; i < count; i++) {
    q--;
    if (q < 1) {
      q = 4;
      y--;
    }
    quarters.push({ quarter: q, year: y, label: `Q${q} ${y}` });
  }

  return quarters.reverse();
};

export const getQuarterTrendPeriods = (currentQuarter: number, currentYear: number) => {
  const quarters = [];
  const startYear = currentYear - 1;

  // Start from Q1 of last year - matches ScorecardGrid behavior
  for (let y = startYear; y <= currentYear; y++) {
    const startQ = 1;
    const endQ = y === currentYear ? currentQuarter : 4;

    for (let q = startQ; q <= endQ; q++) {
      quarters.push({
        quarter: q,
        year: y,
        label: `Q${q} ${y}`,
      });
    }
  }

  return quarters;
};

export interface MonthlyTrendPeriod {
  month: number;
  year: number;
  label: string;
  identifier: string;
  type: "month" | "year-avg" | "year-total";
  summaryYear?: number;
  isYTD?: boolean;
}

export const getMonthlyTrendPeriods = (selectedYear: number): MonthlyTrendPeriod[] => {
  const periods: MonthlyTrendPeriod[] = [];

  // Add all 12 months for the selected year only
  for (let m = 0; m < 12; m++) {
    periods.push({
      month: m,
      year: selectedYear,
      label: `${MONTH_NAMES_SHORT[m]} ${selectedYear}`,
      identifier: `${selectedYear}-${String(m + 1).padStart(2, "0")}`,
      type: "month",
    });
  }

  // Add year summary columns
  periods.push({
    month: -1,
    year: selectedYear,
    label: `Avg ${selectedYear}`,
    identifier: `avg-${selectedYear}`,
    type: "year-avg",
    summaryYear: selectedYear,
  });
  periods.push({
    month: -1,
    year: selectedYear,
    label: `Total ${selectedYear}`,
    identifier: `total-${selectedYear}`,
    type: "year-total",
    summaryYear: selectedYear,
  });

  return periods;
};
