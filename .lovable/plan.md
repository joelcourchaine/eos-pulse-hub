
# Fix Quarter Trend Year Selection Issue

## Problem
When user selects year 2024 in the Quarter Trend view, the UI still displays Q1 2025 - Q1 2026 data because the Quarter Trend mode is designed to always show the **actual current** rolling 5 quarters, ignoring the year navigation.

This creates confusion because:
1. The year selector shows "2024" but data shows 2025 quarters
2. The email function uses the selected year, so emails would differ from what's displayed

## Solution
The email function should match the UI behavior - Quarter Trend always shows the **actual current** rolling 5 quarters, not based on the selected year.

### Changes Required

#### `supabase/functions/send-scorecard-email/index.ts`

Update `getQuarterlyTrendPeriods` function to ignore the passed `year` parameter and always use the actual current date (matching UI behavior):

**Current code (line 117-154):**
```typescript
function getQuarterlyTrendPeriods({ year }: { year: number }) {
  // ...
  let qYear = year - 1;  // Uses selected year
  let q = 1;
  // ...
}
```

**Updated code:**
```typescript
function getQuarterlyTrendPeriods({ year }: { year: number }) {
  const quarters: Array<{ 
    label: string; 
    identifier: string; 
    type: "quarter"; 
    year: number; 
    quarter: number;
    months: string[];
  }> = [];
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentQuarter = Math.floor(currentMonth / 3) + 1;
  
  // Start from Q1 of ACTUAL previous year (ignore passed year parameter)
  // This matches the UI's Quarter Trend view which always shows current rolling window
  let qYear = currentYear - 1;
  let q = 1;
  
  // Generate quarters from Q1 of previous year up to current quarter
  while (qYear < currentYear || (qYear === currentYear && q <= currentQuarter)) {
    const months: string[] = [];
    for (let m = 0; m < 3; m++) {
      const monthIndex = (q - 1) * 3 + m;
      months.push(`${qYear}-${String(monthIndex + 1).padStart(2, '0')}`);
    }
    
    quarters.push({
      label: `Q${q} ${qYear}`,
      identifier: `${qYear}-Q${q}`,
      type: "quarter",
      year: qYear,
      quarter: q,
      months,
    });
    
    q++;
    if (q > 4) {
      q = 1;
      qYear++;
    }
  }
  
  return quarters;
}
```

## Technical Details

The key change is replacing:
- `let qYear = year - 1;` (uses selected year)

With:
- `let qYear = currentYear - 1;` (uses actual current year)

And updating the loop to continue until the **actual current quarter** instead of a fixed 5-quarter count.

## Testing
1. Navigate to any department dashboard
2. Set to "Quarter Trend" view
3. Navigate to year 2024 (or any past year)
4. Verify UI displays actual current quarters (Q1 2024 - Q1 2025 based on today)
5. Send email using "Quarterly Trend" option
6. Verify email data matches what's displayed in the UI
