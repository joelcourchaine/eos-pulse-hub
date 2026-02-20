

# Fix: Extend Negative-Target Variance Fix to Scorecard and Email Functions

## Summary

The previous fix correctly updated `FinancialSummary.tsx` for all brands. However, the same inverted-variance bug exists in two additional locations that need the same `Math.abs(targetValue)` treatment.

## Files to Update

### 1. `src/components/scorecard/ScorecardGrid.tsx` (3 locations)

- **Line 3064**: Main scorecard cell variance calculation
- **Line 4122**: Monthly scorecard trend view
- **Line 4312**: Quarterly scorecard trend view

Each follows the same pattern change:
```
// Before
variance = ((actualValue - targetValue) / targetValue) * 100;

// After
variance = ((actualValue - targetValue) / Math.abs(targetValue)) * 100;
```

### 2. `supabase/functions/send-scorecard-email/index.ts` (4 locations)

- **Line 675**: Quarter KPI variance in scorecard emails
- **Line 732**: Monthly KPI variance in scorecard emails
- **Line 1056**: Financial metric variance (quarter) in emails
- **Line 1123**: Financial metric variance (month) in emails

Same pattern change using `Math.abs(targetValue)` in the denominator.

## Impact

- Scorecard KPIs with negative targets will now show correct green/red colors on the dashboard
- Emailed scorecard and financial reports will also show correct performance colors
- No change to behavior when targets are positive
- All brands benefit equally since these components are brand-agnostic

