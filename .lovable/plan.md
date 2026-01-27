
# Add 2024 Year Access to GO Scorecard

## Problem

The GO Scorecard year selector dropdown only shows years from 2025 onwards. The year options are dynamically generated based on the current date (showing `currentYear - 1`, `currentYear`, `currentYear + 1`), which in January 2026 means 2025, 2026, 2027. This prevents users from accessing 2024 data for historical comparison.

Additionally, the `YEAR_STARTS` fiscal calendar constant only defines start dates for 2025, 2026, and 2027.

## Solution

Update the Scorecard year selector to include 2024 and add the corresponding fiscal year start date.

## Changes Required

### File: `src/components/scorecard/ScorecardGrid.tsx`

#### Change 1: Add 2024 to YEAR_STARTS constant (around line 92)

Add the fiscal year start for 2024 to support proper week/quarter calculations:

```typescript
const YEAR_STARTS: { [key: number]: Date } = {
  2024: new Date(2024, 0, 1),    // Jan 1, 2024 (Monday) - NEW
  2025: new Date(2024, 11, 30),  // Dec 30, 2024
  2026: new Date(2025, 11, 29),  // Dec 29, 2025 (Monday)
  2027: new Date(2026, 11, 28),  // Dec 28, 2026 (Monday)
};
```

#### Change 2: Add 2024 to year selector dropdown (around line 2706)

Add a SelectItem for 2024 to the dropdown:

```typescript
<SelectContent>
  <SelectItem value="2024">2024</SelectItem>
  <SelectItem value={(new Date().getFullYear() - 1).toString()}>
    {new Date().getFullYear() - 1}
  </SelectItem>
  <SelectItem value={new Date().getFullYear().toString()}>
    {new Date().getFullYear()}
  </SelectItem>
  <SelectItem value={(new Date().getFullYear() + 1).toString()}>
    {new Date().getFullYear() + 1}
  </SelectItem>
</SelectContent>
```

---

## Technical Details

- The fiscal year 2024 will use January 1, 2024 as its start date (which is a Monday)
- This change only affects the Scorecard grid; the data queries will work as-is since they just filter by the year value
- This enables users to view 2024 scorecard data for historical verification and Year-over-Year analysis

## Impact

After this change, users will be able to select 2024 from the year dropdown and view any scorecard data stored for that year.
