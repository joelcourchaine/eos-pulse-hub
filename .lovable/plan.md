

# Fix Quarter Trend Mode Year Synchronization

## Problem
In Quarter Trend view, the Scorecard and Financial Summary are showing different time periods:
- **Scorecard**: Q1-Q4 2025 + Q1 2026 (correct)
- **Financial Summary**: Q1-Q4 2024 + Q1 2025 (one year behind)

## Root Cause
The `getQuarterTrendPeriods` function is called differently in each component:

| Component | Parameter Passed | Value |
|-----------|-----------------|-------|
| ScorecardGrid | `currentQuarterInfo.year` (actual current year) | 2026 |
| FinancialSummary | `year` (selected year prop) | 2025 |

Both use the actual current quarter (Q1), but FinancialSummary incorrectly passes the selected year instead of the actual current year.

## Solution
Update FinancialSummary to use `currentYear` (from `new Date()`) instead of `year` (the prop) when calling `getQuarterTrendPeriods`, matching ScorecardGrid's behavior.

## Implementation

### File: `src/components/financial/FinancialSummary.tsx`

**Line 361 - Change from:**
```typescript
const quarterTrendPeriods = isQuarterTrendMode ? getQuarterTrendPeriods(currentQuarter, year) : [];
```

**To:**
```typescript
const quarterTrendPeriods = isQuarterTrendMode ? getQuarterTrendPeriods(currentQuarter, currentYear) : [];
```

This single-line fix ensures both components use identical logic:
- Start from Q1 of (actual current year - 1)
- End at the actual current quarter of the actual current year

## Testing
1. Open Dashboard and select a department
2. Switch to "Quarter Trend" view
3. Verify both Scorecard and Financial Summary show the same quarters (Q1-Q4 2025 + Q1 2026)
4. Use the PeriodNavigation arrows - both components should stay synchronized

