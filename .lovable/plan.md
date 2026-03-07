
## Root Cause

The `ForecastDrawer` initializes `selectedYear` from **localStorage** (defaulting to `currentYear`). The Financial Summary never tells the drawer which year it's viewing. So if localStorage has `2025` stored, the drawer opens on 2025, the user edits 2025 forecast data, saves it — but `useForecastTargets(departmentId, year)` is fetching for the Financial Summary's `year` prop (2026). The Q1 Target column reads from `getForecastTarget()` which uses the 2026 map, which has stale/no data.

Even if years happen to match, the `refetchForecastTargets()` on close is the only refresh — there's no guarantee the drawer year and the summary year are in sync.

## Fix

**1. Add `initialYear` prop to `ForecastDrawer`**

```ts
interface ForecastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departmentId: string;
  departmentName: string;
  onTargetsPushed?: () => void;
  initialYear?: number;  // ← new
}
```

**2. Use `initialYear` to override localStorage when the drawer opens**

Change the `selectedYear` state initialization to prefer `initialYear` when provided:

```ts
const [selectedYear, setSelectedYear] = useState<number>(() => {
  if (initialYear) return initialYear;  // ← use Summary's year
  const saved = localStorage.getItem(FORECAST_YEAR_KEY);
  if (saved) { ... }
  return currentYear;
});

// Also sync when initialYear changes (drawer opens to a new year)
useEffect(() => {
  if (initialYear && open) {
    setSelectedYear(initialYear);
  }
}, [initialYear, open]);
```

**3. Pass `year` from FinancialSummary to the drawer (~line 5542)**

```tsx
<ForecastDrawer
  open={forecastDrawerOpen}
  onOpenChange={(open) => {
    setForecastDrawerOpen(open);
    if (!open) refetchForecastTargets();
  }}
  departmentId={departmentId}
  departmentName={departmentName || "Department"}
  onTargetsPushed={loadTargets}
  initialYear={year}   // ← pass the summary's year
/>
```

## Files to change
- `src/components/financial/ForecastDrawer.tsx` — add `initialYear` prop, sync state on open
- `src/components/financial/FinancialSummary.tsx` — pass `initialYear={year}` to `ForecastDrawer`
