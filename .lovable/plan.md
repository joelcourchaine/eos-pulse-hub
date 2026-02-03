
# Add Ford Fixed Expense Sub-Metrics with YTD-to-Monthly Conversion

## Overview
Add fixed expense sub-metrics for Ford brand stores (Parts and Service departments) from the FORD6 sheet. Since Ford financial statements display Year-to-Date (YTD) totals rather than monthly values, we need to implement conversion logic that calculates monthly values by subtracting the previous month's YTD from the current month's YTD.

## Cell Mapping Specification (from FORD6 sheet)
- **Row Names**: B5 through B25 (21 line items)
- **Parts Department Values**: Y5 through Y25
- **Service Department Values**: Z5 through Z25
- **Parent Metric**: `total_fixed_expense`

## Implementation Plan

### 1. Database: Add Cell Mappings
Insert 42 new records into `financial_cell_mappings` table:
- 21 mappings for Parts Department (column Y)
- 21 mappings for Service Department (column Z)

Each mapping will include:
- `brand`: "Ford"
- `sheet_name`: "FORD6"
- `is_sub_metric`: true
- `parent_metric_key`: "total_fixed_expense"
- `name_cell_reference`: B{row} (for dynamic name extraction)
- `cell_reference`: Y{row} or Z{row} (for value extraction)
- `metric_key`: Format like `sub:total_fixed_expense:00:Fixed Expense Name`

### 2. Config Update: `src/config/financialMetrics.ts`
Add `hasSubMetrics: true` to the `total_fixed_expense` metric in `FORD_METRICS`:

```typescript
{ 
  name: "Total Fixed Expense", 
  key: "total_fixed_expense", 
  type: "dollar", 
  description: "Total fixed expenses", 
  targetDirection: "below",
  hasSubMetrics: true  // NEW: Enable expandable sub-metrics
},
```

Optionally add a percentage metric:
```typescript
{ 
  name: "Total Fixed Expense %", 
  key: "total_fixed_expense_percent", 
  type: "percentage", 
  description: "Fixed expenses as % of GP Net", 
  targetDirection: "below",
  calculation: {
    numerator: "total_fixed_expense",
    denominator: "gp_net"
  },
  hasSubMetrics: true
},
```

### 3. Parser Update: `src/utils/parseFinancialExcel.ts`
Add YTD-to-monthly conversion logic for Ford brand sub-metrics:

```text
NEW FUNCTION: convertYTDToMonthly(
  departmentId: string,
  monthIdentifier: string,
  subMetrics: SubMetricData[]
): Promise<SubMetricData[]>
```

**Logic Flow:**
1. Check if brand is Ford and parent metric is `total_fixed_expense`
2. Parse the target month from `monthIdentifier` (e.g., "2025-02")
3. If January (month 01): YTD value = Monthly value (no conversion needed)
4. If any other month:
   - Calculate previous month identifier
   - Fetch previous month's YTD sub-metric values from database
   - For each sub-metric: `monthly_value = current_ytd - previous_ytd`
5. Return converted monthly values

**Integration Point:**
Modify `importFinancialData` function to call conversion before inserting:

```typescript
// Before inserting sub-metrics for Ford
if (brand === 'Ford' && parentMetricKey === 'total_fixed_expense') {
  convertedSubMetrics = await convertYTDToMonthly(
    departmentId,
    monthIdentifier,
    parsedSubMetrics
  );
}
```

### 4. Database Schema for YTD Storage
To enable proper YTD-to-monthly conversion, we need to also store the raw YTD values:

**Option A - Dual Storage (Recommended):**
- Store YTD value: `ytd:total_fixed_expense:{order}:{name}`
- Store Monthly value: `sub:total_fixed_expense:{order}:{name}`

This allows:
- Re-importing any month without needing chronological order
- Recalculating monthly values if previous months are updated
- Auditing/debugging by comparing YTD vs monthly

**Option B - Sequential Import Only:**
- Only store monthly values
- Requires importing months in chronological order
- Simpler but more restrictive

### 5. Import Flow for Ford Fixed Expenses

```text
User drops Ford statement for February 2025
  │
  ▼
Parse FORD6 sheet → Extract YTD values from Y/Z columns
  │
  ▼
Store YTD values (ytd:total_fixed_expense:...)
  │
  ▼
Fetch January 2025 YTD values from database
  │
  ▼
Calculate: Feb_monthly = Feb_YTD - Jan_YTD
  │
  ▼
Store monthly values (sub:total_fixed_expense:...)
  │
  ▼
UI displays monthly breakdown under Total Fixed Expense
```

### 6. Edge Cases to Handle

1. **January Import**: No previous month to subtract - use YTD directly as monthly
2. **Missing Previous Month**: Warn user that previous month data is needed for accurate conversion
3. **Re-import**: When re-importing a month, recalculate downstream months if YTD changed
4. **Year Boundary**: December → January crosses year boundary, handle year in month calculation

## Technical Details

### Cell Mapping SQL Insert (example for first few rows):
```sql
INSERT INTO financial_cell_mappings 
  (brand, department_name, metric_key, sheet_name, cell_reference, name_cell_reference, parent_metric_key, is_sub_metric)
VALUES
  ('Ford', 'Parts Department', 'sub:total_fixed_expense:00', 'FORD6', 'Y5', 'B5', 'total_fixed_expense', true),
  ('Ford', 'Parts Department', 'sub:total_fixed_expense:01', 'FORD6', 'Y6', 'B6', 'total_fixed_expense', true),
  -- ... rows 5-25 for Parts (Y column)
  ('Ford', 'Service Department', 'sub:total_fixed_expense:00', 'FORD6', 'Z5', 'B5', 'total_fixed_expense', true),
  ('Ford', 'Service Department', 'sub:total_fixed_expense:01', 'FORD6', 'Z6', 'B6', 'total_fixed_expense', true);
  -- ... rows 5-25 for Service (Z column)
```

### YTD Conversion Function Pseudocode:
```typescript
async function convertFordYTDToMonthly(
  departmentId: string,
  monthId: string,         // "2025-02"
  ytdSubMetrics: SubMetricData[]
): Promise<SubMetricData[]> {
  const [year, month] = monthId.split('-').map(Number);
  
  // January - YTD equals monthly
  if (month === 1) {
    return ytdSubMetrics; 
  }
  
  // Calculate previous month
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonthId = `${prevYear}-${String(prevMonth).padStart(2, '0')}`;
  
  // Fetch previous month's YTD values
  const { data: prevYTDEntries } = await supabase
    .from('financial_entries')
    .select('metric_name, value')
    .eq('department_id', departmentId)
    .eq('month', prevMonthId)
    .like('metric_name', 'ytd:total_fixed_expense:%');
  
  // Build lookup map
  const prevYTDMap = new Map(
    prevYTDEntries?.map(e => [e.metric_name, e.value]) || []
  );
  
  // Convert each sub-metric
  return ytdSubMetrics.map(sm => {
    const ytdKey = `ytd:total_fixed_expense:${sm.orderIndex}:${sm.name}`;
    const prevYTD = prevYTDMap.get(ytdKey) ?? 0;
    return {
      ...sm,
      value: (sm.value ?? 0) - prevYTD
    };
  });
}
```

## Files to Modify
1. `src/config/financialMetrics.ts` - Add hasSubMetrics flag to total_fixed_expense
2. `src/utils/parseFinancialExcel.ts` - Add YTD conversion logic for Ford
3. Database migration - Insert 42 cell mappings for FORD6 sheet

## Testing Checklist
- [ ] Import January Ford statement - values should equal YTD (no conversion)
- [ ] Import February Ford statement - values should be Feb_YTD - Jan_YTD
- [ ] Verify Parts and Service departments parse correctly
- [ ] Verify sub-metric names are extracted from column B
- [ ] Check Total Fixed Expense row expands to show sub-metrics
- [ ] Re-import a month and verify values update correctly
