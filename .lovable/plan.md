
## Problem

When `comparisonMode = "prev_year_quarter"`, the Date Period dropdown (Single Month / Full Year / Custom Range / 12 Month Trend) is irrelevant and confusing. The only thing that matters is: **which quarter this year** vs **which quarter last year**.

Currently the user has:
1. A "Compare Quarter" selector (which prior year Q to compare against) — shown above Date Period
2. Then a full Date Period selector — all options are nonsensical for QvQ comparison

## Solution

When `comparisonMode === "prev_year_quarter"`:
- **Hide** the Date Period dropdown entirely
- **Replace** the "Compare Quarter" selector with **two side-by-side quarter selectors**: "Current Quarter" and "Compare Quarter (Prior Year)"
- Auto-set `datePeriodType` to `"custom_range"` internally and derive `startMonth`/`endMonth` from the selected current quarter + `selectedYear`

### UI change (what the user sees)

```
Compare Against:    [ Previous Year Quarter ▾ ]

Current Quarter:    [ Q1 (Jan-Mar) ▾ ]    Compare Quarter:  [ Q1 (Jan-Mar) ▾ ]
Current Year:       [ 2026 ▾ ]
```

The "Current Year" selector controls which year the selected current quarter belongs to (defaults to current year). Compare quarter is always from the prior year (current year - 1), shown as a label e.g. "vs Q1 2025".

### State changes

Add two new state variables:
- `selectedCurrentQuarter: number` (1–4, default: current quarter) — which quarter of the current year to view
- `selectedCurrentYear: number` (default: current year) — what year the current quarter is in (already have `selectedYear` — can reuse)

Keep `selectedComparisonQuarter` for the prior year quarter.

### Data flow

When building `dateParams` for the `"prev_year_quarter"` mode:
- Set `datePeriodType = "custom_range"`
- `startMonth` = first month of `selectedCurrentQuarter` in `selectedYear` (e.g. Q1 2026 → `2026-01`)
- `endMonth` = last month of `selectedCurrentQuarter` in `selectedYear` (e.g. Q1 2026 → `2026-03`)

This already works correctly downstream — `DealerComparison.tsx` already handles `prev_year_quarter` + `selectedComparisonQuarter` with a `custom_range` date period.

## Files to change

| File | Change |
|------|--------|
| `src/pages/Enterprise.tsx` | 1. Add `selectedCurrentQuarter` state (1-4, default current quarter). 2. Replace the separate "Compare Quarter" + "Date Period" blocks when `comparisonMode === "prev_year_quarter"` with a new simplified two-Q-selector layout. 3. Update `dateParams` logic to derive `custom_range` start/end from `selectedCurrentQuarter + selectedYear`. 4. Persist `selectedCurrentQuarter` to sessionStorage. |

Only one file changes — all downstream logic already handles this correctly.
