
# Plan: Systemic Fix for Supabase 1000-Row Query Limit

## Problem
The Supabase default query limit of 1000 rows has caused data truncation issues repeatedly. While some files already implement pagination, several critical data fetching locations still don't, leading to silent data loss (e.g., December financial data missing from reports).

## Solution: Create a Reusable Pagination Utility + Audit & Fix All Queries

---

## Part 1: Create Shared Pagination Utility

### New File: `src/lib/supabasePagination.ts`

Create a reusable utility function that handles paginated fetching automatically:

```typescript
import { PostgrestFilterBuilder } from "@supabase/postgrest-js";

export async function fetchAllRows<T>(
  queryBuilder: PostgrestFilterBuilder<any, any, T[]>,
  pageSize: number = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder.range(offset, offset + pageSize - 1);
    
    if (error) throw error;
    if (!data || data.length === 0) break;
    
    allRows.push(...data);
    hasMore = data.length === pageSize;
    offset += pageSize;
  }

  return allRows;
}
```

This utility can be used like:
```typescript
const entries = await fetchAllRows(
  supabase.from("scorecard_entries").select("*").in("kpi_id", kpiIds)
);
```

---

## Part 2: High-Volume Tables to Target

Based on analysis, these tables can exceed 1000 rows and need paginated fetching:

| Table | Reason |
|-------|--------|
| `scorecard_entries` | Multiple KPIs × 12+ months × weekly entries |
| `financial_entries` | Many metrics × 12+ months + sub-metrics |
| `kpi_entries` | Historical data accumulation |
| `department_answers` | Many questions × departments |
| `todos` | Can accumulate over time |
| `scorecard_import_logs` | Historical imports |

---

## Part 3: Files Requiring Pagination Updates

### Already Have Pagination (OK):
- ✅ `src/components/financial/FinancialSummary.tsx` (multiple locations)
- ✅ `src/hooks/useSubMetrics.ts`
- ✅ `src/pages/DealerComparison.tsx`
- ✅ `src/components/enterprise/FixedCombinedTrendView.tsx`
- ✅ `src/components/enterprise/CombinedTrendView.tsx`
- ✅ `supabase/functions/send-scorecard-email/index.ts`
- ✅ `supabase/functions/send-gm-overview-email/index.ts`
- ✅ `supabase/functions/send-forecast-email/index.ts`

### Need Pagination Added:

#### 1. `src/components/scorecard/ScorecardGrid.tsx`
**3 queries need updating:**
- Line ~949: Monthly trend data fetch
- Line ~1012: Weekly entries fetch  
- Line ~1072: Monthly entries fetch

#### 2. `src/components/enterprise/KPITrendView.tsx`
Likely fetches KPI data across multiple months/stores - needs audit

#### 3. Edge Functions That Query Data:
- `supabase/functions/send-scorecard-email/index.ts` - Line ~359: `financial_entries` query lacks pagination
- Other edge functions that may query high-volume tables

---

## Part 4: Implementation Details

### ScorecardGrid.tsx Updates

**Monthly Trend Query (around line 949):**
```typescript
// BEFORE
const { data: monthlyData } = await supabase
  .from("scorecard_entries")
  .select("*")
  .in("kpi_id", kpiIds)
  .eq("entry_type", "monthly")
  .in("month", monthIdentifiers);

// AFTER - Paginated
const monthlyData: any[] = [];
let offset = 0;
const pageSize = 1000;

while (true) {
  const { data: page, error } = await supabase
    .from("scorecard_entries")
    .select("*")
    .in("kpi_id", kpiIds)
    .eq("entry_type", "monthly")
    .in("month", monthIdentifiers)
    .range(offset, offset + pageSize - 1);
    
  if (error) throw error;
  if (!page || page.length === 0) break;
  
  monthlyData.push(...page);
  if (page.length < pageSize) break;
  offset += pageSize;
}
```

Apply the same pattern to:
- Weekly entries fetch (~line 1012)
- Monthly entries fetch (~line 1072)

### send-scorecard-email Edge Function

**Financial entries query (line ~359):**
```typescript
// BEFORE
const { data: finData } = await supabaseClient
  .from("financial_entries")
  .select("*")
  .eq("department_id", departmentId)
  .in("month", monthIdentifiers);

// AFTER - Paginated
let financialEntries: any[] = [];
let offset = 0;
const pageSize = 1000;

while (true) {
  const { data: page } = await supabaseClient
    .from("financial_entries")
    .select("*")
    .eq("department_id", departmentId)
    .in("month", monthIdentifiers)
    .range(offset, offset + pageSize - 1);
    
  if (!page || page.length === 0) break;
  financialEntries.push(...page);
  if (page.length < pageSize) break;
  offset += pageSize;
}
```

---

## Part 5: Testing Strategy

After implementation, verify by:
1. Testing Monthly Trend view with a full year of data
2. Sending scorecard emails for yearly reports
3. Checking that December data appears in all reports
4. Testing financial summary across 12+ months

---

## Summary of Changes

| File | Change |
|------|--------|
| `src/lib/supabasePagination.ts` | NEW - Reusable pagination utility |
| `src/components/scorecard/ScorecardGrid.tsx` | Add pagination to 3 queries |
| `supabase/functions/send-scorecard-email/index.ts` | Add pagination to financial_entries query |
| `src/components/enterprise/KPITrendView.tsx` | Audit and add pagination if needed |

This systemic fix ensures that **any query that could potentially return >1000 rows** uses pagination, eliminating this class of bugs permanently.
