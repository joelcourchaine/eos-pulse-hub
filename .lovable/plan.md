

## Add "Previous Year Avg" and "Previous Year Quarter Avg" Comparison Modes

### Overview

Two new comparison modes will be added to the Enterprise "Compare Against" dropdown, allowing you to compare the currently selected month's metrics against:

1. **Previous Year Average** -- The average of all 12 months from the previous year (e.g., if viewing Jan 2026, compare against the monthly average of all 2025 data)
2. **Previous Year Quarter** -- The average of a specific quarter from the previous year, with a quarter selector (e.g., compare Jan 2026 against Q3 2025 average)

Both modes will use the same 3-column layout (Current | Comparison | Diff) already used by the Year-over-Year mode, with green/red color-coded differences.

### UI Changes

**File: `src/pages/Enterprise.tsx`**

- Add two new values to the `ComparisonMode` type: `"prev_year_avg"` and `"prev_year_quarter"`
- Add two new options to the "Compare Against" dropdown:
  - "Previous Year Avg"
  - "Previous Year Quarter"
- When "Previous Year Quarter" is selected, show an additional quarter selector dropdown (Q1, Q2, Q3, Q4) to pick which quarter from the previous year to compare against
- Add new state: `selectedComparisonQuarter` (default: most recent completed quarter)
- Pass the new comparison mode and selected quarter to the DealerComparison page via navigation state
- Persist `selectedComparisonQuarter` in sessionStorage alongside other filter state

**File: `src/pages/DealerComparison.tsx`**

- Accept new `selectedComparisonQuarter` from location state
- Add two new data-fetching queries:
  - **Previous Year Avg**: Fetch all financial entries for the previous year (all 12 months), then average the values per department/metric
  - **Previous Year Quarter**: Fetch financial entries for the selected quarter of the previous year (e.g., Q3 = Jul-Sep), then average the values per department/metric
- Integrate these into the `comparisonMap` builder alongside the existing `"targets"` and `"year_over_year"` branches
- Reuse the existing 3-column YOY layout for display, updating the column headers:
  - For Prev Year Avg: columns show "2026" | "2025 Avg" | "Diff"
  - For Prev Year Quarter: columns show "2026" | "2025 Q3 Avg" | "Diff"
- Update the subtitle text to show "vs Previous Year Avg" or "vs 2025 Q3 Avg"

### Data Fetching Logic

**Previous Year Average:**
```text
Selected month: 2026-01
Fetch: financial_entries WHERE month >= '2025-01' AND month <= '2025-12'
For each dept+metric: Sum values across months, divide by count of months with data
Result: Monthly average for each metric in the previous year
```

**Previous Year Quarter:**
```text
Selected month: 2026-01, Selected quarter: Q3
Quarter months: 2025-07, 2025-08, 2025-09
Fetch: financial_entries WHERE month IN ('2025-07', '2025-08', '2025-09')
For each dept+metric: Sum values across months, divide by count of months with data
Result: Monthly average for each metric in Q3 of the previous year
```

Both use the same derived metric calculation pipeline (brand-specific formulas for Department Profit, GP %, etc.) that's already applied to the YOY comparison data.

### Table Layout

The display reuses the existing 3-column per store layout:

```text
| Metric      | Store A (Jan 2026) | Store A (2025 Avg) | Store A Diff |
|-------------|--------------------|--------------------|--------------|
| Total Sales |     $500,000       |     $420,000       |   +$80,000   |
| GP %        |       45.2%        |       42.1%        |     +3.1%    |
```

Diff column is color-coded green (favorable) or red (unfavorable) using the same `isDiffFavorable` logic.

### Email Support

The email dialog and edge function will receive the new comparison mode and quarter info. The Excel attachment will include the 3-column layout with color coding, following the same pattern as the existing YOY email support.

### Technical Details

**Files modified:**
1. `src/pages/Enterprise.tsx` -- ComparisonMode type, dropdown options, quarter selector, state persistence, navigation params
2. `src/pages/DealerComparison.tsx` -- New data queries, comparison map builder branches, column headers, subtitle text
3. `src/components/enterprise/EmailComparisonDialog.tsx` -- Pass new comparison labels to the email function
4. `supabase/functions/send-dealer-comparison-email/index.ts` -- Handle new comparison modes in HTML and Excel output

**No database changes required** -- all data comes from the existing `financial_entries` table.

