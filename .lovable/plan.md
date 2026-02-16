
# Hide Semi Fixed Expense for KTRV Service and Parts Departments

## Overview

The Financial Summary already hides "Semi Fixed Expense" and "Semi Fixed Expense %" for Stellantis Service/Parts departments. This change extends that same filter to also apply to the KTRV brand.

## Change

### `src/components/financial/FinancialSummary.tsx` (~line 483-496)

Update the brand check to include KTRV alongside Stellantis:

**Before:**
```typescript
const isStellantis = storeBrand?.toLowerCase().includes('stellantis') || false;
```

**After:**
```typescript
const isStellantis = storeBrand?.toLowerCase().includes('stellantis') || false;
const isKTRV = storeBrand?.toLowerCase().includes('ktrv') || false;
```

And update the filter condition:

**Before:**
```typescript
const filtered = (isStellantis && isServiceOrParts)
  ? metrics.filter(m => !['semi_fixed_expense', 'semi_fixed_expense_percent'].includes(m.key))
  : metrics;
```

**After:**
```typescript
const filtered = ((isStellantis || isKTRV) && isServiceOrParts)
  ? metrics.filter(m => !['semi_fixed_expense', 'semi_fixed_expense_percent'].includes(m.key))
  : metrics;
```

Also update the console log to include the new flag for debugging.

Single file, minimal change -- follows the exact existing pattern.
